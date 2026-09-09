import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const PREFIX = { customer: "CUS", loan: "LN", payment: "PAY" } as const;

/**
 * Atomically allocates the next formatted id (e.g. CUS-2026-0001) inside
 * an existing Prisma transaction — call this in the SAME `$transaction`
 * as the row `create`, so the counter increment and the insert commit or
 * roll back together.
 */
export async function nextId(tx: Tx, type: keyof typeof PREFIX): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${type}_${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${PREFIX[type]}-${year}-${String(counter.value).padStart(4, "0")}`;
}
