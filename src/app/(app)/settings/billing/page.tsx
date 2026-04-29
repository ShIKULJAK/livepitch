"use client";

import { useBillingSnapshot } from "@/hooks/use-competitions";
import { SettingsTemplate } from "@/components/settings/settings-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingSettingsPage() {
  const billingQuery = useBillingSnapshot();
  const billingPlan = billingQuery.data;

  return (
    <SettingsTemplate
      title="Billing & Subscription"
      description="Manage your plan, payment methods and invoices."
      aside={<Card className="p-4 text-sm"><p className="font-semibold">Usage</p><p className="mt-1" style={{ color: "var(--text-secondary)" }}>{billingPlan?.usage.storage ?? "-"}</p></Card>}
    >
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xl font-semibold">{billingPlan?.name ?? "Loading..."}</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>Next billing date: Jun 12, 2024</p></div>
            <div className="text-right"><p className="text-3xl font-semibold">${billingPlan?.priceMonthly ?? 0}</p><Badge variant="active">{billingPlan?.status ?? "active"}</Badge></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{(billingPlan?.features ?? []).map((f) => <span key={f} className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>{f}</span>)}</div>
        </Card>
        <Card className="p-4">
          <p className="font-semibold">Payment Method</p><p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>VISA •••• 4242 • Expires 06/27</p>
          <Button className="mt-3">Update</Button>
        </Card>
        {billingQuery.isError ? <Card className="p-3 text-sm" style={{ color: "var(--danger)" }}>{(billingQuery.error as Error).message}</Card> : null}
      </div>
    </SettingsTemplate>
  );
}

