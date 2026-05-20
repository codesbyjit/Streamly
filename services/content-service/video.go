package models

import (
    "time"
    "github.com/google/uuid"
)

type Video struct {
    ID              uuid.UUID       `db:"id" json:"id"`
    ChannelID       uuid.UUID       `db:"channel_id" json:"channelId"`
    Title           string          `db:"title" json:"title"`
    Description     string          `db:"description" json:"description"`
    Status          string          `db:"status" json:"status"`
    Visibility      string          `db:"visibility" json:"visibility"`
    DurationSeconds *int            `db:"duration_seconds" json:"durationSeconds"`
    ThumbnailURLs   map[string]interface{} `db:"thumbnail_urls" json:"thumbnailUrls"`
    VideoURLs       map[string]interface{} `db:"video_urls" json:"videoUrls"`
    Tags            []string        `db:"tags" json:"tags"`
    CategoryID      *int            `db:"category_id" json:"categoryId"`
    Language        string          `db:"language" json:"language"`
    ViewCount       int64           `db:"view_count" json:"viewCount"`
    LikeCount       int             `db:"like_count" json:"likeCount"`
    DislikeCount    int             `db:"dislike_count" json:"dislikeCount"`
    CommentCount    int             `db:"comment_count" json:"commentCount"`
    PublishedAt     *time.Time      `db:"published_at" json:"publishedAt"`
    CreatedAt       time.Time       `db:"created_at" json:"createdAt"`
    UpdatedAt       time.Time       `db:"updated_at" json:"updatedAt"`
}

type CreateVideoRequest struct {
    Title       string   `json:"title" binding:"required,max=100"`
    Description string   `json:"description" binding:"max=5000"`
    Visibility  string   `json:"visibility" binding:"oneof=public unlisted private"`
    Tags        []string `json:"tags" binding:"max=30,dive,max=30"`
    CategoryID  int      `json:"categoryId"`
    Language    string   `json:"language" binding:"len=2"`
}

type UpdateVideoRequest struct {
    Title       *string   `json:"title,omitempty" binding:"omitempty,max=100"`
    Description *string   `json:"description,omitempty" binding:"omitempty,max=5000"`
    Visibility  *string   `json:"visibility,omitempty" binding:"omitempty,oneof=public unlisted private"`
    Tags        []string  `json:"tags,omitempty" binding:"omitempty,max=30,dive,max=30"`
}