import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

function decodeSubject(token?: string) {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString()).sub as string;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("streamly_access")?.value;
  const userId = decodeSubject(token);
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await request.json();
  const upstream = await fetch(`${API}/api/v1/upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dev-user-id": userId
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}