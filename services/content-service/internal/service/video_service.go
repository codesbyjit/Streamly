package service

import (
    "errors"
    "time"

    "github.com/google/uuid"
    "github.com/codesbyjit/streamly/platform/services/content-service/internal/events"
    "github.com/codesbyjit/streamly/platform/services/content-service/internal/models"
    "github.com/codesbyjit/streamly/platform/services/content-service/internal/repository"
)

type VideoService struct {
    videoRepo   repository.VideoRepository
    channelRepo repository.ChannelRepository
    publisher   *events.KafkaPublisher
}

func NewVideoService(
    videoRepo repository.VideoRepository,
    channelRepo repository.ChannelRepository,
    publisher *events.KafkaPublisher,
) *VideoService {
    return &VideoService{
        videoRepo:   videoRepo,
        channelRepo: channelRepo,
        publisher:   publisher,
    }
}

func (s *VideoService) Create(userID uuid.UUID, req models.CreateVideoRequest) (*models.Video, error) {
    channel, err := s.channelRepo.FindByOwnerID(userID)
    if err != nil {
        return nil, errors.New("channel not found")
    }

    video := &models.Video{
        ID:          uuid.New(),
        ChannelID:   channel.ID,
        Title:       req.Title,
        Description: req.Description,
        Status:      "uploading",
        Visibility:  req.Visibility,
        Tags:        req.Tags,
        CategoryID:  &req.CategoryID,
        Language:    req.Language,
        ThumbnailURLs: map[string]interface{}{},
        VideoURLs:     map[string]interface{}{},
    }

    if err := s.videoRepo.Create(video); err != nil {
        return nil, err
    }

    return video, nil
}

func (s *VideoService) GetByID(id uuid.UUID) (*models.Video, error) {
    return s.videoRepo.FindByID(id)
}

func (s *VideoService) ListByChannel(channelID uuid.UUID, page, limit int) ([]models.Video, int, error) {
    offset := (page - 1) * limit
    return s.videoRepo.FindByChannel(channelID, limit, offset)
}

func (s *VideoService) Update(userID, videoID uuid.UUID, req models.UpdateVideoRequest) (*models.Video, error) {
    video, err := s.videoRepo.FindByID(videoID)
    if err != nil {
        return nil, errors.New("video not found")
    }

    channel, err := s.channelRepo.FindByID(video.ChannelID)
    if err != nil || channel.OwnerID != userID {
        return nil, errors.New("not authorized to update this video")
    }

    if req.Title != nil {
        video.Title = *req.Title
    }
    if req.Description != nil {
        video.Description = *req.Description
    }
    if req.Visibility != nil {
        video.Visibility = *req.Visibility

        if *req.Visibility == "public" && video.PublishedAt == nil {
            now := time.Now()
            video.PublishedAt = &now
            video.Status = "ready"

            s.publisher.PublishVideoPublished(video.ID, video.ChannelID, video.Title)
        }
    }
    if req.Tags != nil {
        video.Tags = req.Tags
    }

    video.UpdatedAt = time.Now()

    if err := s.videoRepo.Update(video); err != nil {
        return nil, err
    }

    return video, nil
}

func (s *VideoService) Delete(userID, videoID uuid.UUID) error {
    video, err := s.videoRepo.FindByID(videoID)
    if err != nil {
        return errors.New("video not found")
    }

    channel, err := s.channelRepo.FindByID(video.ChannelID)
    if err != nil || channel.OwnerID != userID {
        return errors.New("not authorized to delete this video")
    }

    return s.videoRepo.Delete(videoID)
}