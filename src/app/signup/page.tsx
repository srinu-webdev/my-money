import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentAdmin } from "@/lib/queries";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";

export const metadata = { title: "Create Account — LendPro" };

export default async function SignupPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/dashboard");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthSidePanel heading="Your own admin profile, in under a minute." sub="Create your account to start managing customers, loans, interest and collections — all backed by a real database, not a browser demo." />

      <div className="flex items-center justify-center p-6 sm:p-10 bg-bg">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-text-secondary text-[13px] font-medium hover:text-primary transition-colors">
            <ArrowLeft className="w-[15px] h-[15px]" /> Back to website
          </Link>
          <h1 className="text-[26px] font-extrabold tracking-tight mt-6">Create your profile</h1>
          <div className="text-text-secondary mt-1.5 mb-7 text-sm">Set up your own admin account for LendPro</div>
          <SignupForm />
          <p className="text-center text-sm text-text-secondary mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Log in
            </Link>
          </p>
          <p className="text-xs text-text-tertiary mt-4 leading-relaxed">
            Your password is hashed with bcrypt before it&rsquo;s stored — never kept in plain text — and your session is a signed HttpOnly cookie.
          </p>
        </div>
      </div>
    </div>
  );
}
