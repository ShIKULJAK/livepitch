function pad(value: number) {
  return String(value).padStart(2, "0");
}

const DEFAULT_TIME_ZONE = "Europe/Sarajevo";
const DEFAULT_LOCALE = "en-GB";

function getDateParts(value: string | Date, locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!day || !month || !year) return null;

  return { date, day, month, year };
}

export function formatDateDDMMYYYY(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatTimeHHMM(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTimeDDMMYYYY(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${formatDateDDMMYYYY(date)} ${formatTimeHHMM(date)}`;
}

export function formatDateTimeStable(value: string | Date, locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE) {
  const parts = getDateParts(value, locale, timeZone);
  if (!parts) return "";

  const formattedTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(parts.date);

  return `${parts.day}-${parts.month}-${parts.year} ${formattedTime}`;
}

export function formatTimeStable(value: string | Date, locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}
export function formatDateStable(value: string | Date, locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE) {
  const parts = getDateParts(value, locale, timeZone);
  if (!parts) return "";

  return `${parts.day}-${parts.month}-${parts.year}`;
}
