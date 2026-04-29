import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("min-h-28 w-full rounded-xl border px-3 py-2 text-sm placeholder:text-[color:var(--text-secondary)]", className)}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
      {...props}
    />
  );
}

