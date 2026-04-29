"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { bsMessages } from "@/lib/i18n/messages/bs";
import { enMessages } from "@/lib/i18n/messages/en";
import type { Locale } from "@/lib/i18n/types";

const dictionaries = {
  bs: bsMessages,
  en: enMessages,
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: "bs",
      setLocale: (locale) => set({ locale }),
      t: (key, fallback) => dictionaries[get().locale][key] ?? fallback ?? key,
    }),
    { name: "live-pitch-locale", skipHydration: true }
  )
);
