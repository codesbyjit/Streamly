import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { runCommand } from "./commands.js";
import { downloadObject, uploadFile } from "./storage.js";
import { logger } from "./logger.js";
import type { ProcessingCompletedEvent, Rendition, VideoUploadedEvent } from "./types.js";

function getField(event: VideoUploadedEvent, field: "videoId" | "ownerId" | "bucket" | "objectKey" | "contentType" | "sizeBytes") {
  return event.data?.[field] ?? event[field];
}

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new Error("videoId must contain only letters, numbers, underscores, and hyphens");
  }
  return value;
}

async function probe(sourcePath: string): Promise<{ width: number; height: number; duration: number }> {
  const result = await runCommand(config.FFPROBE_PATH, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    sourcePath
  ]);
  const parsed = JSON.parse(result.stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  const duration = Number(parsed.format?.duration);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("Source has no readable video stream");
  }
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Source duration is invalid");
  return { width, height, duration };
}

async function createThumbnail(sourcePath: string, outputPath: string, duration: number): Promise<void> {
  const at = Math.max(0, Math.min(duration * 0.1, Math.max(0, duration - 0.2)));
  await runCommand(config.FFMPEG_PATH, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", at.toFixed(3), "-i", sourcePath,
    "-frames:v", "1", "-vf", "scale=640:-2",
    "-q:v", "3", outputPath
  ]);
}

async function transcodeRendition(
  sourcePath: string,
  outputDir: string,
  height: number,
  videoId: string
): Promise<{ height: number; width: number; bandwidth: number; playlistKey: string }> {
  await mkdir(outputDir, { recursive: true });
  const playlistPath = path.join(outputDir, "index.m3u8");
  const segmentPattern = path.join(outputDir, "segment_%05d.ts");
  const scale = `scale=-2:${height}:force_original_aspect_ratio=decrease`;
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourcePath,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", scale,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    "-f", "hls",
    "-hls_time", String(config.HLS_SEGMENT_SECONDS),
    "-hls_playlist_type", "vod",
    "-hls_segment_filename", segmentPattern,
    playlistPath
  ];
  await runCommand(config.FFMPEG_PATH, args);
  const playlist = await (await import("node:fs/promises")).readFile(playlistPath, "utf8");
  const segmentCount = (playlist.match(/\.ts(?:\?|$)/gm) ?? []).length;
  if (!playlist.includes("#EXTM3U") || segmentCount === 0) {
    throw new Error(`FFmpeg produced an invalid HLS playlist for ${height}p`);
  }
  // Approximate average bandwidth; a production system should measure output bytes/duration.
  const files = await readdir(outputDir);
  let bytes = 0;
  for (const name of files.filter((f) => f.endsWith(".ts"))) {
    bytes += (await stat(path.join(outputDir, name))).size;
  }
  const playlistKey = `hls/${videoId}/${height}p/index.m3u8`;
  return {
    height,
    width: Math.round(height * 16 / 9),
    bandwidth: Math.max(250_000, Math.round((bytes * 8) / Math.max(1, segmentCount * config.HLS_SEGMENT_SECONDS))),
    playlistKey
  };
}

async function uploadDirectory(bucket: string, localDir: string, prefix: string): Promise<void> {
  const entries = await readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDirectory(bucket, fullPath, `${prefix}/${entry.name}`);
    } else {
      const contentType = entry.name.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : entry.name.endsWith(".ts")
          ? "video/mp2t"
          : "application/octet-stream";
      await uploadFile(bucket, `${prefix}/${entry.name}`, fullPath, contentType);
    }
  }
}

function masterPlaylist(renditions: Rendition[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const rendition of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
      `${rendition.height}p/index.m3u8`
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function transcodeUploadedVideo(event: VideoUploadedEvent): Promise<ProcessingCompletedEvent> {
  const videoId = safeId(String(getField(event, "videoId") ?? ""));
  const ownerId = getField(event, "ownerId") ? String(getField(event, "ownerId")) : undefined;
  const bucket = String(getField(event, "bucket") ?? config.S3_BUCKET);
  const objectKey = String(getField(event, "objectKey") ?? "");
  if (!objectKey || objectKey.startsWith("/") || objectKey.split("/").includes("..")) {
    throw new Error("objectKey is missing or invalid");
  }

  const jobDir = path.resolve(config.WORK_DIR, `${videoId}-${randomUUID()}`);
  const sourcePath = path.join(jobDir, "source.bin");
  const outputRoot = path.join(jobDir, "output");
  const thumbnailPath = path.join(jobDir, "thumbnail.jpg");
  await mkdir(outputRoot, { recursive: true });
  logger.info({ videoId, objectKey, bucket }, "Video transcode started");

  try {
    await downloadObject(bucket, objectKey, sourcePath);
    const metadata = await probe(sourcePath);
    await createThumbnail(sourcePath, thumbnailPath, metadata.duration);

    const eligible = config.resolutions.filter((height) => height <= metadata.height);
    // A small source still needs one playable rendition.
    const targetHeights = eligible.length ? eligible : [Math.min(metadata.height, 360)];
    const renditions: Rendition[] = [];

    for (const height of targetHeights) {
      const outputDir = path.join(outputRoot, `${height}p`);
      const generated = await transcodeRendition(sourcePath, outputDir, height, videoId);
      const prefix = `hls/${videoId}/${height}p`;
      await uploadDirectory(bucket, outputDir, prefix);
      renditions.push({
        height,
        width: Math.min(metadata.width, Math.round(height * metadata.width / metadata.height)),
        playlistKey: generated.playlistKey,
        bandwidth: generated.bandwidth
      });
    }

    const masterPath = path.join(outputRoot, "master.m3u8");
    const masterText = masterPlaylist(renditions);
    await (await import("node:fs/promises")).writeFile(masterPath, masterText, "utf8");
    await uploadFile(bucket, `hls/${videoId}/master.m3u8`, masterPath, "application/vnd.apple.mpegurl");
    await uploadFile(bucket, `thumbnails/${videoId}/thumbnail.jpg`, thumbnailPath, "image/jpeg");

    const result: ProcessingCompletedEvent = {
      eventId: randomUUID(),
      eventType: "video.processing.completed",
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        videoId,
        ...(ownerId ? { ownerId } : {}),
        status: "READY",
        bucket,
        masterPlaylistKey: `hls/${videoId}/master.m3u8`,
        thumbnailKey: `thumbnails/${videoId}/thumbnail.jpg`,
        renditions,
        durationSeconds: Math.round(metadata.duration * 1000) / 1000,
        sourceObjectKey: objectKey
      }
    };
    logger.info({ videoId, renditions: renditions.map((r) => r.height) }, "Video transcode completed");
    return result;
  } finally {
    if (config.cleanupWorkDir) {
      await rm(jobDir, { recursive: true, force: true }).catch((error: unknown) => {
        logger.warn({ videoId, error }, "Failed to clean temporary work directory");
      });
    }
  }
}
