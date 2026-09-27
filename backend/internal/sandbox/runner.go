package sandbox

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const Image = "learn-rust-sandbox:deps-v2"
const label = "learn.rust-sandbox=true"

type Runner struct{ stopped atomic.Bool }
type limitedOutput struct {
	mu     sync.Mutex
	b      []byte
	cancel context.CancelFunc
}

func (b *limitedOutput) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	n := len(p)
	left := 32768 - len(b.b)
	if len(p) > left {
		b.b = append(b.b, p[:left]...)
		b.cancel()
	} else {
		b.b = append(b.b, p...)
	}
	return n, nil
}

// 保留至少 1 GiB 给网站与操作系统；无法读取内存信息时拒绝执行。
func (r *Runner) Ready() bool {
	if r.stopped.Load() {
		return false
	}
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(data), "\n") {
		f := strings.Fields(line)
		if len(f) > 1 && f[0] == "MemAvailable:" {
			n, _ := strconv.ParseUint(f[1], 10, 64)
			return n >= 2*1024*1024
		}
	}
	return false
}
func containerArgs(name, relay string) []string {
	return []string{"create", "--name", name, "--label", label, "--runtime=learn-rust", "--network=none", "--read-only", "--user=65534:65534", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--memory=1g", "--memory-swap=1g", "--cpus=0.75", "--pids-limit=64", "--ulimit=nofile=64:64", "--ulimit=core=0:0", "--log-driver=none", "--restart=no", "--tmpfs=/work:rw,exec,nosuid,nodev,size=64m,mode=700,uid=65534,gid=65534", "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777", "--mount=type=bind,src=" + relay + ",dst=/relay,readonly", "--interactive", Image}
}
func docker(ctx context.Context, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, "docker", args...).CombinedOutput()
}

// 启动前清理只属于本 worker 的孤儿容器；清理失败即退出，不回退到 runc。
func (r *Runner) Preflight(ctx context.Context) error {
	raw, err := docker(ctx, "ps", "-aq", "--filter", "label="+label)
	if err != nil {
		return errors.New("docker unavailable")
	}
	for _, id := range strings.Fields(string(raw)) {
		if _, err = docker(ctx, "rm", "-f", id); err != nil {
			return errors.New("orphan cleanup failed")
		}
	}
	raw, err = docker(ctx, "run", "--rm", "--runtime=learn-rust", "--network=none", "--read-only", "--cap-drop=ALL", "--memory=128m", "--memory-swap=128m", "--pids-limit=32", "--entrypoint=/bin/dmesg", Image)
	if err != nil || !strings.Contains(string(raw), "gVisor") {
		return errors.New("gVisor verification failed")
	}
	return nil
}
func (r *Runner) Execute(parent context.Context, id string, in Input) (string, error) {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()
	dir, err := os.MkdirTemp("/run/learn-rust-relays", "job-")
	if err != nil {
		return "sandbox unavailable", err
	}
	defer os.RemoveAll(dir) // 仅删除服务器生成的本次临时 socket 目录，不接收用户路径。
	if err = os.Chmod(dir, 0755); err != nil {
		return "sandbox unavailable", err
	}
	closeRelay, err := startRelay(ctx, dir, in.Key)
	if err != nil {
		return "sandbox unavailable", err
	}
	defer closeRelay()
	name := "learn-rust-" + id
	defer func() {
		cleanup, c := context.WithTimeout(context.Background(), 10*time.Second)
		defer c()
		if _, e := docker(cleanup, "rm", "-f", name); e != nil {
			r.stopped.Store(true)
		}
	}()
	if _, err = docker(ctx, containerArgs(name, dir)...); err != nil {
		return "sandbox creation failed", err
	}
	out := &limitedOutput{cancel: cancel}
	cmd := exec.CommandContext(ctx, "docker", "start", "-ai", name)
	cmd.Stdin = strings.NewReader(in.Source)
	cmd.Stdout = out
	cmd.Stderr = out
	err = cmd.Run()
	output := string(out.b)
	if in.Key != "" {
		output = strings.ReplaceAll(output, in.Key, "[redacted]")
	}
	if ctx.Err() != nil {
		return output + "\nExecution cancelled, timed out, or output limit exceeded.", ctx.Err()
	}
	if err != nil {
		return output, errors.New("execution failed")
	}
	// docker start -a 的退出状态还需核对容器自身状态。
	state, e := docker(ctx, "inspect", "--format", "{{.State.ExitCode}}", name)
	if e != nil || strings.TrimSpace(string(state)) != "0" {
		return output, fmt.Errorf("sandbox exited")
	}
	return output, nil
}
