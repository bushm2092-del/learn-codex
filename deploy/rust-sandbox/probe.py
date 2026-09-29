"""在服务器上由管理员显式运行；只调用本地 worker，不使用真实 API Key。"""
import http.client
import json
import socket
import sys
import time


class LocalHTTP(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(5)
        self.sock.connect('/run/learn-rust-worker/worker.sock')


def call(method, path, payload=None):
    conn = LocalHTTP('worker')
    conn.request(method, path, json.dumps(payload) if payload else None,
                 {'X-Learn-User': '999999999', 'Content-Type': 'application/json'})
    response = conn.getresponse()
    body = response.read()
    status = response.status
    conn.close()
    return status, json.loads(body) if body else None


cases = [
    ('processes', '''use std::process::Command;
fn main(){let mut children=Vec::new();let mut blocked=false;
 for _ in 0..128 {match Command::new("/bin/sleep").arg("3").spawn(){Ok(c)=>children.push(c),Err(_)=>{blocked=true;break}}}
 for c in &mut children{let _=c.kill();let _=c.wait();}
 assert!(blocked,"process limit missing");println!("processes-ok");}''', 'succeeded', 'processes-ok'),
    ('disk', '''use std::{fs::File,io::Write};
fn main(){let mut f=File::create("/tmp/test").unwrap();let chunk=vec![0;1024*1024];let mut blocked=false;
for _ in 0..32{if f.write_all(&chunk).is_err(){blocked=true;break}}
assert!(blocked);println!("disk-ok");}''', 'succeeded', 'disk-ok'),
    ('hello', 'fn main(){println!("real-rust-ok");}', 'succeeded', 'real-rust-ok'),
    ('isolation', '''use std::{fs,net::{TcpStream,SocketAddr},time::Duration};
fn main(){
 assert!(fs::write("/etc/probe", "x").is_err());
 assert!(fs::read("/home/admin/learn-codex-releases/learn-codex-unlimited-20260927/.env").is_err());
 assert!(fs::metadata("/var/run/docker.sock").is_err());
 for ip in ["169.254.169.254:80","1.1.1.1:80","172.17.0.1:80"] {
 assert!(TcpStream::connect_timeout(&ip.parse::<SocketAddr>().unwrap(), Duration::from_secs(1)).is_err());
 }
 println!("isolation-ok");}''', 'succeeded', 'isolation-ok'),
    ('output', 'fn main(){loop {println!("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");}}', 'failed', ''),
    ('memory', 'fn main(){let mut v=Vec::new();loop{v.push(vec![42u8;16*1024*1024]);std::hint::black_box(&v);}}', 'failed', ''),
    ('timeout', 'fn main(){loop{std::hint::black_box(1);}}', 'failed', ''),
    ('relay', '''use std::io::{Read,Write};use std::os::unix::net::UnixStream;
fn main(){let mut s=UnixStream::connect("/relay/http.sock").unwrap();s.write_all(b"POST /responses HTTP/1.1\\r\\nHost: api.deepseek.com\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\n{}").unwrap();let mut b=String::new();s.read_to_string(&mut b).unwrap();assert!(b.contains("401"));println!("relay-ok");}''', 'succeeded', 'relay-ok'),
    ('relay-budget', '''use std::io::{Read,Write};use std::os::unix::net::UnixStream;
fn send()->String{let mut s=UnixStream::connect("/relay/http.sock").unwrap();s.write_all(b"POST /responses HTTP/1.1\\r\\nHost: api.deepseek.com\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\n{}").unwrap();let mut b=String::new();s.read_to_string(&mut b).unwrap();b}
fn main(){for _ in 0..3{assert!(send().contains("401"));}assert!(send().contains("429"));println!("relay-budget-ok");}''', 'succeeded', 'relay-budget-ok'),
    ('bridge-budget', '''use serde_json::json;
#[tokio::main(flavor="current_thread")]
async fn main(){let c=reqwest::Client::new();for expected in [401,401,401,429]{let r=c.post("https://api.deepseek.com/responses").bearer_auth(std::env::var("DEEPSEEK_API_KEY").unwrap()).json(&json!({"model":"deepseek-flash","input":"probe","stream":false,"max_output_tokens":1})).send().await.unwrap();assert_eq!(r.status().as_u16(),expected);}println!("bridge-budget-ok");}''', 'succeeded', 'bridge-budget-ok'),
]

for name, source, expected, text in cases:
    if len(sys.argv) > 1 and name not in sys.argv[1:]:
        continue
    deadline = time.monotonic() + 45
    while True:
        status, result = call('POST', '/jobs', {'source': source})
        if status != 429 or time.monotonic() > deadline:
            break
        time.sleep(2)
    assert status == 200, (name, status, result)
    job_id = result['id']
    start = time.monotonic()
    while result['state'] in ('queued', 'running'):
        assert time.monotonic() - start < 150, (name, result)
        time.sleep(1)
        status, result = call('GET', '/jobs?id=' + job_id)
        assert status == 200, (name, status)
    print(name, result['state'], round(time.monotonic() - start, 1), 'seconds', flush=True)
    assert result['state'] == expected and text in result['output'], (name, result)
print('All live sandbox probes passed.', flush=True)

if 'cancel' in sys.argv[1:]:
    status, result = call('POST', '/jobs', {'source': 'fn main(){loop{std::hint::black_box(1);}}'})
    assert status == 200, (status, result)
    job_id = result['id']
    time.sleep(2)
    status, _ = call('DELETE', '/jobs?id=' + job_id)
    assert status == 204
    status, result = call('GET', '/jobs?id=' + job_id)
    assert result['state'] == 'cancelled'
    print('Cancellation recorded; verify labelled containers are removed.', flush=True)
