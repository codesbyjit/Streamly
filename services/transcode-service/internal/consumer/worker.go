package consumer

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "os"
    "path/filepath"
    "strconv"
    "strings"

    "github.com/google/uuid"
    "github.com/jmoiron/sqlx"
    "github.com/minio/minio-go/v7"
    "github.com/segmentio/kafka-go"
    "github.com/streamly/platform/services/transcode-service/internal/processor"
)

type VideoUploadedEvent struct {
    EventType   string `json:"eventType"`
    VideoID     string `json:"videoId"`
    StoragePath string `json:"storagePath"`
    Filename    string `json:"filename"`
}

type TranscodeWorker struct {
    reader    *kafka.Reader
    minio     *minio.Client
    ffmpeg    *processor.FFmpegProcessor
    db        *sqlx.DB
    workDir   string
}

func NewTranscodeWorker(brokers []string, minioClient *minio.Client, db *sqlx.DB) *TranscodeWorker {
    return &TranscodeWorker{
        reader: kafka.NewReader(kafka.ReaderConfig{
            Brokers: brokers,
            Topic:   "video.uploaded",
            GroupID: "transcode-workers",
            MaxBytes: 10e6,
        }),
        minio:   minioClient,
        ffmpeg:  processor.NewFFmpegProcessor("/tmp/transcode"),
        db:      db,
        workDir: "/tmp/transcode",
    }
}

func (w *TranscodeWorker) Start() {
    log.Println("Transcode worker started, waiting for jobs...")

    for {
        msg, err := w.reader.ReadMessage(context.Background())
        if err != nil {
            log.Printf("Error reading message: %v", err)
            continue
        }

        var event VideoUploadedEvent
        if err := json.Unmarshal(msg.Value, &event); err != nil {
            log.Printf("Error parsing message: %v", err)
            continue
        }

        if err := w.processJob(event); err != nil {
            log.Printf("Job failed for video %s: %v", event.VideoID, err)
        }
    }
}

func (w *TranscodeWorker) processJob(event VideoUploadedEvent) error {
    log.Printf("Starting transcode for video %s", event.VideoID)

    jobID := uuid.New()
    _, err := w.db.Exec(
        `INSERT INTO transcode_jobs (id, video_id, input_path, status, created_at)
         VALUES ($1, $2, $3, 'processing', NOW())`,
        jobID, event.VideoID, event.StoragePath,
    )
    if err != nil {
        return fmt.Errorf("failed to create job: %w", err)
    }

    workDir := filepath.Join(w.workDir, event.VideoID)
    os.MkdirAll(workDir, 0755)

    inputPath := filepath.Join(workDir, "input"+filepath.Ext(event.Filename))

    err = w.minio.FGetObject(context.Background(), 
        "streamly-uploads", 
        event.StoragePath, 
        inputPath, 
        minio.GetObjectOptions{},
    )
    if err != nil {
        w.updateJobStatus(jobID, "failed", 0, err.Error())
        return fmt.Errorf("failed to download: %w", err)
    }

    outputs, err := w.ffmpeg.Transcode(inputPath, workDir, processor.StandardProfiles)
    if err != nil {
        w.updateJobStatus(jobID, "failed", 0, err.Error())
        return fmt.Errorf("transcode failed: %w", err)
    }

    dashManifest, err := w.ffmpeg.PackageDASH(workDir, outputs)
    if err != nil {
        log.Printf("DASH packaging warning: %v", err)
    }

    hlsManifest, err := w.ffmpeg.PackageHLS(workDir, outputs)
    if err != nil {
        log.Printf("HLS packaging warning: %v", err)
    }

    thumbPath := filepath.Join(workDir, "thumbnail.jpg")
    w.ffmpeg.ExtractThumbnail(inputPath, thumbPath, "00:00:05")

    processedPrefix := fmt.Sprintf("processed/%s", event.VideoID)

    if dashManifest != "" {
        w.uploadDirectory(workDir, "streamly-processed", processedPrefix+"/dash")
    }

    if hlsManifest != "" {
        w.uploadDirectory(workDir, "streamly-processed", processedPrefix+"/hls")
    }

    w.minio.FPutObject(context.Background(),
        "streamly-thumbnails",
        fmt.Sprintf("%s/default.jpg", event.VideoID),
        thumbPath,
        minio.PutObjectOptions{ContentType: "image/jpeg"},
    )

    videoUrls := map[string]interface{}{}
    if dashManifest != "" {
        videoUrls["dash"] = fmt.Sprintf("http://localhost:9000/streamly-processed/%s/dash/manifest.mpd", event.VideoID)
    }
    if hlsManifest != "" {
        videoUrls["hls"] = fmt.Sprintf("http://localhost:9000/streamly-processed/%s/hls/master.m3u8", event.VideoID)
    }

    thumbUrls := map[string]interface{}{
        "default": fmt.Sprintf("http://localhost:9000/streamly-thumbnails/%s/default.jpg", event.VideoID),
    }

    duration := w.getVideoDuration(inputPath)

    _, err = w.db.Exec(
        `UPDATE videos 
         SET status = 'ready',
             duration_seconds = $1,
             video_urls = $2,
             thumbnail_urls = $3,
             updated_at = NOW()
         WHERE id = $4`,
        duration, videoUrls, thumbUrls, event.VideoID,
    )

    w.updateJobStatus(jobID, "completed", 100, "")

    os.RemoveAll(workDir)

    log.Printf("Transcode completed for video %s", event.VideoID)
    return nil
}

func (w *TranscodeWorker) updateJobStatus(jobID uuid.UUID, status string, progress int, errorMsg string) {
    w.db.Exec(
        `UPDATE transcode_jobs 
         SET status = $1, progress = $2, error_message = $3,
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = $4`,
        status, progress, errorMsg, jobID,
    )
}

func (w *TranscodeWorker) uploadDirectory(localDir, bucket, prefix string) {
    filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
        if info.IsDir() {
            return nil
        }

        relPath, _ := filepath.Rel(localDir, path)
        objectName := filepath.Join(prefix, relPath)

        contentType := "application/octet-stream"
        if filepath.Ext(path) == ".m4s" || filepath.Ext(path) == ".mp4" {
            contentType = "video/mp4"
        } else if filepath.Ext(path) == ".m3u8" {
            contentType = "application/vnd.apple.mpegurl"
        } else if filepath.Ext(path) == ".mpd" {
            contentType = "application/dash+xml"
        }

        w.minio.FPutObject(context.Background(), bucket, objectName, path,
            minio.PutObjectOptions{ContentType: contentType})

        return nil
    })
}

func (w *TranscodeWorker) getVideoDuration(inputPath string) int {
    cmd := exec.Command("ffprobe", 
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        inputPath,
    )
    out, _ := cmd.Output()
    duration, _ := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
    return int(duration)
}