use std::io::Read;
use std::io::Write;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;

use mini_codex_utils_pty::CommandBuilder;
use mini_codex_utils_pty::PtySize;
use tokio::io::AsyncReadExt;
use tokio::process::Child;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::sync::Notify;

use super::UnifiedExecError;
use super::head_tail_buffer::HeadTailBuffer;

pub(crate) struct OutputBuffers {
    pub(crate) pending: HeadTailBuffer,
}

impl Default for OutputBuffers {
    fn default() -> Self {
        Self {
            pending: HeadTailBuffer::default(),
        }
    }
}

pub(crate) struct UnifiedExecProcess {
    child: ProcessChild,
    stdin: ProcessStdin,
    output: Arc<StdMutex<OutputBuffers>>,
    output_notify: Arc<Notify>,
    readers: Arc<AtomicUsize>,
    exited: AtomicBool,
    interaction_lock: Mutex<()>,
}

enum ProcessChild {
    Pipe(Mutex<Child>),
    Pty(StdMutex<Box<dyn mini_codex_utils_pty::Child + Send + Sync>>),
}

enum ProcessStdin {
    Closed,
    Pty(StdMutex<PtyStdin>),
}

struct PtyStdin {
    writer: Box<dyn Write + Send>,
    #[cfg(windows)]
    normalizer: mini_codex_utils_pty::WindowsTtyInputNormalizer,
}

impl UnifiedExecProcess {
    pub(crate) fn spawn(
        command: &[String],
        cwd: &Path,
        tty: bool,
    ) -> Result<Arc<Self>, UnifiedExecError> {
        if tty {
            Self::spawn_pty(command, cwd)
        } else {
            Self::spawn_pipe(command, cwd)
        }
    }

    fn spawn_pipe(command: &[String], cwd: &Path) -> Result<Arc<Self>, UnifiedExecError> {
        let (program, args) = command
            .split_first()
            .ok_or(UnifiedExecError::MissingCommandLine)?;
        let mut process = Command::new(program);
        process
            .args(args)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        apply_unified_exec_env(&mut process);
        let mut child = process
            .spawn()
            .map_err(|error| UnifiedExecError::create_process(error.to_string()))?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let output = Arc::new(StdMutex::new(OutputBuffers::default()));
        let output_notify = Arc::new(Notify::new());
        let readers = Arc::new(AtomicUsize::new(0));
        if let Some(stdout) = stdout {
            spawn_async_reader(
                stdout,
                Arc::clone(&output),
                Arc::clone(&output_notify),
                Arc::clone(&readers),
            );
        }
        if let Some(stderr) = stderr {
            spawn_async_reader(
                stderr,
                Arc::clone(&output),
                Arc::clone(&output_notify),
                Arc::clone(&readers),
            );
        }
        Ok(Arc::new(Self {
            child: ProcessChild::Pipe(Mutex::new(child)),
            stdin: ProcessStdin::Closed,
            output,
            output_notify,
            readers,
            exited: AtomicBool::new(false),
            interaction_lock: Mutex::new(()),
        }))
    }

    fn spawn_pty(command: &[String], cwd: &Path) -> Result<Arc<Self>, UnifiedExecError> {
        if command.is_empty() {
            return Err(UnifiedExecError::MissingCommandLine);
        }
        let pair = mini_codex_utils_pty::native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| UnifiedExecError::create_process(error.to_string()))?;
        let argv = command.iter().map(std::ffi::OsString::from).collect();
        let mut builder = CommandBuilder::from_argv(argv);
        builder.cwd(cwd);
        for (key, value) in unified_exec_env() {
            builder.env(key, value);
        }
        let child = pair
            .slave
            .spawn_command(builder)
            .map_err(|error| UnifiedExecError::create_process(error.to_string()))?;
        drop(pair.slave);
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| UnifiedExecError::create_process(error.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| UnifiedExecError::create_process(error.to_string()))?;
        let output = Arc::new(StdMutex::new(OutputBuffers::default()));
        let output_notify = Arc::new(Notify::new());
        let readers = Arc::new(AtomicUsize::new(0));
        spawn_blocking_reader(
            reader,
            Arc::clone(&output),
            Arc::clone(&output_notify),
            Arc::clone(&readers),
        );
        Ok(Arc::new(Self {
            child: ProcessChild::Pty(StdMutex::new(child)),
            stdin: ProcessStdin::Pty(StdMutex::new(PtyStdin {
                writer,
                #[cfg(windows)]
                normalizer: Default::default(),
            })),
            output,
            output_notify,
            readers,
            exited: AtomicBool::new(false),
            interaction_lock: Mutex::new(()),
        }))
    }

    pub(crate) async fn try_wait(&self) -> Result<Option<i32>, UnifiedExecError> {
        let exit_code = match &self.child {
            ProcessChild::Pipe(child) => child
                .lock()
                .await
                .try_wait()
                .map(|status| status.map(|status| status.code().unwrap_or(-1)))
                .map_err(|error| UnifiedExecError::process_failed(error.to_string())),
            ProcessChild::Pty(child) => child
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .try_wait()
                .map(|status| status.map(|status| i32::try_from(status.exit_code()).unwrap_or(-1)))
                .map_err(|error| UnifiedExecError::process_failed(error.to_string())),
        }?;
        if exit_code.is_some() {
            self.exited.store(true, Ordering::Release);
        }
        Ok(exit_code)
    }

    pub(crate) async fn terminate(&self) -> Result<(), UnifiedExecError> {
        match &self.child {
            ProcessChild::Pipe(child) => child
                .lock()
                .await
                .kill()
                .await
                .map_err(|error| UnifiedExecError::process_failed(error.to_string())),
            ProcessChild::Pty(child) => child
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .kill()
                .map_err(|error| UnifiedExecError::process_failed(error.to_string())),
        }
    }

    pub(crate) async fn write_stdin(&self, input: &str) -> Result<(), UnifiedExecError> {
        match &self.stdin {
            ProcessStdin::Closed => Err(UnifiedExecError::StdinClosed),
            ProcessStdin::Pty(stdin) => {
                let mut stdin = stdin
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                #[cfg(windows)]
                let input = stdin.normalizer.normalize(input.as_bytes());
                #[cfg(not(windows))]
                let input = input.as_bytes();
                stdin
                    .writer
                    .write_all(input.as_ref())
                    .and_then(|()| stdin.writer.flush())
                    .map_err(|_| UnifiedExecError::WriteToStdin)
            }
        }
    }

    pub(crate) fn take_output(&self) -> HeadTailBuffer {
        let mut output = self
            .output
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        std::mem::take(&mut output.pending)
    }

    pub(crate) fn output_notify(&self) -> &Notify {
        &self.output_notify
    }

    pub(crate) fn readers_finished(&self) -> bool {
        self.readers.load(Ordering::Acquire) == 0
    }

    pub(crate) fn has_exited(&self) -> bool {
        if self.exited.load(Ordering::Acquire) {
            return true;
        }
        let observed_exit = match &self.child {
            ProcessChild::Pipe(child) => child
                .try_lock()
                .ok()
                .and_then(|mut child| child.try_wait().ok().flatten())
                .is_some(),
            ProcessChild::Pty(child) => child
                .try_lock()
                .ok()
                .and_then(|mut child| child.try_wait().ok().flatten())
                .is_some(),
        };
        if observed_exit {
            self.exited.store(true, Ordering::Release);
        }
        observed_exit
    }

    pub(crate) fn interaction_lock(&self) -> &Mutex<()> {
        &self.interaction_lock
    }
}

fn unified_exec_env() -> [(&'static str, &'static str); 9] {
    [
        ("NO_COLOR", "1"),
        ("TERM", "dumb"),
        ("LANG", "C.UTF-8"),
        ("LC_CTYPE", "C.UTF-8"),
        ("LC_ALL", "C.UTF-8"),
        ("COLORTERM", ""),
        ("PAGER", "cat"),
        ("GIT_PAGER", "cat"),
        ("GH_PAGER", "cat"),
    ]
}

fn apply_unified_exec_env(command: &mut Command) {
    command.envs(unified_exec_env());
}

fn append_output(output: &StdMutex<OutputBuffers>, notify: &Notify, chunk: &[u8]) {
    output
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .pending
        .push_chunk(chunk);
    notify.notify_waiters();
}

fn spawn_async_reader<R>(
    mut reader: R,
    output: Arc<StdMutex<OutputBuffers>>,
    notify: Arc<Notify>,
    readers: Arc<AtomicUsize>,
) where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    readers.fetch_add(1, Ordering::Release);
    tokio::spawn(async move {
        let mut chunk = [0_u8; 8192];
        loop {
            match reader.read(&mut chunk).await {
                Ok(0) | Err(_) => break,
                Ok(read) => append_output(&output, &notify, &chunk[..read]),
            }
        }
        readers.fetch_sub(1, Ordering::Release);
        notify.notify_waiters();
    });
}

fn spawn_blocking_reader(
    mut reader: Box<dyn Read + Send>,
    output: Arc<StdMutex<OutputBuffers>>,
    notify: Arc<Notify>,
    readers: Arc<AtomicUsize>,
) {
    readers.fetch_add(1, Ordering::Release);
    std::thread::spawn(move || {
        let mut chunk = [0_u8; 8192];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(read) => append_output(&output, &notify, &chunk[..read]),
            }
        }
        readers.fetch_sub(1, Ordering::Release);
        notify.notify_waiters();
    });
}
