package processor

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "strconv"
    "strings"
)

// ResolutionProfile defines output parameters
type ResolutionProfile struct {
    Name     string
    Width    int
    Height   int
    VideoBitrate string
    AudioBitrate string
    Codec    string
}

var StandardProfiles = []ResolutionProfile{
    {Name: "2160p", Width: 3840, Height: 2160, VideoBitrate: "15000k", AudioBitrate: "192k", Codec: "libx264"},
    {Name: "1440p", Width: 2560, Height: 1440, VideoBitrate: "8000k", AudioBitrate: "192k", Codec: "libx264"},
    {Name: "1080p", Width: 1920, Height: 1080, VideoBitrate: "4000k", AudioBitrate: "128k", Codec: "libx264"},
    {Name: "720p",  Width: 1280, Height: 720,  VideoBitrate: "2500k", AudioBitrate: "128k", Codec: "libx264"},
    {Name: "480p",  Width: 854,  Height: 480,  VideoBitrate: "1000k", AudioBitrate: "96k",  Codec: "libx264"},
    {Name: "360p",  Width: 640,  Height: 360,  VideoBitrate: "500k",  AudioBitrate: "96k",  Codec: "libx264"},
    {Name: "240p",  Width: 426,  Height: 240,  VideoBitrate: "300k",  AudioBitrate: "64k",  Codec: "libx264"},
}

type FFmpegProcessor struct {
    workDir string
}

func NewFFmpegProcessor(workDir string) *FFmpegProcessor {
    return &FFmpegProcessor{workDir: workDir}
}

func (p *FFmpegProcessor) Transcode(inputPath, outputDir string, profiles []ResolutionProfile) ([]TranscodeOutput, error) {
    var outputs []TranscodeOutput

    for _, profile := range profiles {
        outputFile := filepath.Join(outputDir, fmt.Sprintf("%s.mp4", profile.Name))

        cmd := exec.Command("ffmpeg",
            "-i", inputPath,
            "-vf", fmt.Sprintf("scale=%d:%d", profile.Width, profile.Height),
            "-c:v", profile.Codec,
            "-b:v", profile.VideoBitrate,
            "-c:a", "aac",
            "-b:a", profile.AudioBitrate,
            "-movflags", "+faststart",
            "-y",
            outputFile,
        )

        cmd.Stdout = os.Stdout
        cmd.Stderr = os.Stderr

        if err := cmd.Run(); err != nil {
            return outputs, fmt.Errorf("failed to transcode %s: %w", profile.Name, err)
        }

        info, _ := os.Stat(outputFile)

        outputs = append(outputs, TranscodeOutput{
            Resolution: profile.Name,
            Codec:      profile.Codec,
            Bitrate:    parseBitrate(profile.VideoBitrate),
            FilePath:   outputFile,
            FileSize:   info.Size(),
        })
    }

    return outputs, nil
}

func (p *FFmpegProcessor) PackageDASH(outputDir string, outputs []TranscodeOutput) (string, error) {
    args := []string{}

    for _, out := range outputs {
        args = append(args, "-i", out.FilePath)
    }

    streamIdx := 0
    for i := range outputs {
        args = append(args, "-map", fmt.Sprintf("%d:v", i))
        args = append(args, "-map", fmt.Sprintf("%d:a", i))
    }

    args = append(args, "-c", "copy")

    args = append(args,
        "-f", "dash",
        "-use_template", "1",
        "-use_timeline", "1",
        "-adaptation_sets", "id=0,streams=v id=1,streams=a",
        "-init_seg_name", "init-$RepresentationID$.m4s",
        "-media_seg_name", "chunk-$RepresentationID$-$Number$.m4s",
        filepath.Join(outputDir, "manifest.mpd"),
    )

    cmd := exec.Command("ffmpeg", args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr

    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("DASH packaging failed: %w", err)
    }

    return filepath.Join(outputDir, "manifest.mpd"), nil
}

func (p *FFmpegProcessor) PackageHLS(outputDir string, outputs []TranscodeOutput) (string, error) {
    masterPlaylist := filepath.Join(outputDir, "master.m3u8")

    var masterContent strings.Builder
    masterContent.WriteString("#EXTM3U
")
    masterContent.WriteString("#EXT-X-VERSION:4
")

    for _, out := range outputs {
        bandwidth := parseBitrate(out.Bitrate) * 1000
        masterContent.WriteString(fmt.Sprintf(
            "#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%s
",
            bandwidth, out.Resolution,
        ))
        masterContent.WriteString(fmt.Sprintf("%s/playlist.m3u8
", out.Resolution))

        variantDir := filepath.Join(outputDir, out.Resolution)
        os.MkdirAll(variantDir, 0755)

        cmd := exec.Command("ffmpeg",
            "-i", out.FilePath,
            "-codec:", "copy",
            "-start_number", "0",
            "-hls_time", "10",
            "-hls_list_size", "0",
            "-hls_segment_filename", filepath.Join(variantDir, "segment_%03d.ts"),
            "-f", "hls",
            filepath.Join(variantDir, "playlist.m3u8"),
        )

        if err := cmd.Run(); err != nil {
            return "", fmt.Errorf("HLS packaging failed for %s: %w", out.Resolution, err)
        }
    }

    if err := os.WriteFile(masterPlaylist, []byte(masterContent.String()), 0644); err != nil {
        return "", err
    }

    return masterPlaylist, nil
}

func (p *FFmpegProcessor) ExtractThumbnail(inputPath, outputPath string, timestamp string) error {
    cmd := exec.Command("ffmpeg",
        "-i", inputPath,
        "-ss", timestamp,
        "-vframes", "1",
        "-q:v", "2",
        outputPath,
    )
    return cmd.Run()
}

type TranscodeOutput struct {
    Resolution string
    Codec      string
    Bitrate    int
    FilePath   string
    FileSize   int64
}

func parseBitrate(bitrate string) int {
    num := strings.TrimSuffix(bitrate, "k")
    n, _ := strconv.Atoi(num)
    return n
}