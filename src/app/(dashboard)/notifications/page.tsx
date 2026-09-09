import { getAllNotifications } from "@/lib/queries";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const metadata = { title: "Notifications — LendPro" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await getAllNotifications();
  return <NotificationsView notifications={notifications} />;
}
