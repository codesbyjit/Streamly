"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/video-player";

type Video = { id: string; title: string; description?: string; status: string; visibility: string };
type Playback = { manifestUrl: string };

export function WatchPage({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [message, setMessage] = useState("Loading video…");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [videoResponse, playbackResponse] = await Promise.all([
          fetch(`/api/videos/${encodeURIComponent(videoId)}`),
          fetch(`/api/playback/${encodeURIComponent(videoId)}`)
        ]);
        const videoData = await videoResponse.json();
        const playbackData = await playbackResponse.json();
        if (!videoResponse.ok) throw new Error(videoData.message ?? "Video not found");
        if (!playbackResponse.ok) throw new Error(playbackData.message ?? "Video is processing or playback is unavailable");
        if (alive) { setVideo(videoData.data); setPlayback(playbackData); setMessage(""); }
      } catch (e) { if (alive) setMessage(e instanceof Error ? e.message : "Could not load video"); }
    }
    load();
    return () => { alive = false; };
  }, [videoId]);

  return <div className="watch-page">
    <Link href="/" className="back-link">← Back to explore</Link>
    {playback ? <VideoPlayer src={playback.manifestUrl} /> : <div className="player-placeholder">{message}</div>}
    {video && <div className="watch-details"><h1>{video.title}</h1><p>{video.description}</p></div>}
  </div>;
}