"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type User = { id: string; displayName: string; email: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null)
      .then(data => setUser(data?.user ?? null)).catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = search.trim();
    if (value) window.location.href = `/?q=${encodeURIComponent(value)}`;
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">s</span>streamly</Link>
        <form className="search" onSubmit={submitSearch}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search videos" aria-label="Search videos" />
          <button aria-label="Search" type="submit">⌕</button>
        </form>
        <div className="top-actions">
          <Link className="upload-link" href="/upload">Upload</Link>
          {user ? <button className="avatar" onClick={logout} title={`Sign out ${user.displayName}`}>{user.displayName.slice(0,1).toUpperCase()}</button> : <Link className="signin" href="/login">Sign in</Link>}
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <nav>
            <Link className={pathname === "/" ? "nav-item active" : "nav-item"} href="/">Home</Link>
            <Link className="nav-item" href="/?feed=subscriptions">Subscriptions</Link>
            <div className="nav-divider" />
            <Link className="nav-item" href="/?feed=history">History</Link>
            <Link className="nav-item" href="/upload">Your videos</Link>
          </nav>
          <div className="sidebar-note">A place for videos worth watching.</div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}