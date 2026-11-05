import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const upstream = await fetch(`${API}/api/v1/content${query ? `?${query}` : ""}`, {
    cache: "no-store"
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}

export async function POST(request: NextRequest) {
  const access = request.cookies.get("streamly_access")?.value;
  const body = await request.json();
  const upstream = await fetch(`${API}/api/v1/content`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(access ? { authorization: `Bearer ${access}` } : {})
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}