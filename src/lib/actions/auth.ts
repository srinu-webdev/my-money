"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSessionCookie, destroySessionCookie, hashPassword, requireAdminId, verifyPassword } from "@/lib/auth";
import { loginSchema, signupSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";
import { redirect } from "next/navigation";

export type LoginState = ActionResult;
export type SignupState = ActionResult;

// Sentinels thrown inside signupAction's transaction to short-circuit it
// without committing anything — caught right below and translated into a
// normal form error, never left to bubble up as an unhandled exception.
class SignupClosedError extends Error {}
class EmailTakenError extends Error {}

export async function loginAction(_prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, remember } = parsed.data;

  // TODO(production): add rate limiting / lockout after repeated failures.
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin) return { ok: false, error: "Invalid email or password." };
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) return { ok: false, error: "Invalid email or password." };

  await createSessionCookie(admin.id, remember, admin.passwordChangedAt);
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

  // Signup only ever bootstraps the FIRST admin account. Every admin
  // shares the same global business data (no per-tenant isolation, by
  // design, for a single lending business) — leaving signup open after
  // that would let anyone on the internet who finds this URL grant
  // themselves full access to every customer, loan, and payment. Once an
  // admin exists, new admins must be created some other way (there is
  // none yet — that's a deliberate, conservative default until an actual
  // invite flow is built).
  //
  // The count-check and the create happen inside ONE Serializable
  // transaction so two concurrent signup requests can't both slip through
  // while the table is still empty (READ COMMITTED, Postgres's default,
  // would let both see count=0 and both succeed) — Postgres's own
  // conflict detection aborts the loser with a serialization failure
  // (caught below as P2034), so at most one "first admin" can ever win.
  const passwordHash = await hashPassword(password);
  let admin;
  try {
    admin = await prisma.$transaction(
      async (tx) => {
        const adminCount = await tx.admin.count();
        if (adminCount > 0) throw new SignupClosedError();
        const existing = await tx.admin.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) throw new EmailTakenError();
        return tx.admin.create({
          data: { name, email: email.toLowerCase(), phone: phone || null, passwordHash, role: "Administrator" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e) {
    if (e instanceof SignupClosedError) return { ok: false, error: "Signup is closed. Contact an existing admin for access." };
    if (e instanceof EmailTakenError) return { ok: false, error: "An account with that email already exists. Try logging in instead." };
    // P2002: two concurrent requests raced on the same email. P2034:
    // Postgres's serializable-conflict detector aborted this transaction
    // because another one committed the first admin concurrently — either
    // way, someone else won the race, so surface the same "closed" message
    // instead of an unhandled exception reaching the client.
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
      return { ok: false, error: "Signup is closed. Contact an existing admin for access." };
    }
    throw e;
  }

  await createSessionCookie(admin.id, true, admin.passwordChangedAt);
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
