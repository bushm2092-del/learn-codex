package httpapi

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"mini-codex/backend/internal/service"
	"strconv"
	"time"
)

func (a *API) chapters(c *gin.Context) {
	rows, err := a.svc.Store.Chapters(c.Request.Context())
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, gin.H{"items": rows})
}
func (a *API) comments(c *gin.Context) {
	if err := a.svc.Store.Chapter(c.Request.Context(), c.Param("chapter")); err != nil {
		a.fail(c, err)
		return
	}
	before := int64(0)
	if raw := c.Query("before"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n <= 0 {
			a.fail(c, service.ErrInvalid)
			return
		}
		before = n
	}
	rows, err := a.svc.Store.Comments(c.Request.Context(), c.Param("chapter"), before)
	if err != nil {
		a.fail(c, err)
		return
	}
	var next int64
	if len(rows) == 20 {
		next = rows[len(rows)-1].ID
	}
	c.JSON(200, gin.H{"items": rows, "next_cursor": next})
}
func (a *API) comment(c *gin.Context) {
	var in struct {
		Body string `json:"body"`
	}
	if c.ShouldBindJSON(&in) != nil {
		a.fail(c, service.ErrInvalid)
		return
	}
	row, err := a.svc.Comment(c.Request.Context(), userID(c), c.Param("chapter"), in.Body)
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(201, row)
}
func (a *API) deleteComment(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		a.fail(c, service.ErrInvalid)
		return
	}
	found, err := a.svc.Store.DeleteComment(c.Request.Context(), id, userID(c))
	if err != nil {
		a.fail(c, err)
		return
	}
	if !found {
		a.fail(c, gorm.ErrRecordNotFound)
		return
	}
	c.Status(204)
}
func (a *API) checkIn(c *gin.Context) {
	created, err := a.svc.CheckIn(c.Request.Context(), userID(c), c.Param("chapter"))
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, gin.H{"checked_in": true, "created": created})
}
func (a *API) progress(c *gin.Context) {
	rows, err := a.svc.Store.Progress(c.Request.Context(), userID(c))
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, gin.H{"items": rows})
}
func (a *API) cancelCheckIn(c *gin.Context) {
	if err := a.svc.Store.Chapter(c.Request.Context(), c.Param("chapter")); err != nil {
		a.fail(c, err)
		return
	}
	if err := a.svc.Store.CancelCheckIn(c.Request.Context(), userID(c), c.Param("chapter")); err != nil {
		a.fail(c, err)
		return
	}
	c.Status(204)
}
func (a *API) leaderboard(c *gin.Context) {
	rows, err := a.svc.Store.Leaderboard(c.Request.Context())
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, gin.H{"items": rows})
}
func (a *API) view(c *gin.Context) {
	var in struct {
		Page string `json:"page"`
	}
	if c.ShouldBindJSON(&in) != nil {
		a.fail(c, service.ErrInvalid)
		return
	}
	if err := a.svc.ValidatePage(c.Request.Context(), in.Page); err != nil {
		a.fail(c, err)
		return
	}
	visitor, _ := c.Cookie("learn_visitor")
	if len(visitor) != 64 {
		var err error
		visitor, err = service.Token()
		if err != nil {
			a.fail(c, err)
			return
		}
		a.cookie(c, "learn_visitor", visitor, "/", 365*24*3600)
	}
	if err := a.svc.Store.RecordView(c.Request.Context(), in.Page, service.Hash(visitor), time.Now()); err != nil {
		a.fail(c, err)
		return
	}
	c.Status(204)
}
func (a *API) stats(c *gin.Context) {
	page := c.Query("page")
	if page != "" {
		if err := a.svc.ValidatePage(c.Request.Context(), page); err != nil {
			a.fail(c, err)
			return
		}
	}
	from, to, err := service.DateRange(c.Query("from"), c.Query("to"), time.Now())
	if err != nil {
		a.fail(c, err)
		return
	}
	stats, err := a.svc.Store.Stats(c.Request.Context(), page, from, to)
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, gin.H{"from": from, "to": to, "page": page, "pv": stats.PV, "uv": stats.UV})
}
