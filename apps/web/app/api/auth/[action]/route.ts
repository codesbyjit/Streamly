import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_GATEWAY_URL ?? "http://localhost:4000";
const ACCESS = "streamly_access";
const REFRESH = "streamly_refresh";

type Context = { params: Promise<{ action: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const { action } = await params;
  if (!["login", "register", "refresh", "logout"].includes(action)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const refreshToken = request.cookies.get(REFRESH)?.value;
  const payload = action === "refresh" || action === "logout"
    ? { refreshToken }
    : body;

  const upstream = await fetch(`${API}/api/v1/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const data = await upstream.json().catch(() => ({}));

  const response = NextResponse.json(data, {
    status: upstream.status
  });

  if (upstream.ok && data.accessToken) {
    response.cookies.set(ACCESS, data.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60
    });
  }

  if (action === "logout" || (action === "refresh" && !upstream.ok)) {
    response.cookies.set(ACCESS, "", { httpOnly: true, path: "/", maxAge: 0 });
    response.cookies.set(REFRESH, "", { httpOnly: true, path: "/", maxAge: 0 });
  }

  return response;
}

export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params;
  if (action !== "me") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let token = request.cookies.get(ACCESS)?.value;
  let upstream = token ? await fetch(`${API}/api/v1/auth/me`, {
    headers: { authorization: `Bearer ${token}` }, cache: "no-store"
  }) : null;

  if (!upstream || upstream.status === 401) {
    const refreshToken = request.cookies.get(REFRESH)?.value;
    if (refreshToken) {
      const refreshed = await fetch(`${API}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }), cache: "no-store"
      });
      const session = await refreshed.json().catch(() => ({}));
      if (refreshed.ok && session.accessToken) {
        token = session.accessToken;
        upstream = await fetch(`${API}/api/v1/auth/me`, {
          headers: { authorization: `Bearer ${token}` }, cache: "no-store"
        });
        const response = NextResponse.json(await upstream.json(), { status: upstream.status });
        response.cookies.set(ACCESS, token, {
          httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
          path: "/", maxAge: 15 * 60
        });
        response.cookies.set(REFRESH, session.refreshToken, {
          httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
          path: "/", maxAge: 30 * 24 * 60 * 60
        });
        return response;
      }
    }
  }

  if (!upstream) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const response = NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  if (upstream.status === 401) {
    response.cookies.set(ACCESS, "", { httpOnly: true, path: "/", maxAge: 0 });
    response.cookies.set(REFRESH, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return response;
}