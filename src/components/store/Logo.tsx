import Link from "next/link";
import type { Locale } from "@/lib/types";

/**
 * Typographic wordmark inspired by the store's calligraphic logo (burgundy
 * Ruqaa-style "بسمان"). Replace with the official vector logo once the owners
 * provide it: drop it at public/brand/logo.svg and swap this component's body.
 */
export function Logo({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  return (
    <Link href={`/${locale}`} className="group inline-flex items-center gap-3 no-underline" aria-label={locale === "ar" ? "بسمان للعطور — الصفحة الرئيسية" : "Basman Perfumes — home"}>
      <span className="font-[family-name:var(--font-wordmark)] text-[2rem] leading-none text-burgundy sm:text-[2.2rem]" lang="ar">
        بسمان
      </span>
      {!compact && (
        <span className="hidden border-s border-champagne/60 ps-3 leading-tight sm:block" lang="en" dir="ltr">
          <span className="block text-[0.7rem] font-semibold tracking-[0.32em] text-charcoal">BASMAN</span>
          <span className="block text-[0.6rem] tracking-[0.38em] text-gold">PERFUMES</span>
        </span>
      )}
    </Link>
  );
}
