package httpapi

import (
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"sync"
	"time"
)

// 单实例限流：只信任直连 IP，不接受客户端伪造的 X-Forwarded-For。
// 多副本部署时由入口网关统一限流；map 有容量上限且惰性清理。
func newLimiter() gin.HandlerFunc {
	type entry struct {
		limiter *rate.Limiter
		seen    time.Time
	}
	var mu sync.Mutex
	clients := map[string]*entry{}
	lastSweep := time.Now()
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/healthz" || c.Request.URL.Path == "/readyz" {
			c.Next()
			return
		}
		key := c.ClientIP()
		passwordAuth := c.Request.URL.Path == "/api/v1/auth/login" || c.Request.URL.Path == "/api/v1/auth/register"
		if passwordAuth {
			key += ":password"
		}
		now := time.Now()
		mu.Lock()
		if now.Sub(lastSweep) > time.Minute {
			for k, v := range clients {
				if now.Sub(v.seen) > 5*time.Minute {
					delete(clients, k)
				}
			}
			lastSweep = now
		}
		e := clients[key]
		if e == nil {
			if len(clients) >= 10000 {
				mu.Unlock()
				c.AbortWithStatus(503)
				return
			}
			e = &entry{limiter: rate.NewLimiter(2, 30)}
			if passwordAuth {
				e.limiter = rate.NewLimiter(rate.Every(12*time.Second), 5)
			}
			clients[key] = e
		}
		e.seen = now
		allowed := e.limiter.Allow()
		mu.Unlock()
		if !allowed {
			c.Header("Retry-After", "1")
			if passwordAuth {
				c.Header("Retry-After", "12")
			}
			c.AbortWithStatusJSON(429, gin.H{"error": "rate_limited"})
			return
		}
		c.Next()
	}
}
