"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Refresh } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())} title="Refresh data" aria-label="Refresh data">
      <Refresh /> <span className="hidden sm:inline">Refresh</span>
    </Button>
  );
}
