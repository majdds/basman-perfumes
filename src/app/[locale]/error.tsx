"use client";

import { useParams } from "next/navigation";
import { getDictionary, isLocale } from "@/lib/i18n";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale: string }>();
  const locale = isLocale(params?.locale) ? params.locale : "ar";
  const dict = getDictionary(locale);
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="text-3xl">{dict.errors.errorTitle}</h1>
      <p className="mt-3 text-muted">{dict.errors.errorText}</p>
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">{dict.common.retry}</button>
        <a href={`/${locale}`} className="btn btn-secondary">{dict.nav.home}</a>
      </div>
    </div>
  );
}
