package handlers

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/codesbyjit/streamly/platform/services/content-service/internal/models"
    "github.com/codesbyjit/streamly/platform/services/content-service/internal/service"
)

type VideoHandler struct {
    videoService *service.VideoService
}

func NewVideoHandler(videoService *service.VideoService) *VideoHandler {
    return &VideoHandler{videoService: videoService}
}

func (h *VideoHandler) Create(c *gin.Context) {
    userID, exists := c.Get("userID")
    if !exists {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
        return
    }

    var req models.CreateVideoRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    video, err := h.videoService.Create(userID.(uuid.UUID), req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, video)
}

func (h *VideoHandler) Get(c *gin.Context) {
    videoID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid video ID"})
        return
    }

    video, err := h.videoService.GetByID(videoID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "video not found"})
        return
    }

    c.JSON(http.StatusOK, video)
}

func (h *VideoHandler) ListByChannel(c *gin.Context) {
    channelID, err := uuid.Parse(c.Param("channelId"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel ID"})
        return
    }

    page := 1
    limit := 20

    videos, total, err := h.videoService.ListByChannel(channelID, page, limit)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "videos": videos,
        "total":  total,
        "page":   page,
        "limit":  limit,
    })
}

func (h *VideoHandler) Update(c *gin.Context) {
    userID, _ := c.Get("userID")
    videoID, _ := uuid.Parse(c.Param("id"))

    var req models.UpdateVideoRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    video, err := h.videoService.Update(userID.(uuid.UUID), videoID, req)
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, video)
}

func (h *VideoHandler) Delete(c *gin.Context) {
    userID, _ := c.Get("userID")
    videoID, _ := uuid.Parse(c.Param("id"))

    if err := h.videoService.Delete(userID.(uuid.UUID), videoID); err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.Status(http.StatusNoContent)
}