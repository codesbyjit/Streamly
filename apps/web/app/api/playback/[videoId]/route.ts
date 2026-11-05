import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const token = request.cookies.get("streamly_access")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const upstream = await fetch(`${API}/api/v1/stream/${encodeURIComponent(videoId)}/playback`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store"
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}