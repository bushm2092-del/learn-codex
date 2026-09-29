"""真实编译页面示例，以容器内部测试响应验证 HTTP/JSON 链路；不调用付费 API。"""
import argparse
import pathlib
import re
import subprocess
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--runtime', default='learn-rust',
                    help='默认 gVisor；仅本地功能测试可显式选 docker（不是隔离验收）')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
text = (root / 'frontends/Teach/src/i18n/rustSandbox.ts').read_text()
example = re.search(r'export const rustExample = `(.*?)`;', text, re.S).group(1)
fixture = r'''
    let listener = std::os::unix::net::UnixListener::bind("/relay/http.sock")?;
    std::thread::spawn(move || {
        use std::io::{BufRead, Read, Write};
        let (mut socket, _) = listener.accept().unwrap();
        let mut reader = std::io::BufReader::new(&socket);
        let mut line = String::new();
        reader.read_line(&mut line).unwrap();
        assert!(line.starts_with("POST /responses HTTP/1.1"));
        let mut length = 0;
        loop {
            line.clear(); reader.read_line(&mut line).unwrap();
            if line == "\r\n" { break; }
            if let Some(n) = line.to_lowercase().strip_prefix("content-length:") {
                length = n.trim().parse::<usize>().unwrap();
            }
        }
        let mut body = vec![0; length]; reader.read_exact(&mut body).unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["model"], "deepseek-flash");
        assert_eq!(body["input"][0]["content"], "你是谁");
        assert_eq!(body["input"][1]["role"], "assistant");
        assert_eq!(body["input"][1]["content"], "我是deepseek");
        assert_eq!(body["input"][2]["content"], "我的上一句话是什么？");
        let body = r#"{"object":"response","output":[{"type":"message","content":[{"type":"output_text","text":"rust-http-json-ok"}]}]}"#;
        write!(socket, "HTTP/1.1 STATUS\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
    });
'''

def run(name, source, success, expected):
    container = 'learn-rust-smoke-' + uuid.uuid4().hex
    command = ['docker', 'run', '--name', container, '--platform', 'linux/amd64',
               '--network=none', '--read-only', '--user=65534:65534',
               '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
               '--memory=1g', '--memory-swap=1g', '--cpus=0.75', '--pids-limit=64',
               '--ulimit=nofile=64:64', '--ulimit=core=0:0', '--log-driver=none',
               '--tmpfs=/work:rw,exec,nosuid,nodev,size=64m,mode=700,uid=65534,gid=65534',
               '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777',
               '--tmpfs=/relay:rw,noexec,nosuid,nodev,size=1m,mode=1777', '-i']
    if args.runtime != 'docker':
        command += ['--runtime=' + args.runtime]
    command += ['learn-rust-sandbox:deps-v2']
    start = time.monotonic()
    try:
        result = subprocess.run(command, input=source, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=50)
        assert (result.returncode == 0) == success and expected in result.stdout, result.stdout
        print(name, 'PASS', round(time.monotonic() - start, 1), 'seconds', flush=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', container], check=True, stdout=subprocess.DEVNULL, timeout=10)

for status, success, expected in [('200 OK', True, 'rust-http-json-ok'), ('401 Unauthorized', False, '401')]:
    source = example.replace(
        '    let client = reqwest::Client::new();',
        fixture.replace('STATUS', status) + '\n    let client = reqwest::Client::new();')
    run('reqwest-' + status.split()[0], source, success, expected)
run('compile-error', 'fn main() { this is not Rust; }', False, 'error')
run('proxy-host-denied', example.replace('api.deepseek.com', 'example.com'), False, 'TunnelUnsuccessful')
run('proxy-path-denied', example.replace('/responses', '/forbidden'), False, '403')
run('isolation', '''fn main() {
assert!(std::fs::write("/etc/sandbox-test", "x").is_err());
assert!(std::fs::metadata("/var/run/docker.sock").is_err());
assert!(std::net::TcpStream::connect_timeout(&"169.254.169.254:80".parse().unwrap(), std::time::Duration::from_secs(1)).is_err());
println!("isolation-ok"); }''', True, 'isolation-ok')
