"use server";

import { prisma } from "@/lib/db";
import { createSessionCookie, destroySessionCookie, hashPassword, requireAdminId, verifyPassword } from "@/lib/auth";
import { loginSchema, signupSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";
import { redirect } from "next/navigation";

export type LoginState = ActionResult;
export type SignupState = ActionResult;

export async function loginAction(_prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, remember } = parsed.data;

  // TODO(production): add rate limiting / lockout after repeated failures.
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin) return { ok: false, error: "Invalid email or password. Try admin@example.com / admin123" };
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) return { ok: false, error: "Invalid email or password. Try admin@example.com / admin123" };

  await createSessionCookie(admin.id, remember);
  await prisma.activity.create({ data: { type: "admin_login", description: `${admin.name} logged in` } });
  // `redirect()` throws internally — the client's useActionState never
  // sees a return value on success, it just navigates.
  redirect("/dashboard?welcome=1");
}

export async function signupAction(_prevState: SignupState | null, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { ok: false, error: "An account with that email already exists. Try logging in instead." };

  // TODO(production): add rate limiting / captcha to this endpoint before
  // exposing it publicly — nothing currently caps how many accounts can be
  // created, since every admin shares the same business data (there's no
  // per-tenant isolation, by design, for a single lending business).
  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.create({
    data: { name, email: email.toLowerCase(), phone: phone || null, passwordHash, role: "Administrator" },
  });

  await createSessionCookie(admin.id, true);
  await prisma.activity.create({ data: { type: "admin_login", description: `${admin.name} created an account and logged in` } });
  redirect("/dashboard?welcome=1");
}

export async function logoutAction(): Promise<void> {
  const adminId = await requireAdminId().catch(() => null);
  if (adminId) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (admin) await prisma.activity.create({ data: { type: "admin_logout", description: `${admin.name} logged out` } });
  }
  await destroySessionCookie();
  redirect("/");
}
