import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("h-10 w-full rounded-xl border px-3 text-sm placeholder:text-[color:var(--text-secondary)]", className)}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
      {...props}
    />
  );
}

