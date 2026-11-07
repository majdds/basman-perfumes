import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "@/server/page-helpers";
import { readSession } from "@/server/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.login.title, robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  if (await readSession()) redirect(`/${locale}/admin`);
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-[family-name:var(--font-wordmark)] text-5xl text-burgundy" lang="ar">بسمان</p>
          <h1 className="mt-4 text-2xl">{dict.admin.login.title}</h1>
          <p className="text-muted">{dict.admin.login.subtitle}</p>
        </div>
        <div className="card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <LoginForm locale={locale} />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href={`/${locale === "ar" ? "en" : "ar"}/admin/login`} className="link-underline">{dict.nav.switchLanguage}</Link>
        </p>
      </div>
    </main>
  );
}
