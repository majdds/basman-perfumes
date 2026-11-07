import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function NotFound() {
  const h = await headers();
  const l = h.get("x-locale");
  const locale = isLocale(l) ? l : "ar";
  const dict = getDictionary(locale);
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <p className="font-[family-name:var(--font-display-en)] text-7xl text-champagne">404</p>
      <h1 className="mt-4 text-3xl">{dict.errors.notFoundTitle}</h1>
      <p className="mt-3 text-muted">{dict.errors.notFoundText}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href={`/${locale}/shop`} className="btn btn-primary">{dict.home.heroCta}</Link>
        <Link href={`/${locale}`} className="btn btn-secondary">{dict.nav.home}</Link>
      </div>
    </div>
  );
}
