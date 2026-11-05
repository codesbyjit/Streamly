"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadSession = { uploadId: string; videoId: string; uploadUrl: string; requiredHeaders?: Record<string,string> };

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a video first.");
    setBusy(true); setError(""); setProgress("Creating upload session…");
    try {
      const meResponse = await fetch("/api/auth/me");
      const me = await meResponse.json();
      if (!meResponse.ok || !me.user?.id) throw new Error("Sign in before uploading.");

      const sessionResponse = await fetch("/api/upload", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "video/mp4", sizeBytes: file.size })
      });
      const sessionBody = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionBody.message ?? sessionBody.error ?? "Could not create upload session");
      const session = sessionBody.data as UploadSession;

      setProgress("Uploading video…");
      const putResponse = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: session.requiredHeaders ?? { "content-type": file.type || "video/mp4" },
        body: file
      });
      if (!putResponse.ok) throw new Error("Storage upload failed. Check the MinIO endpoint and bucket CORS settings.");

      setProgress("Completing upload…");
      const completeResponse = await fetch(`/api/upload/${session.uploadId}/complete`, { method: "POST" });
      const completeBody = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeBody.message ?? completeBody.error ?? "Could not complete upload");

      setProgress("Creating video…");
      const videoResponse = await fetch("/api/videos", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerId: me.user.id, title: title.trim(), description,
          visibility, tags: [], category: "Technology"
        })
      });
      const videoBody = await videoResponse.json();
      if (!videoResponse.ok) throw new Error(videoBody.message ?? videoBody.error ?? "Upload finished, but video metadata could not be created.");
      setProgress("Video queued for processing.");
      router.push(`/watch/${session.videoId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  }

  return <div className="upload-wrap"><form className="upload-card" onSubmit={submit}>
    <div className="section-heading"><div><p className="eyebrow">CREATOR STUDIO</p><h1>Upload video</h1></div><Link href="/" className="text-link">Cancel</Link></div>
    <label className="dropzone">
      <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <span className="upload-symbol">↑</span><strong>{file ? file.name : "Choose a video file"}</strong>
      <span className="muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "MP4, WebM, MOV or MKV"}</span>
    </label>
    <label>Title<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your video a title" /></label>
    <label>Description<textarea rows={4} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell viewers about your video" /></label>
    <label>Visibility<select value={visibility} onChange={e => setVisibility(e.target.value)}><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label>
    {progress && <p className="muted">{progress}</p>}
    {error && <p className="form-error">{error}</p>}
    <button className="button primary" disabled={busy || !file}>{busy ? "Uploading…" : "Upload video"}</button>
    <p className="hint">Keep this page open until the upload completes.</p>
  </form></div>;
}