import { cn } from "@/lib/utils/cn";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="grid h-10 w-10 place-content-center rounded-xl border"
        style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M3 14L11 6L13.5 8.5L8.5 13.5H15L20.5 8L22 9.5L16 15.5H9.5L14 20L11.5 22.5L3 14Z" fill="var(--primary)" />
          <circle cx="18.5" cy="16.5" r="2.75" stroke="var(--text-primary)" strokeWidth="1.5" />
          <circle cx="18.5" cy="16.5" r="0.9" fill="var(--text-primary)" />
        </svg>
      </div>
      <div className={cn("leading-none", compact && "hidden xl:block") }>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-secondary)" }}>Live</p>
        <p className="text-lg font-semibold tracking-tight">Pitch</p>
      </div>
    </div>
  );
}

