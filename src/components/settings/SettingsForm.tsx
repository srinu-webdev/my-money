"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "@/lib/toast";
import { Check, Download, Info } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { saveSettingsAction } from "@/lib/actions/settings";
import { FREQ_LABEL } from "@/lib/calculations";
import type { InterestFrequency, InterestType, Settings } from "@/lib/types";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"];
const REPAYMENT_TYPES = ["Interest Only", "Daily Installment", "Principal + Interest", "Custom"];
const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => setMounted(true), []);

  function submit(formData: FormData) {
    const payload = {
      businessName: String(formData.get("businessName") || ""),
      businessPhone: String(formData.get("businessPhone") || ""),
      businessEmail: String(formData.get("businessEmail") || ""),
      businessAddress: String(formData.get("businessAddress") || ""),
      dateFormat: String(formData.get("dateFormat")),
      defaultInterestRate: Number(formData.get("defaultInterestRate")),
      defaultInterestType: formData.get("defaultInterestType") as InterestType,
      defaultFrequency: formData.get("defaultFrequency") as InterestFrequency,
      defaultRepaymentType: String(formData.get("defaultRepaymentType")),
      defaultPaymentMethod: String(formData.get("defaultPaymentMethod")),
      dueReminder: formData.get("dueReminder") === "on",
      overdueReminder: formData.get("overdueReminder") === "on",
    };
    startTransition(async () => {
      const res = await saveSettingsAction(payload);
      if (!res.ok) return toast.error(res.error);
      toast.success("Settings saved successfully");
      router.refresh();
    });
  }

  return (
    <form action={submit}>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="p-4 sm:p-[22px]">
              <h3 className="text-[15px] font-bold mb-0.5">General</h3>
              <div className="text-[12.5px] text-text-secondary mb-4">Appears on receipts, reports and reminders.</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormGroup label="Business Name" className="sm:col-span-2">
                  <Input name="businessName" defaultValue={settings.businessName} />
                </FormGroup>
                <FormGroup label="Business Phone">
                  <Input name="businessPhone" defaultValue={settings.businessPhone} />
                </FormGroup>
                <FormGroup label="Business Email">
                  <Input type="email" name="businessEmail" defaultValue={settings.businessEmail} />
                </FormGroup>
                <FormGroup label="Business Address" className="sm:col-span-2">
                  {/* Textarea's own base class sets min-h-[84px] — a className
                      override can't win that fight (`cn()` is plain clsx, no
                      Tailwind conflict resolution), so the shorter height
                      needs an inline style, which always takes priority. */}
                  <Textarea name="businessAddress" defaultValue={settings.businessAddress} style={{ minHeight: "64px" }} />
                </FormGroup>
                <FormGroup label="Currency">
                  <Select defaultValue="INR" disabled>
                    <option value="INR">INR (₹) — Indian Rupee</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Date Format">
                  <Select name="dateFormat" defaultValue={settings.dateFormat}>
                    {DATE_FORMATS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </Select>
                </FormGroup>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4 sm:p-[22px]">
              <h3 className="text-[15px] font-bold mb-0.5">Interest Defaults</h3>
              <div className="text-[12.5px] text-text-secondary mb-4">Pre-filled when creating a new loan.</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormGroup label="Default Interest Rate">
                  <Input type="number" step="0.01" min={0} name="defaultInterestRate" defaultValue={settings.defaultInterestRate} />
                </FormGroup>
                <FormGroup label="Default Rate Type">
                  <Select name="defaultInterestType" defaultValue={settings.defaultInterestType}>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Default Frequency">
                  <Select name="defaultFrequency" defaultValue={settings.defaultFrequency}>
                    {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as InterestFrequency[]).map((f) => (
                      <option key={f} value={f}>
                        {FREQ_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup label="Default Repayment Type">
                  <Select name="defaultRepaymentType" defaultValue={settings.defaultRepaymentType}>
                    {REPAYMENT_TYPES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </FormGroup>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <div className="p-4 sm:p-[22px]">
              <h3 className="text-[15px] font-bold mb-0.5">Payment Settings</h3>
              <div className="text-[12.5px] text-text-secondary mb-4">Defaults for the Record Payment form.</div>
              <FormGroup label="Default Payment Method">
                <Select name="defaultPaymentMethod" defaultValue={settings.defaultPaymentMethod}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </FormGroup>
            </div>
          </Card>

          <Card>
            <div className="p-4 sm:p-[22px]">
              <h3 className="text-[15px] font-bold mb-0.5">Notification Settings</h3>
              <div className="text-[12.5px] text-text-secondary mb-4">In-app alerts generated once per day.</div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <div>
                  <div className="font-semibold text-sm">Due Reminder</div>
                  <div className="text-xs text-text-secondary">Notify when a loan is due today</div>
                </div>
                <Checkbox label="" name="dueReminder" defaultChecked={settings.dueReminder} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-sm">Overdue Reminder</div>
                  <div className="text-xs text-text-secondary">Notify when a loan becomes overdue and weekly after</div>
                </div>
                <Checkbox label="" name="overdueReminder" defaultChecked={settings.overdueReminder} />
              </div>
              <div className="flex gap-2.5 bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-3">
                <Info className="w-[18px] h-[18px] shrink-0 mt-0.5" />
                <span>SMS / WhatsApp / Email delivery requires a backend integration (TODO).</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4 sm:p-[22px]">
              <h3 className="text-[15px] font-bold mb-0.5">Appearance</h3>
              <div className="text-[12.5px] text-text-secondary mb-4">Theme preference is remembered on this device.</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 font-semibold text-[13px] transition-all ${mounted && resolvedTheme === "light" ? "border-primary bg-primary-50" : "border-border hover:border-primary-200"}`}
                >
                  <span className="w-[34px] h-6 rounded-md border border-border" style={{ background: "linear-gradient(135deg,#fff,#eef2ff)" }} />
                  Light Mode
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 font-semibold text-[13px] transition-all ${mounted && resolvedTheme === "dark" ? "border-primary bg-primary-50" : "border-border hover:border-primary-200"}`}
                >
                  <span className="w-[34px] h-6 rounded-md border border-border" style={{ background: "linear-gradient(135deg,#161923,#0e1016)" }} />
                  Dark Mode
                </button>
              </div>
            </div>
          </Card>

          <ResetDataCard />
        </div>
      </div>

      <Card className="mt-5">
        <div className="p-4 sm:p-[22px] flex justify-between items-center flex-wrap gap-3">
          <div className="text-sm text-text-secondary">Changes apply immediately across the app.</div>
          <Button type="submit" loading={pending}>
            <Check /> Save Settings
          </Button>
        </div>
      </Card>
    </form>
  );

  function ResetDataCard() {
    return (
      <Card>
        <div className="p-4 sm:p-[22px]">
          <h3 className="text-[15px] font-bold mb-0.5">Data</h3>
          <div className="text-[12.5px] text-text-secondary mb-4">Backed by Postgres — this is the shared, real database for every admin session.</div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.open("/api/export", "_blank");
              }}
            >
              <Download /> Backup (JSON)
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
