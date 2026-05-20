package events

import (
    "context"
    "encoding/json"
    "log"
    "time"

    "github.com/google/uuid"
    "github.com/segmentio/kafka-go"
)

type VideoEvent struct {
    EventType string    `json:"eventType"`
    VideoID   uuid.UUID `json:"videoId"`
    ChannelID uuid.UUID `json:"channelId"`
    Title     string    `json:"title"`
    Timestamp int64     `json:"timestamp"`
}

type KafkaPublisher struct {
    writer *kafka.Writer
}

func NewKafkaPublisher(brokers []string) *KafkaPublisher {
    return &KafkaPublisher{
        writer: &kafka.Writer{
            Addr:     kafka.TCP(brokers...),
            Topic:    "video.events",
            Balancer: &kafka.LeastBytes{},
            Async:    true,
        },
    }
}

func (p *KafkaPublisher) PublishVideoPublished(videoID, channelID uuid.UUID, title string) {
    event := VideoEvent{
        EventType: "video.published",
        VideoID:   videoID,
        ChannelID: channelID,
        Title:     title,
        Timestamp: time.Now().Unix(),
    }

    payload, _ := json.Marshal(event)

    err := p.writer.WriteMessages(context.Background(), kafka.Message{
        Key:   []byte(videoID.String()),
        Value: payload,
    })

    if err != nil {
        log.Printf("Failed to publish event: %v", err)
    }
}

func (p *KafkaPublisher) Close() error {
    return p.writer.Close()
}