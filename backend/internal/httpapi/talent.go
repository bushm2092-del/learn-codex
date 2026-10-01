package httpapi

import (
	"errors"
	"github.com/gin-gonic/gin"
	"mini-codex/backend/internal/service"
)

func (a *API) startTalent(c *gin.Context) {
	attempt, challenge, err := a.svc.StartTalent(c.Request.Context(), userID(c), c.Param("game"))
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(201, gin.H{"id": attempt.ID, "game": attempt.Game, "challenge": challenge})
}

func (a *API) finishTalent(c *gin.Context) {
	var in service.TalentSubmission
	if c.ShouldBindJSON(&in) != nil {
		a.fail(c, service.ErrInvalid)
		return
	}
	row, err := a.svc.FinishTalent(c.Request.Context(), userID(c), c.Param("game"), c.Param("id"), in)
	if errors.Is(err, service.ErrAttemptExpired) {
		c.JSON(410, gin.H{"error": "attempt_expired"})
		return
	}
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, row)
}

func (a *API) talentLeaderboard(c *gin.Context) {
	game := c.Param("game")
	if !service.ValidTalentGame(game) {
		a.fail(c, service.ErrInvalid)
		return
	}
	board, err := a.svc.Store.TalentLeaderboard(c.Request.Context(), userID(c), game)
	if err != nil {
		a.fail(c, err)
		return
	}
	c.JSON(200, board)
}
