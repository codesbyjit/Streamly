"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "register" ? { displayName: name, email, password } : { email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.error ?? "Authentication failed");
      router.push("/");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  return <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
    <Link href="/" className="brand auth-brand"><span className="brand-mark">s</span>streamly</Link>
    <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
    <p className="muted">Sign in to continue to Streamly.</p>
    {mode === "register" && <label>Display name<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>}
    <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Password<input required type="password" minLength={mode === "register" ? 12 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button primary full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
    <p className="auth-switch">{mode === "login" ? "New to Streamly?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create account" : "Sign in"}</button></p>
  </form></div>;
}