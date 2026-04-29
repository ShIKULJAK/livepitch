"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TooltipProps = {
  content: string;
  label?: string;
  className?: string;
};

export function Tooltip({ content, label = "Field help", className }: TooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in srgb, var(--surface-2) 80%, transparent)",
          color: "var(--text-secondary)",
        }}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-60 -translate-x-1/2 rounded-lg border p-2 text-xs shadow-lg transition-all",
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        )}
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface-1)",
          color: "var(--text-secondary)",
        }}
      >
        {content}
      </span>
    </span>
  );
}

