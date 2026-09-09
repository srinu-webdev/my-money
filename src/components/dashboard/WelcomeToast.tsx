"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

export function WelcomeToast() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (params.get("welcome") === "1") {
      toast.success("Welcome back, Admin!");
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
