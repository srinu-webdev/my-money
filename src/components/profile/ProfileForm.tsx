"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { AlertTriangle, Camera, Check, Lock, LogOut } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/actions/auth";
import { changePasswordAction, updateAvatarAction, updateProfileAction } from "@/lib/actions/profile";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { AdminProfile } from "@/lib/types";

export function ProfileForm({ admin, session }: { admin: AdminProfile; session: { loginAt: string; remember?: boolean } | null }) {
  const router = useRouter();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [profilePending, startProfileTransition] = useTransition();
  const [pwPending, startPwTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submitProfile(formData: FormData) {
    setProfileError(null);
    startProfileTransition(async () => {
      const res = await updateProfileAction({ name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone") });
      if (!res.ok) return setProfileError(res.error);
      toast.success("Profile updated successfully");
      router.refresh();
    });
  }

  function submitPassword(formData: FormData) {
    setPwError(null);
    startPwTransition(async () => {
      const res = await changePasswordAction({ current: formData.get("current"), next: formData.get("next"), confirm: formData.get("confirm") });
      if (!res.ok) return setPwError(res.error);
      toast.success("Password changed successfully");
      (document.getElementById("password-form") as HTMLFormElement)?.reset();
    });
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600 * 1024) return toast.warning("Image must be under 600KB");
    const reader = new FileReader();
    reader.onload = () => {
      startAvatarTransition(async () => {
        const res = await updateAvatarAction(String(reader.result));
        if (!res.ok) return toast.error(res.error);
        toast.success("Profile photo updated");
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <div className="flex flex-col gap-5">
        <Card>
          <div className="p-4 sm:p-[22px]">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <Avatar name={admin.name} src={admin.avatar} size="xl" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarPending}
                  className="absolute -right-1.5 -bottom-1 w-8 h-8 rounded-full bg-surface border border-border-strong flex items-center justify-center text-text-secondary shadow-card-sm hover:text-primary"
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </div>
              <div>
                <div className="font-bold text-lg">{admin.name}</div>
                <div className="text-text-secondary text-sm">
                  {admin.email} · {admin.role}
                </div>
                <div className="text-xs text-text-tertiary mt-1">Member since {formatDate(admin.createdAt)}</div>
              </div>
            </div>
            <form id="profile-form" action={submitProfile} className="grid sm:grid-cols-2 gap-4">
              <FormGroup label="Full Name" required className="sm:col-span-2">
                <Input name="name" defaultValue={admin.name} />
              </FormGroup>
              <FormGroup label="Email" required>
                <Input type="email" name="email" defaultValue={admin.email} />
              </FormGroup>
              <FormGroup label="Phone">
                <Input name="phone" defaultValue={admin.phone ?? ""} />
              </FormGroup>
              {profileError && <div className="sm:col-span-2 bg-danger-light text-danger-dark dark:text-red-300 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium">{profileError}</div>}
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" loading={profilePending}>
                  <Check /> Update Profile
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <div className="px-4 sm:px-[22px] py-[18px] border-b border-border">
            <h3 className="text-[15px] font-bold">Change Password</h3>
          </div>
          <div className="p-4 sm:p-[22px]">
            <form id="password-form" action={submitPassword} className="grid sm:grid-cols-2 gap-4">
              <FormGroup label="Current Password" className="sm:col-span-2">
                <Input type="password" name="current" autoComplete="current-password" />
              </FormGroup>
              <FormGroup label="New Password">
                <Input type="password" name="next" autoComplete="new-password" />
              </FormGroup>
              <FormGroup label="Confirm New Password">
                <Input type="password" name="confirm" autoComplete="new-password" />
              </FormGroup>
              {pwError && <div className="sm:col-span-2 bg-danger-light text-danger-dark dark:text-red-300 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium">{pwError}</div>}
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" variant="secondary" loading={pwPending}>
                  <Lock /> Change Password
                </Button>
              </div>
            </form>
            <div className="flex gap-2.5 bg-warning-light text-warning-dark dark:text-amber-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-4">
              <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
              <span>Passwords are hashed with bcrypt and never stored in plain text. Sessions are signed HttpOnly JWT cookies verified on every request.</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="px-4 sm:px-[22px] py-[18px] border-b border-border">
            <h3 className="text-[15px] font-bold">Session</h3>
          </div>
          <div className="p-4 sm:p-[22px]">
            <div className="flex flex-col">
              {[
                ["Signed in", session ? formatDateTime(session.loginAt) : "—"],
                ["Remember me", session?.remember ? "Yes" : "No"],
                ["Role", admin.role],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2.5 border-b border-border text-[13px] last:border-0">
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <Button variant="danger" className="w-full justify-center mt-4" onClick={() => logoutAction()}>
              <LogOut /> Logout
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
