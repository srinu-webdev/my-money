import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { getCurrentAdmin, getRecentActivities } from "@/lib/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata = { title: "Admin Profile — LendPro" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const [session, activities] = await Promise.all([getSessionPayload(), getRecentActivities(200)]);
  const accountActivities = activities.filter((a) => ["admin_login", "admin_logout", "settings_updated", "profile_updated"].includes(a.type)).slice(0, 8);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin Profile</h1>
        <p className="text-text-secondary text-[13.5px] mt-0.5">Your account details and security.</p>
      </div>
      <ProfileForm admin={admin} session={session ? { loginAt: session.loginAt, remember: session.remember } : null} />
      <Card className="mt-5">
        <CardHeader title="Recent Account Activity" />
        <ActivityList activities={accountActivities} emptyText="No account activity yet." showLinks={false} />
      </Card>
    </div>
  );
}
