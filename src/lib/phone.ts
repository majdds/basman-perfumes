/**
 * Palestinian phone number validation and normalisation.
 *
 * Accepted inputs (spaces, dashes, dots and brackets are ignored; Arabic-Indic
 * digits are converted):
 *   Mobile   0599 123 456 · 0569123456 · +970 599 123 456 · 00970599123456
 *            Israeli-network mobiles used in Jerusalem / 1948 areas:
 *            0521234567 · +972 52 123 4567
 *   Landline 02 295 1234 (Ramallah/Jerusalem/Bethlehem/Hebron) · 04 · 08 · 09
 *
 * Output is E.164 (e.g. +970599123456) so it works for tel: and WhatsApp links.
 */
export type PhoneKind = "mobile" | "landline";
export interface ParsedPhone {
  e164: string;
  national: string; // with leading 0, digits only, e.g. 0599123456
  kind: PhoneKind;
  country: "970" | "972";
}

const ARABIC_INDIC = /[٠-٩۰-۹]/g;

export function toLatinDigits(input: string): string {
  return input.replace(ARABIC_INDIC, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

// Palestinian mobile operators: Jawwal (059), Ooredoo (056).
const PS_MOBILE_PREFIXES = ["59", "56"];
// Israeli mobile prefixes commonly used by customers in Jerusalem and 1948 areas.
const IL_MOBILE_PREFIXES = ["50", "51", "52", "53", "54", "55", "58"];
// Landline area codes (without the leading 0).
const LANDLINE_AREAS = ["2", "4", "8", "9"];

export function parsePalestinianPhone(raw: string): ParsedPhone | null {
  if (typeof raw !== "string" || raw.length > 30) return null;
  let s = toLatinDigits(raw).trim().replace(/[\s\-().\u200e\u200f]/g, "");
  if (!/^\+?\d+$/.test(s)) return null;

  let explicitCountry: "970" | "972" | null = null;
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (!s.startsWith("0") && (s.startsWith("970") || s.startsWith("972")) && s.length >= 11) {
    // bare "970599..." typed without a plus sign
  } else if (!s.startsWith("0")) {
    // Number typed without the trunk 0 (e.g. "599123456")
    s = "0" + s;
  }

  if (s.startsWith("970") || s.startsWith("972")) {
    explicitCountry = s.slice(0, 3) as "970" | "972";
    s = s.slice(3);
    if (s.startsWith("0")) s = s.slice(1);
  } else if (s.startsWith("0")) {
    s = s.slice(1);
  } else {
    return null;
  }

  // s is now the national significant number without the trunk 0.
  if (/^5\d{8}$/.test(s)) {
    const prefix = s.slice(0, 2);
    let country: "970" | "972";
    if (PS_MOBILE_PREFIXES.includes(prefix)) country = "970";
    else if (IL_MOBILE_PREFIXES.includes(prefix)) country = "972";
    else return null;
    if (explicitCountry && explicitCountry !== country) {
      // e.g. +972 59…: Jawwal numbers are only reachable via +970.
      return null;
    }
    return { e164: `+${country}${s}`, national: `0${s}`, kind: "mobile", country };
  }

  if (/^\d{8}$/.test(s) && LANDLINE_AREAS.includes(s[0]!)) {
    const country = explicitCountry ?? "970";
    return { e164: `+${country}${s}`, national: `0${s}`, kind: "landline", country };
  }

  return null;
}

/** Digits-only key used for searching orders by phone. */
export function phoneSearchKey(raw: string): string | null {
  return parsePalestinianPhone(raw)?.national ?? null;
}

/** wa.me link (WhatsApp requires the international number without "+"). */
export function whatsappLink(e164: string, text?: string): string {
  const digits = e164.replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export function formatPhoneForDisplay(national: string): string {
  const d = national.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.length === 9) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return national;
}
