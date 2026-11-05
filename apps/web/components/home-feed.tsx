"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Video = {
  id: string; title: string; description?: string; thumbnailUrl?: string;
  thumbnail_url?: string; ownerId?: string; owner_id?: string; status: string;
  visibility: string; createdAt?: string; created_at?: string; durationSeconds?: number;
};

const categories = ["All", "Technology", "Music", "Gaming", "Education", "Entertainment"];

function duration(value?: number) {
  if (!value || !Number.isFinite(value)) return "";
  const mins = Math.floor(value / 60);
  return `${mins}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

export function HomeFeed() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const q = query.get("q");
    fetch(`/api/videos?limit=30${category !== "All" ? `&category=${encodeURIComponent(category)}` : ""}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Could not load videos");
        return body.data ?? [];
      })
      .then((items: Video[]) => setVideos(q ? items.filter(v => v.title.toLowerCase().includes(q.toLowerCase())) : items))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [category]);

  const visible = useMemo(() => videos.filter(v => v.status === "ready" && v.visibility === "public"), [videos]);

  return (
    <section>
      <div className="category-row">
        {categories.map(item => <button key={item} className={category === item ? "chip selected" : "chip"} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="section-heading">
        <div><p className="eyebrow">YOUR NEXT WATCH</p><h1>Explore</h1></div>
        <span className="muted">{visible.length} videos</span>
      </div>
      {loading ? <div className="state">Loading videos…</div> : error ? <div className="state error">{error}</div> : visible.length === 0 ? (
        <div className="empty"><h2>Nothing here yet</h2><p>Published videos will show up here.</p><Link href="/upload" className="button primary">Upload a video</Link></div>
      ) : (
        <div className="video-grid">
          {visible.map(video => {
            const thumbnail = video.thumbnailUrl ?? video.thumbnail_url;
            return <Link className="video-card" href={`/watch/${video.id}`} key={video.id}>
              <div className="thumbnail">
                {thumbnail ? <img src={thumbnail} alt="" /> : <div className="thumbnail-placeholder">STREAMLY</div>}
                {video.durationSeconds ? <span className="duration">{duration(video.durationSeconds)}</span> : null}
              </div>
              <div className="video-meta">
                <div className="channel-avatar">S</div>
                <div><h3>{video.title}</h3><p>Streamly creator</p><p>{video.description?.slice(0, 70) || " "}</p></div>
              </div>
            </Link>;
          })}
        </div>
      )}
    </section>
  );
}