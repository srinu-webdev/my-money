import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function logActivity(
  tx: Tx,
  type: string,
  description: string,
  refs?: { customerId?: string | null; loanId?: string | null; paymentId?: string | null }
) {
  await tx.activity.create({
    data: {
      type,
      description,
      customerId: refs?.customerId ?? null,
      loanId: refs?.loanId ?? null,
      paymentId: refs?.paymentId ?? null,
    },
  });
}

export async function pushNotification(tx: Tx, type: string, message: string) {
  await tx.notification.create({ data: { type, message } });
}
