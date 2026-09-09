"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import { settingsSchema } from "@/lib/validations";
import { logActivity } from "@/lib/log";
import type { ActionResult } from "@/lib/types";

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdminId();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...d, businessPhone: d.businessPhone || "", businessEmail: d.businessEmail || "", businessAddress: d.businessAddress || "" },
      update: { ...d, businessPhone: d.businessPhone || "", businessEmail: d.businessEmail || "", businessAddress: d.businessAddress || "" },
    });
    await logActivity(tx, "settings_updated", "Settings updated");
  });
  revalidatePath("/", "layout"); // /loans reads these as the "Give New Loan" form defaults
  return { ok: true, data: undefined };
}
