export function AuthProgress({ label }: { label: string }) {
  return (
    <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))", backgroundColor: "color-mix(in srgb, var(--primary) 6%, var(--surface-1))" }}>
      <div className="lp-auth-progress-line" aria-hidden="true" />
      <p className="text-xs font-medium tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
    </div>
  );
}
