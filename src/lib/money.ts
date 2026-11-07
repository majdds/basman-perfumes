/**
 * Money is always handled as an integer number of agorot (1 ₪ = 100 agorot)
 * to avoid floating-point rounding errors. Only format at the edges.
 */
export type Agorot = number;

export function shekelsToAgorot(shekels: number): Agorot {
  if (!Number.isFinite(shekels)) throw new RangeError("Invalid amount");
  return Math.round(shekels * 100);
}

export function agorotToShekels(agorot: Agorot): number {
  return agorot / 100;
}

export function isValidAgorot(value: unknown): value is Agorot {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Formats a price for display. Western (Latin) digits are used in both
 * languages because that is what customers in Palestine see on price tags
 * and phone numbers.
 *   ar → "120 ₪"   en → "₪120"   fractional → "₪99.50"
 */
export function formatPrice(agorot: Agorot, locale: "ar" | "en"): string {
  const shekels = agorot / 100;
  const hasFraction = agorot % 100 !== 0;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(shekels);
  return locale === "ar" ? `${number} ₪` : `₪${number}`;
}
