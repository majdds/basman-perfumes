import ar, { type Dictionary } from "./ar";
import en from "./en";
import type { Locale } from "../types";

export const LOCALES = ["ar", "en"] as const;
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "basman_locale";

export function isLocale(v: unknown): v is Locale {
  return v === "ar" || v === "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : ar;
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

/** Picks the right language from a localized value, falling back to the other one. */
export function pick(text: { ar?: string | null; en?: string | null } | null | undefined, locale: Locale): string {
  if (!text) return "";
  const primary = locale === "en" ? text.en : text.ar;
  return (primary && primary.trim()) || (locale === "en" ? text.ar : text.en) || "";
}

/** Resolves a validation error key (from zod) to a translated message. */
export function errorMessage(dict: Dictionary, key: string | undefined): string {
  if (!key) return dict.errors.generic;
  const v = (dict.errors as Record<string, unknown>)[key];
  return typeof v === "string" ? v : dict.errors.invalid;
}

export type { Dictionary };
