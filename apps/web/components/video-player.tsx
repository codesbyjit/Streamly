"use client";

import { useEffect, useRef, useState } from "react";

export function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let player: import("shaka-player").Player | undefined;
    let disposed = false;

    async function load() {
      const shaka = await import("shaka-player");
      if (disposed || !videoRef.current) return;
      shaka.default.polyfill.installAll();
      if (!shaka.default.Player.isBrowserSupported()) {
        videoRef.current.src = src;
        return;
      }
      player = new shaka.default.Player();
      await player.attach(videoRef.current);
      player.addEventListener("error", () => setError("Playback failed. The HLS manifest may not be available yet."));
      try { await player.load(src); }
      catch { setError("This video is not ready to play yet."); }
    }

    load().catch(() => setError("Could not initialize the video player."));
    return () => { disposed = true; player?.destroy(); };
  }, [src]);

  return <div className="player-wrap"><video ref={videoRef} controls playsInline autoPlay className="player" />{error && <div className="player-error">{error}</div>}</div>;
}