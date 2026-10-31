import { SignJWT } from "jose";
import { config } from "../config.js";
import type { VideoAsset } from "../types.js";
import type { VideoAssetsRepository } from "../repositories/video-assets.repository.js";

export class PlaybackError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code: string) {
    super(message);
  }
}

export class PlaybackService {
  constructor(private readonly assets: VideoAssetsRepository) {}

  async getPlayback(videoId: string, userId: string) {
    const asset = await this.assets.findById(videoId);
    if (!asset || asset.status === "DELETED") {
      throw new PlaybackError(404, "Video not found", "video_not_found");
    }
    if (asset.status !== "READY") {
      throw new PlaybackError(409, "Video is not ready for playback", "video_not_ready");
    }
    if (asset.visibility === "PRIVATE" && asset.ownerId !== userId) {
      throw new PlaybackError(403, "You do not have access to this video", "forbidden");
    }

    const now = Math.floor(Date.now() / 1000);
    const playbackToken = await new SignJWT({
      videoId: asset.videoId,
      ownerId: asset.ownerId,
      visibility: asset.visibility
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("streamly-streaming-service")
      .setAudience("streamly-playback")
      .setSubject(userId)
      .setIssuedAt(now)
      .setExpirationTime(now + config.PLAYBACK_TOKEN_TTL_SECONDS)
      .sign(new TextEncoder().encode(config.PLAYBACK_TOKEN_SECRET));

    const manifestUrl = await this.publicAssetUrl(asset.masterManifestKey);
    return {
      videoId: asset.videoId,
      protocol: "HLS",
      manifestUrl,
      playbackToken,
      tokenExpiresInSeconds: config.PLAYBACK_TOKEN_TTL_SECONDS,
      durationSeconds: asset.durationSeconds,
      dimensions: asset.width && asset.height ? { width: asset.width, height: asset.height } : null,
      renditions: asset.renditions.map((r) => ({
        label: r.label,
        width: r.width,
        height: r.height,
        bandwidth: r.bandwidth,
        playlistUrl: this.buildPublicAssetUrl(r.playlistKey)
      }))
    };
  }

  private async publicAssetUrl(key: string) {
    return this.buildPublicAssetUrl(key);
  }

  private buildPublicAssetUrl(key: string) {
    // Encode each path segment, preserving "/" separators.
    return `${config.PLAYBACK_BASE_URL.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
