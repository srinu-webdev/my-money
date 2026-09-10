"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock } from "@/components/ui/icons";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const initialState: LoginState = { ok: true, data: undefined };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Email address</label>
        <Input type="email" name="email" placeholder="you@example.com" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Password</label>
        <div className="relative">
          <Input type={showPw ? "text" : "password"} name="password" placeholder="••••••••" autoComplete="current-password" className="pr-11" required />
          <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 w-[30px] h-[30px] flex items-center justify-center text-text-tertiary hover:text-text rounded-md hover:bg-surface-3">
            {showPw ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary cursor-pointer">
          <input type="checkbox" name="remember" defaultChecked className="w-4 h-4 accent-primary" /> Remember me
        </label>
        <Link href="#" className="text-primary text-sm font-semibold hover:underline">
          Forgot password?
        </Link>
      </div>
      {!state.ok && <div className="bg-danger-light text-danger-dark dark:text-red-300 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium">{state.error}</div>}
      <Button type="submit" size="lg" loading={pending} className="w-full justify-center">
        <Lock /> Login
      </Button>
    </form>
  );
}
