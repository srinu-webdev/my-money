import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { businessToday } from "@/lib/dates";

export async function GET() {
  const session = await getSessionPayload();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [customers, loans, payments, notifications, activities, settings] = await Promise.all([
    prisma.customer.findMany(),
    prisma.loan.findMany(),
    prisma.payment.findMany(),
    prisma.notification.findMany(),
    prisma.activity.findMany(),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), customers, loans, payments, notifications, activities, settings }, (_key, value) => (typeof value === "object" && value !== null && "toNumber" in value ? value.toNumber() : value), 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      // businessToday(), not the server's own UTC date — otherwise a backup
      // taken in the early hours of an IST day gets filed under the
      // previous day's date.
      "Content-Disposition": `attachment; filename="lendpro-backup-${businessToday()}.json"`,
    },
  });
}
