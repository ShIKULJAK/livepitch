"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-3xl font-semibold">{t("auth.forgot.title")}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{t("auth.forgot.subtitle")}</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm">{t("auth.email")}</label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <Link href="/check-email"><Button variant="primary" className="w-full">{t("auth.sendReset")}</Button></Link>
          <Link href="/login" className="block text-center text-sm" style={{ color: "var(--primary)" }}>{t("auth.backToLogin")}</Link>
        </div>
      </Card>
    </main>
  );
}
