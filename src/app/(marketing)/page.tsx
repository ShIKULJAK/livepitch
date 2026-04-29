"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const { t } = useI18n();

  const features = [
    t("landing.feature.1"),
    t("landing.feature.2"),
    t("landing.feature.3"),
    t("landing.feature.4"),
  ];

  const cards = [
    t("landing.card.operations"),
    t("landing.card.competition"),
    t("landing.card.analytics"),
  ];

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden p-8 md:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium" style={{ color: "var(--primary)" }}>{t("landing.brand")}</p>
              <h1 className="text-4xl font-semibold leading-tight md:text-6xl">{t("landing.heroTitle")}</h1>
              <p className="mt-4 max-w-xl text-base md:text-lg" style={{ color: "var(--text-secondary)" }}>
                {t("landing.heroSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/signup"><Button variant="primary" size="lg">{t("landing.ctaStart")} <ArrowRight className="h-4 w-4" /></Button></Link>
                <Button size="lg"><PlayCircle className="h-4 w-4" />{t("landing.ctaDemo")}</Button>
              </div>
            </div>
            <Card className="p-6">
              <p className="text-sm font-semibold">{t("landing.trusted")}</p>
              <div className="mt-4 grid gap-3">
                {features.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((title) => (
            <Card key={title} className="p-5">
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("landing.card.description")}
              </p>
            </Card>
          ))}
        </div>

        <footer className="border-t py-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Live Pitch. {t("landing.footer")}</span>
            <div className="flex gap-4">
              <Link href="/login">{t("auth.login")}</Link>
              <Link href="/signup">{t("auth.signup")}</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
