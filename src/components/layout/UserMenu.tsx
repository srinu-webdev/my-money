"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/actions/auth";

export function UserMenu({ name, avatar }: { name: string; avatar: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-surface-3 transition-colors border border-transparent">
        <Avatar name={name} src={avatar} size="md" />
        <span className="hidden lg:block text-left leading-tight">
          <div className="font-semibold text-[13px]">{name}</div>
          <div className="text-[11px] text-text-tertiary">Administrator</div>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-tertiary hidden sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] min-w-[190px] bg-surface border border-border rounded-xl shadow-card-lg p-1.5 z-[200] animate-fade-in">
          <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium hover:bg-surface-3 transition-colors [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-text-secondary">
            <UserCircle /> Profile
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium hover:bg-surface-3 transition-colors [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-text-secondary">
            <Settings /> Settings
          </Link>
          <div className="h-px bg-border my-1.5" />
          <button onClick={() => logoutAction()} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium text-danger hover:bg-danger-light transition-colors [&_svg]:w-[15px] [&_svg]:h-[15px]">
            <LogOut /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
