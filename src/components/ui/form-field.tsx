import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Tooltip } from "@/components/ui/tooltip";

type FormFieldProps = {
  label: string;
  tooltip?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
};

export function FormField({
  label,
  tooltip,
  helperText,
  error,
  required,
  readOnly,
  className,
  htmlFor,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
        </label>
        {tooltip ? <Tooltip content={tooltip} /> : null}
        {readOnly ? (
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Read only
          </span>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
      {!error && helperText ? <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{helperText}</p> : null}
    </div>
  );
}
