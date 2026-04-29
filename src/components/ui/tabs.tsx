"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface TabsProps {
  items: string[];
  active: string;
  onChange: (v: string) => void;
}

export function Tabs({ items, active, onChange }: TabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    onChange(items[nextIndex]);
  };

  return (
    <div className="flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Content tabs">
      {items.map((item, index) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            onClick={() => onChange(item)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", isActive && "font-semibold")}
            style={isActive ? { color: "var(--primary)", backgroundColor: "color-mix(in srgb,var(--primary) 10%, transparent)" } : { color: "var(--text-secondary)" }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

