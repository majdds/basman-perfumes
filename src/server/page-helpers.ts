import "server-only";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary, isLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { env } from "./env";

export async function resolveLocale(params: Promise<{ locale: string }>): Promise<{ locale: Locale; dict: ReturnType<typeof getDictionary> }> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, dict: getDictionary(locale) };
}

export function siteUrl(): string {
  return env().SITE_URL.replace(/\/$/, "");
}

/** Canonical + hreflang alternates for a locale-independent path like "/shop". */
export function localizedAlternates(locale: Locale, path: string): Metadata["alternates"] {
  const base = siteUrl();
  const p = path === "/" ? "" : path;
  return {
    canonical: `${base}/${locale}${p}`,
    languages: { ar: `${base}/ar${p}`, en: `${base}/en${p}`, "x-default": `${base}/ar${p}` },
  };
}

export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const dict = getDictionary(opts.locale);
  const image = opts.image ?? `${siteUrl()}/og-${opts.locale}.png`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: localizedAlternates(opts.locale, opts.path),
    openGraph: {
      type: opts.type ?? "website",
      siteName: dict.meta.siteName,
      title: opts.title,
      description: opts.description,
      url: `${siteUrl()}/${opts.locale}${opts.path === "/" ? "" : opts.path}`,
      locale: opts.locale === "ar" ? "ar_PS" : "en_US",
      alternateLocale: opts.locale === "ar" ? ["en_US"] : ["ar_PS"],
      images: [{ url: image, width: 1200, height: 630, alt: dict.meta.siteName }],
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
  };
}
