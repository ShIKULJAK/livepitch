"use client";

import { nationalityToCountryCode, nationalityToFlagEmoji } from "@/lib/utils/nationality";

type NationalityBadgeProps = {
  nationality?: string | null;
  className?: string;
};

export function NationalityBadge({ nationality, className }: NationalityBadgeProps) {
  if (!nationality) return <span className={className}>-</span>;
  const code = nationalityToCountryCode(nationality);
  const flag = nationalityToFlagEmoji(nationality);
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {code ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/16x12/${code.toLowerCase()}.png`}
          alt={`${nationality} flag`}
          width={16}
          height={12}
          className="inline-block rounded-[2px] border object-cover"
          style={{ borderColor: "var(--border)" }}
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true">{flag}</span>
      )}
      <span>{nationality}</span>
    </span>
  );
}

type NationalityListProps = {
  nationalities?: string[] | null;
  fallback?: string | null;
  className?: string;
};

export function NationalityList({ nationalities, fallback, className }: NationalityListProps) {
  const entries = (nationalities ?? []).filter(Boolean);
  if (entries.length === 0 && fallback) {
    return <NationalityBadge nationality={fallback} className={className} />;
  }
  if (entries.length === 0) return <span className={className}>-</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {entries.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span style={{ color: "var(--text-secondary)" }}>,</span> : null}
          <NationalityBadge nationality={item} />
        </span>
      ))}
    </span>
  );
}
