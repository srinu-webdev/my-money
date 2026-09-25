"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminId, hashPassword, verifyPassword, createSessionCookie, getSessionPayload } from "@/lib/auth";
import { profileSchema, passwordSchema } from "@/lib/validations";
import { logActivity } from "@/lib/log";
import type { ActionResult } from "@/lib/types";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const clash = await prisma.admin.findFirst({ where: { email: d.email, NOT: { id: adminId } } });
  if (clash) return { ok: false, error: "That email is already in use." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.admin.update({ where: { id: adminId }, data: { name: d.name, email: d.email, phone: d.phone || null } });
      await logActivity(tx, "profile_updated", "Admin profile updated", { customerId: null });
    });
  } catch (e) {
    // The findFirst check above narrows this to a genuine race (two
    // concurrent edits to the same new email) rather than the common case.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That email is already in use." };
    }
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const adminId = await requireAdminId();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) return { ok: false, error: "Session expired." };
  const valid = await verifyPassword(d.current, admin.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };
  // Read the current session's "remember me" flag BEFORE bumping
  // passwordChangedAt below — once that write commits, this same cookie's
  // embedded pwdAt no longer matches the DB and getSessionPayload would
  // reject it too, same as any other now-stale session.
  const currentSession = await getSessionPayload();
  const passwordHash = await hashPassword(d.next);
  const passwordChangedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash, passwordChangedAt } });
    await logActivity(tx, "profile_updated", "Admin password changed");
  });
  // Bumping passwordChangedAt invalidates every outstanding session for
  // this account, including — without this — the admin's own current one.
  // Re-issue the cookie immediately so the admin who just changed their
  // password stays logged in, while every OTHER session is now rejected.
  await createSessionCookie(adminId, currentSession?.remember ?? false, passwordChangedAt);
  return { ok: true, data: undefined };
}

// TODO(production): store the avatar in object storage (e.g. a Supabase
// Storage bucket) and save its URL instead of a base64 data URI in the DB.
export async function updateAvatarAction(dataUrl: string | null): Promise<ActionResult> {
  const adminId = await requireAdminId();
  if (dataUrl && dataUrl.length > 700_000) return { ok: false, error: "Image is too large." };
  await prisma.admin.update({ where: { id: adminId }, data: { avatar: dataUrl } });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
