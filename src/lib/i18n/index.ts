"use client";

import { useI18nStore } from "@/lib/i18n/store";

export function useI18n() {
  const locale = useI18nStore((state) => state.locale);
  const setLocale = useI18nStore((state) => state.setLocale);
  const t = useI18nStore((state) => state.t);

  return { locale, setLocale, t };
}
