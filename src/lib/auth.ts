import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// Real, server-side authentication: bcrypt-hashed passwords (never
// plaintext), a signed JWT in an HttpOnly cookie, verified in
// middleware.ts on every request to a protected route. This replaces
// the original prototype's localStorage-only "auth".

const COOKIE_NAME = "lendpro_session";
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours when "remember me" is off

function secretKey() {
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
  [key: string]: unknown;
}

export async function createSessionCookie(adminId: string, remember: boolean): Promise<void> {
  const maxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const loginAt = new Date().toISOString();
  const token = await new SignJWT({ adminId, loginAt, remember })
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

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as SessionPayload;
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
