"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/theme/store";
import { themeClassMap } from "@/lib/theme/tokens";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(themeClassMap.dark, themeClassMap.light);
    root.classList.add(themeClassMap[mode]);
    root.setAttribute("data-theme", mode);
  }, [mode]);

  return <>{children}</>;
}

