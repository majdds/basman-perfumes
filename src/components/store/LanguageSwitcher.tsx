"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/types";
import { IconGlobe } from "../ui/icons";

export function LanguageSwitcher({ locale, label, ariaLabel }: { locale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname() ?? `/${locale}`;
  const search = useSearchParams();
  const other: Locale = locale === "ar" ? "en" : "ar";
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");
  const qs = search?.toString();
  return (
    <Link
      href={`/${other}${rest}${qs ? `?${qs}` : ""}`}
      hrefLang={other}
      lang={other}
      aria-label={ariaLabel}
      className="btn btn-ghost btn-sm gap-1.5 px-3"
      data-testid="lang-switch"
    >
      <IconGlobe size={18} />
      <span>{label}</span>
    </Link>
  );
}
