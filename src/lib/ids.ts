import type { Prisma } from "@prisma/client";
import { businessNow } from "./dates";

type Tx = Prisma.TransactionClient;

const PREFIX = { customer: "CUS", loan: "LN", payment: "PAY", disbursement: "DIS" } as const;

/**
 * Atomically allocates the next formatted id (e.g. CUS-2026-0001) inside
 * an existing Prisma transaction — call this in the SAME `$transaction`
 * as the row `create`, so the counter increment and the insert commit or
 * roll back together.
 */
export async function nextId(tx: Tx, type: keyof typeof PREFIX): Promise<string> {
  // The server's clock is UTC; for the last ~5.5h of every IST day the ID
  // prefix would otherwise stamp the WRONG (previous) year right at
  // New Year's — businessNow() keeps IDs on the business's own calendar.
  const year = businessNow().getFullYear();
  const key = `${type}_${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX[type]}-${year}-${String(counter.value).padStart(4, "0")}`;
}
