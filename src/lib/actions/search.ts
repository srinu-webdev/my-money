"use server";

import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";

export interface SearchResult {
  kind: "customer" | "loan" | "payment";
  id: string;
  title: string;
  sub: string;
}

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  await requireAdminId();
  const q = query.trim();
  if (!q) return [];

  const [customers, loans, payments] = await Promise.all([
    prisma.customer.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { id: { contains: q, mode: "insensitive" } }] },
      take: 4,
    }),
    prisma.loan.findMany({
      where: { OR: [{ id: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] },
      include: { customer: true },
      take: 4,
    }),
    prisma.payment.findMany({
      where: { OR: [{ id: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] },
      include: { customer: true },
      take: 4,
    }),
  ]);

  return [
    ...customers.map((c) => ({ kind: "customer" as const, id: c.id, title: c.name, sub: `${c.id} · ${c.phone}` })),
    ...loans.map((l) => ({ kind: "loan" as const, id: l.id, title: `${l.id} · ₹${l.principal.toString()}`, sub: l.customer.name })),
    ...payments.map((p) => ({ kind: "payment" as const, id: p.id, title: `${p.id} · ₹${p.amount.toString()}`, sub: p.customer.name })),
  ];
}
