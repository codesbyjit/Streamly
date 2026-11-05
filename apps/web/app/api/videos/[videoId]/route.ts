import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const upstream = await fetch(`${API}/api/v1/content/${encodeURIComponent(videoId)}`, { cache: "no-store" });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}