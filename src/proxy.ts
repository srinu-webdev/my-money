import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Route protection before any page code runs (Next.js 16 "proxy" —
// successor to middleware.ts, runs on the Node.js runtime). Public
// routes: the marketing landing page ("/"), "/login" and "/signup".
// Everything else requires a valid signed session cookie.
const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);
const COOKIE_NAME = "lendpro_session";

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Vercel Cron calls this server-to-server with no session cookie at
  // all — it authenticates itself via the route's own CRON_SECRET check,
  // so it must never hit the login redirect meant for browser sessions.
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(req);

  if ((pathname === "/login" || pathname === "/signup") && authed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (!PUBLIC_PATHS.has(pathname) && !authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
