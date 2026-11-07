/** All dates are displayed in Palestine time (West Bank, incl. DST rules). */
export const STORE_TIME_ZONE = "Asia/Hebron";

export function formatDateTime(iso: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-PS-u-nu-latn" : "en-GB", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-PS-u-nu-latn" : "en-GB", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** "YYYY-MM-DD" of the given instant in Palestine time. */
export function storeDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA yields YYYY-MM-DD
}

/**
 * Converts a store-local calendar day ("YYYY-MM-DD") to the UTC instant at
 * which that day starts in Palestine. Handles DST by probing the offset.
 */
export function startOfStoreDayUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMin = tzOffsetMinutes(guess);
  const candidate = new Date(guess.getTime() - offsetMin * 60_000);
  // Re-probe in case the offset differs at the candidate instant (DST edge).
  const offset2 = tzOffsetMinutes(candidate);
  return offset2 === offsetMin ? candidate : new Date(guess.getTime() - offset2 * 60_000);
}

function tzOffsetMinutes(at: Date): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(f.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}
