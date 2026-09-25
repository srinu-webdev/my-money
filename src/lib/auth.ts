import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Real, server-side authentication: bcrypt-hashed passwords (never
// plaintext), a signed JWT in an HttpOnly cookie, verified in
// middleware.ts on every request to a protected route. This replaces
// the original prototype's localStorage-only "auth".

const COOKIE_NAME = "lendpro_session";
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours when "remember me" is off

export function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionPayload {
  adminId: string;
  loginAt: string;
  remember: boolean;
  /** admin.passwordChangedAt (ISO) at the moment this session was issued — see getSessionPayload's revocation check. */
  pwdAt: string;
  [key: string]: unknown;
}

export async function createSessionCookie(adminId: string, remember: boolean, passwordChangedAt: Date): Promise<void> {
  const maxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const loginAt = new Date().toISOString();
  const token = await new SignJWT({ adminId, loginAt, remember, pwdAt: passwordChangedAt.toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Omitting maxAge makes it a browser-session cookie (cleared on close)
    // when "remember me" is unchecked; matches the original's intent.
    ...(remember ? { maxAge } : {}),
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Revocation check: a session issued before the admin's most recent
// password change (or belonging to an admin that no longer exists) is
// rejected, even though its signature and expiration are still valid —
// otherwise a stolen cookie would keep working for its full lifetime (up
// to 30 days) after the legitimate admin noticed the compromise and
// changed their password, or after that admin account was deleted.
//
// Exported so BOTH getSessionPayload() below (used by pages/Server
// Actions) AND proxy.ts's own request-level check use the exact same
// rule — if the two ever disagreed (proxy saying "authed", a page saying
// "not"), a stale-but-signature-valid cookie would bounce the browser in
// an infinite redirect loop between /login and the protected page instead
// of cleanly landing on the login screen.
export async function isSessionPayloadValid(payload: SessionPayload): Promise<boolean> {
  const admin = await prisma.admin.findUnique({ where: { id: payload.adminId }, select: { passwordChangedAt: true } });
  return !!admin && admin.passwordChangedAt.toISOString() === payload.pwdAt;
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const session = payload as SessionPayload;
    if (!(await isSessionPayloadValid(session))) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth check for Server Actions: middleware already blocks
 * unauthenticated page loads, but an action function is still directly
 * invokable, so every mutating action re-verifies the session itself.
 */
export async function requireAdminId(): Promise<string> {
  const session = await getSessionPayload();
  if (!session) throw new Error("Not authenticated.");
  return session.adminId;
}

export { COOKIE_NAME as SESSION_COOKIE_NAME };
