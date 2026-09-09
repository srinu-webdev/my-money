"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { signupAction, type SignupState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

const initialState: SignupState = { ok: true, data: undefined };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Full Name</label>
        <Input name="name" placeholder="Your name" autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Email address</label>
        <Input type="email" name="email" placeholder="you@example.com" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Phone (optional)</label>
        <Input name="phone" placeholder="+91 98765 43210" autoComplete="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Password</label>
        <div className="relative">
          <Input type={showPw ? "text" : "password"} name="password" placeholder="At least 6 characters" autoComplete="new-password" className="pr-11" required minLength={6} />
          <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 w-[30px] h-[30px] flex items-center justify-center text-text-tertiary hover:text-text rounded-md hover:bg-surface-3">
            {showPw ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-text-secondary">Confirm Password</label>
        <Input type={showPw ? "text" : "password"} name="confirm" placeholder="Re-enter your password" autoComplete="new-password" required minLength={6} />
      </div>
      {!state.ok && <div className="bg-danger-light text-danger-dark dark:text-red-300 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium">{state.error}</div>}
      <Button type="submit" size="lg" loading={pending} className="w-full justify-center">
        <UserPlus /> Create Account
      </Button>
    </form>
  );
}
