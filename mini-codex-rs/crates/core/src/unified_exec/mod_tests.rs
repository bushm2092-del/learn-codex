use std::path::PathBuf;
use std::time::Duration;

use super::*;
use crate::shell::ShellType;
use tokio::time::Instant;

fn request(process_id: i32, command: &str, tty: bool) -> ExecCommandRequest {
    ExecCommandRequest {
        command: vec!["/bin/sh".to_string(), "-c".to_string(), command.to_string()],
        shell_type: ShellType::Sh,
        process_id,
        yield_time_ms: 250,
        max_output_tokens: None,
        cwd: PathBuf::from("/tmp"),
        tty,
    }
}

#[tokio::test]
async fn interactive_command_yields_and_write_stdin_observes_completion() {
    let manager = UnifiedExecProcessManager::default();
    let process_id = manager.allocate_process_id().await;
    let first = manager
        .exec_command(request(process_id, "sleep 0.4; printf done", false))
        .await
        .unwrap();
    assert_eq!(first.process_id, Some(process_id));
    assert_eq!(first.exit_code, None);

    let completed = manager
        .write_stdin(WriteStdinRequest {
            process_id,
            input: "",
            yield_time_ms: 5_000,
            max_output_tokens: None,
        })
        .await
        .unwrap();
    assert_eq!(completed.process_id, None);
    assert_eq!(completed.exit_code, Some(0));
    assert!(String::from_utf8_lossy(&completed.raw_output).contains("done"));
}

#[tokio::test]
async fn tty_command_accepts_follow_up_input() {
    let manager = UnifiedExecProcessManager::default();
    let process_id = manager.allocate_process_id().await;
    let first = manager
        .exec_command(request(
            process_id,
            "read line; printf 'got:%s' \"$line\"",
            true,
        ))
        .await
        .unwrap();
    assert_eq!(first.process_id, Some(process_id));

    let completed = manager
        .write_stdin(WriteStdinRequest {
            process_id,
            input: "hello\n",
            yield_time_ms: 1_000,
            max_output_tokens: None,
        })
        .await
        .unwrap();
    assert_eq!(completed.exit_code, Some(0));
    assert!(String::from_utf8_lossy(&completed.raw_output).contains("got:hello"));
}

#[tokio::test]
async fn one_shot_timeout_terminates_without_returning_a_session() {
    let manager = UnifiedExecProcessManager::default();
    let process_id = manager.allocate_process_id().await;
    let output = manager
        .exec_command_to_completion(
            request(process_id, "sleep 2", false),
            Duration::from_millis(100),
        )
        .await
        .unwrap();
    assert_eq!(output.process_id, None);
    assert!(output.exit_code.is_some());
}

#[test]
fn pruning_protects_eight_most_recent_processes_and_prefers_exited_entries() {
    let now = Instant::now();
    let mut meta = (0..10)
        .map(|index| {
            (
                1_000 + index,
                now - Duration::from_secs(u64::try_from(10 - index).unwrap()),
                index == 1,
            )
        })
        .collect::<Vec<_>>();

    assert_eq!(
        UnifiedExecProcessManager::process_id_to_prune_from_meta(&mut meta),
        Some(1_001)
    );
}
