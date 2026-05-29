import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const NATIONALITY_ALIASES: Record<string, string> = {
  bih: "BA",
  bosna: "BA",
  bosansko: "BA",
  "bosna i hercegovina": "BA",
  "bosnia and herzegovina": "BA",
  serbia: "RS",
  srb: "RS",
  srbija: "RS",
  montenegro: "ME",
  crna: "ME",
  croatia: "HR",
  hrvatska: "HR",
  slovenia: "SI",
  slovenija: "SI",
  macedonia: "MK",
  "north macedonia": "MK",
  albania: "AL",
  albanija: "AL",
  germany: "DE",
  njemacka: "DE",
  "united states": "US",
  usa: "US",
  austria: "AT",
  austrija: "AT",
  italy: "IT",
  italija: "IT",
  france: "FR",
  francuska: "FR",
  spain: "ES",
  spanija: "ES",
  portugal: "PT",
  portugalija: "PT",
};

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function codeToFlagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  const chars = [...code].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
  return chars.join("");
}

export function nationalityToCountryCode(nationality?: string | null): string | null {
  if (!nationality) return null;
  const normalized = normalize(nationality);
  const fromAlias = NATIONALITY_ALIASES[normalized];
  if (fromAlias) return fromAlias;

  const names = countries.getNames("en", { select: "official" });
  for (const [code, name] of Object.entries(names)) {
    if (normalize(name) === normalized) return code;
  }
  return null;
}

export function nationalityToFlagEmoji(nationality?: string | null): string {
  const code = nationalityToCountryCode(nationality);
  return code ? codeToFlagEmoji(code) : "🏳️";
}

