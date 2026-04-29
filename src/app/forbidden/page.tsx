"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function ForbiddenPage() {
  const { t } = useI18n();

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-lg p-6 text-center">
        <h1 className="text-3xl font-semibold">{t("forbidden.title")}</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("forbidden.description")}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard"><Button>{t("forbidden.backDashboard")}</Button></Link>
          <Link href="/settings"><Button variant="secondary">{t("forbidden.openSettings")}</Button></Link>
        </div>
      </Card>
    </main>
  );
}
