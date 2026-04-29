"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function CheckEmailPage() {
  const { t } = useI18n();

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-content-center rounded-full border" style={{ borderColor: "var(--primary)", backgroundColor: "color-mix(in srgb,var(--primary) 10%, transparent)" }}>
          <MailCheck className="h-8 w-8" style={{ color: "var(--primary)" }} />
        </div>
        <h1 className="mt-4 text-3xl font-semibold">{t("auth.check.title")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{t("auth.check.subtitle")}</p>
        <div className="mt-6 space-y-3">
          <Button className="w-full">{t("auth.resend")}</Button>
          <Link href="/login"><Button className="w-full" variant="ghost">{t("auth.backToLogin")}</Button></Link>
        </div>
      </Card>
    </main>
  );
}
