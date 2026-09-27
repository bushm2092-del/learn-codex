// Package sandbox 只接受有界源码任务，不接受容器参数、命令行或宿主路径。
package sandbox

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var ErrBusy = errors.New("sandbox_busy")
var ErrInvalid = errors.New("invalid_input")
var ErrMissing = errors.New("not_found")

type Input struct {
	Source string `json:"source"`
	Key    string `json:"key"`
}
type Result struct {
	ID       string `json:"id"`
	State    string `json:"state"`
	Output   string `json:"output"`
	Position int    `json:"position"`
}
type job struct {
	Result
	owner   int64
	input   Input
	created time.Time
	cancel  context.CancelFunc
}
type Execute func(context.Context, string, Input) (string, error)
type Queue struct {
	mu      sync.Mutex
	jobs    map[string]*job
	pending []*job
	active  *job
	next    time.Time
	execute Execute
	ready   func() bool
}

func NewQueue(execute Execute, ready func() bool) *Queue {
	return &Queue{jobs: map[string]*job{}, execute: execute, ready: ready}
}
func (q *Queue) Submit(owner int64, in Input) (Result, error) {
	if owner <= 0 || len(in.Source) == 0 || len(in.Source) > 12288 || len(in.Key) > 256 {
		return Result{}, ErrInvalid
	}
	for _, c := range in.Key {
		if c < 33 || c > 126 {
			return Result{}, ErrInvalid
		}
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	now := time.Now()
	q.prune(now)
	if len(q.pending) >= 5 || len(q.jobs) >= 128 || now.Before(q.next) {
		return Result{}, ErrBusy
	}
	for _, j := range q.jobs {
		if j.owner == owner && (j.State == "queued" || j.State == "running") {
			return Result{}, ErrBusy
		}
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return Result{}, err
	}
	j := &job{Result: Result{ID: hex.EncodeToString(b[:]), State: "queued"}, owner: owner, input: in, created: now}
	q.jobs[j.ID] = j
	q.pending = append(q.pending, j)
	q.next = now.Add(5 * time.Second)
	r := j.Result
	r.Position = len(q.pending)
	return r, nil
}
func (q *Queue) Get(owner int64, id string) (Result, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.prune(time.Now())
	j, ok := q.jobs[id]
	if !ok || j.owner != owner {
		return Result{}, ErrMissing
	}
	r := j.Result
	for i, p := range q.pending {
		if p == j {
			r.Position = i + 1
		}
	}
	return r, nil
}
func (q *Queue) Cancel(owner int64, id string) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	j, ok := q.jobs[id]
	if !ok || j.owner != owner {
		return ErrMissing
	}
	if j.cancel != nil {
		j.cancel()
	}
	if j.State == "queued" || j.State == "running" {
		j.State = "cancelled"
		j.input = Input{}
	}
	for i, p := range q.pending {
		if p == j {
			q.pending = append(q.pending[:i], q.pending[i+1:]...)
			break
		}
	}
	return nil
}
func (q *Queue) prune(now time.Time) {
	for id, j := range q.jobs {
		if j.State == "queued" && now.Sub(j.created) > 2*time.Minute {
			j.State = "expired"
			j.input = Input{}
		}
		if j.State != "running" && j.State != "queued" && now.Sub(j.created) > 5*time.Minute {
			delete(q.jobs, id)
		}
	}
	pending := q.pending[:0]
	for _, j := range q.pending {
		if j.State == "queued" {
			pending = append(pending, j)
		}
	}
	q.pending = pending
}

// 唯一 worker 同步等待执行和清理完成；取消不会提前释放并发名额。
func (q *Queue) Run(ctx context.Context) {
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			q.mu.Lock()
			for _, j := range q.jobs {
				j.input = Input{}
			}
			q.mu.Unlock()
			return
		case <-tick.C:
		}
		q.mu.Lock()
		q.prune(time.Now())
		if len(q.pending) == 0 || !q.ready() {
			q.mu.Unlock()
			continue
		}
		j := q.pending[0]
		q.pending = q.pending[1:]
		j.State = "running"
		q.active = j
		runCtx, cancel := context.WithTimeout(ctx, 50*time.Second)
		j.cancel = cancel
		in := j.input
		j.input = Input{}
		q.mu.Unlock()
		out, err := q.execute(runCtx, j.ID, in)
		cancel()
		q.mu.Lock()
		j.cancel = nil
		q.active = nil
		if j.State != "cancelled" {
			j.Output = out
			j.State = "succeeded"
			if err != nil {
				j.State = "failed"
			}
		}
		q.mu.Unlock()
	}
}
