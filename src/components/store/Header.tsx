import Link from "next/link";
import { Suspense } from "react";
import type { Dictionary } from "@/lib/i18n";
import { dir, pick } from "@/lib/i18n";
import type { Locale, StoreSettings } from "@/lib/types";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CartButton } from "./CartButton";
import { MobileNav } from "./MobileNav";
import { IconSearch } from "../ui/icons";

export function Header({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: StoreSettings }) {
  const links = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/shop`, label: dict.nav.shop },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];
  const announcement = pick(settings.announcement, locale);
  return (
    <>
      <a href="#main" className="sr-only z-50 bg-charcoal px-4 py-2 text-ivory focus:not-sr-only focus:fixed focus:start-2 focus:top-2">
        {dict.nav.skipToContent}
      </a>
      {announcement ? (
        <div className="bg-charcoal px-4 py-2 text-center text-sm text-ivory">{announcement}</div>
      ) : null}
      <header className="sticky top-0 z-40 border-b border-sand/80 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
        <div className="container-page flex h-[var(--header-h)] items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <MobileNav
              links={links}
              searchAction={`/${locale}/shop`}
              searchPlaceholder={dict.nav.searchPlaceholder}
              searchLabel={dict.nav.search}
              menuLabel={dict.nav.menu}
              closeLabel={dict.nav.close}
              dir={dir(locale)}
            />
            <Logo locale={locale} />
          </div>

          <nav aria-label={dict.nav.menu} className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="py-2 font-medium text-ink transition-colors hover:text-burgundy">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <form action={`/${locale}/shop`} method="get" role="search" className="relative hidden md:block">
              <label htmlFor="h-search" className="sr-only">{dict.nav.search}</label>
              <input
                id="h-search"
                name="q"
                type="search"
                placeholder={dict.nav.searchPlaceholder}
                className="input h-11 min-h-0 w-56 rounded-full bg-white/70 py-2 ps-10 text-sm"
                data-testid="header-search"
              />
              <IconSearch size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
            </form>
            <Suspense fallback={null}>
              <LanguageSwitcher locale={locale} label={dict.nav.switchLanguage} ariaLabel={dict.nav.switchLanguageLabel} />
            </Suspense>
            <CartButton
              locale={locale}
              labelFor={{ zero: dict.nav.cartCount(0), one: dict.nav.cartCount(1), many: dict.nav.cartCount(99).replace("99", "{n}") }}
            />
          </div>
        </div>
      </header>
    </>
  );
}
