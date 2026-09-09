import { getSettings } from "@/lib/queries";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings — LendPro" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-text-secondary text-[13.5px] mt-0.5">Business details, defaults and preferences.</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
