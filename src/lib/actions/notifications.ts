"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

function refresh() {
  // See lib/actions/customers.ts refresh() for why the root layout.
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  await prisma.notification.update({ where: { id }, data: { read: true } });
  refresh();
  return { ok: true, data: undefined };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  await requireAdminId();
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteNotificationAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  await prisma.notification.delete({ where: { id } });
  refresh();
  return { ok: true, data: undefined };
}

export async function clearAllNotificationsAction(): Promise<ActionResult> {
  await requireAdminId();
  await prisma.notification.deleteMany({});
  refresh();
  return { ok: true, data: undefined };
}
