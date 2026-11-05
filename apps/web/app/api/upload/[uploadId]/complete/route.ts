import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

function decodeSubject(token?: string) {
  if (!token) return null;
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub as string; }
  catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const userId = decodeSubject(request.cookies.get("streamly_access")?.value);
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const upstream = await fetch(`${API}/api/v1/upload/${encodeURIComponent(uploadId)}/complete`, {
    method: "POST", headers: { "x-dev-user-id": userId }, cache: "no-store"
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}