"use client";

import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  locale: string;
} | null;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/current", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const json = (await response.json()) as { data?: CurrentUser };
        if (!cancelled) setUser(json.data ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
  };
}

