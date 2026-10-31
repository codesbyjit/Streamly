import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { Rendition } from '../types.js';

const renditionMap: Record<string, Rendition> = {
  '360p': { name: '360p', width: 640, height: 360, bitrate: '800k' },
  '480p': { name: '480p', width: 854, height: 480, bitrate: '1400k' },
  '720p': { name: '720p', width: 1280, height: 720, bitrate: '2800k' },
  '1080p': { name: '1080p', width: 1920, height: 1080, bitrate: '5000k' }
};

function run(command: string, args: string[], timeoutMs = config.TRANSCODE_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (d: string) => { stdout += d; });
    child.stderr.setEncoding('utf8').on('data', (d: string) => {
      stderr += d;
      if (stderr.length > 30000) stderr = stderr.slice(-30000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Could not execute ${command}: ${error.message}`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed (code=${code}, signal=${signal}): ${stderr.slice(-5000)}`));
    });
  });
}

export interface MediaInfo {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export async function probeMedia(inputPath: string): Promise<MediaInfo> {
  const output = await run(config.FFPROBE_PATH, [
    '-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height',
    '-of', 'json', inputPath
  ], 60000);
  const parsed = JSON.parse(output) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  };
  const durationSeconds = Number(parsed.format?.duration);
  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !video?.width || !video.height) {
    throw new Error('Input does not contain a valid video stream');
  }
  if (durationSeconds > config.MAX_VIDEO_SECONDS) {
    throw new Error(`Video duration exceeds MAX_VIDEO_SECONDS (${durationSeconds}s)`);
  }
  return {
    durationSeconds,
    width: video.width,
    height: video.height,
    hasAudio: Boolean(parsed.streams?.some((s) => s.codec_type === 'audio'))
  };
}

export async function createThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await run(config.FFMPEG_PATH, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(config.THUMBNAIL_SECONDS), '-i', inputPath,
    '-frames:v', '1', '-vf', 'scale=640:-2',
    '-q:v', '3', outputPath
  ], 120000);
}

export async function transcodeHls(inputPath: string, outputDir: string, info: MediaInfo): Promise<Rendition[]> {
  await mkdir(outputDir, { recursive: true });
  const selected = config.renditions
    .map((name) => renditionMap[name])
    .filter((r): r is Rendition => Boolean(r))
    .filter((r) => r.width <= info.width && r.height <= info.height)
    .sort((a, b) => a.height - b.height);

  if (!selected.length) {
    // Small sources are encoded to a single rendition no larger than source.
    selected.push({
      name: `${info.height}p`,
      width: info.width,
      height: info.height,
      bitrate: '1000k'
    });
  }

  const completed: Rendition[] = [];
  for (const rendition of selected) {
    const dir = path.join(outputDir, rendition.name);
    await mkdir(dir, { recursive: true });
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      '-map', '0:v:0',
      '-vf', `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
      '-c:v', 'libx264', '-preset', 'veryfast',
      '-b:v', rendition.bitrate, '-maxrate', rendition.bitrate,
      '-bufsize', rendition.bitrate,
      '-pix_fmt', 'yuv420p',
      '-sc_threshold', '0',
      '-force_key_frames', `expr:gte(t,n_forced*${config.HLS_SEGMENT_SECONDS})`
    ];
    if (info.hasAudio) {
      args.push('-map', '0:a:0?', '-c:a', 'aac', '-b:a', '128k', '-ac', '2');
    } else {
      args.push('-an');
    }
    args.push(
      '-f', 'hls',
      '-hls_time', String(config.HLS_SEGMENT_SECONDS),
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(dir, 'segment_%05d.ts'),
      path.join(dir, 'index.m3u8')
    );
    await run(config.FFMPEG_PATH, args);
    completed.push(rendition);
  }

  const master = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    ...completed.flatMap((r) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(parseInt(r.bitrate, 10) * 1000 * 1.25)},RESOLUTION=${r.width}x${r.height}`,
      `${r.name}/index.m3u8`
    ]),
    ''
  ].join('\n');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(outputDir, 'master.m3u8'), master, 'utf8');
  return completed;
}
