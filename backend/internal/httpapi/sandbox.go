package httpapi

import (
	"context"
	"github.com/gin-gonic/gin"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// 只有本地 Unix socket；绝不让客户端决定 worker 地址、身份或容器参数。
func (a *API) sandbox(c *gin.Context) {
	if a.cfg.SandboxSocket == "" {
		c.JSON(503, gin.H{"error": "sandbox_disabled"})
		return
	}
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", a.cfg.SandboxSocket)
	}}
	defer transport.CloseIdleConnections()
	target := "http://worker/jobs"
	if c.Param("id") != "" {
		target += "?id=" + url.QueryEscape(c.Param("id"))
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, target, c.Request.Body)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid_input"})
		return
	}
	req.Header.Set("X-Learn-User", strconv.FormatInt(userID(c), 10))
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{Transport: transport, Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		c.JSON(503, gin.H{"error": "sandbox_unavailable"})
		return
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 256<<10))
	if err != nil {
		c.JSON(503, gin.H{"error": "sandbox_unavailable"})
		return
	}
	c.Data(res.StatusCode, "application/json", raw)
}
