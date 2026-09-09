"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId, hashPassword, verifyPassword } from "@/lib/auth";
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
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { name: d.name, email: d.email, phone: d.phone || null } });
    await logActivity(tx, "profile_updated", "Admin profile updated", { customerId: null });
  });
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
  const passwordHash = await hashPassword(d.next);
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash } });
    await logActivity(tx, "profile_updated", "Admin password changed");
  });
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
