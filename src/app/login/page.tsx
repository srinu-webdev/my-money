import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icons";
import { getCurrentAdmin } from "@/lib/queries";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";

export const metadata = { title: "Admin Login — LendPro" };

export default async function LoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/dashboard");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthSidePanel heading="Run your lending desk with total clarity." sub="Every loan, every payment and every rupee of interest — calculated for you, updated instantly." />

      <div className="flex items-center justify-center p-6 sm:p-10 bg-bg">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-text-secondary text-[13px] font-medium hover:text-primary transition-colors">
            <ArrowLeft className="w-[15px] h-[15px]" /> Back to website
          </Link>
          <h1 className="text-[26px] font-extrabold tracking-tight mt-6">Welcome back</h1>
          <div className="text-text-secondary mt-1.5 mb-7 text-sm">Sign in to your admin dashboard</div>
          <LoginForm />
          <p className="text-center text-sm text-text-secondary mt-5">
            Don&rsquo;t have an account?{" "}
            <Link href="/signup" className="text-primary font-semibold hover:underline">
              Create your own profile
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
