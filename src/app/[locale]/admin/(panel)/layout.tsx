import Link from "next/link";
import type { Metadata } from "next";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { newOrdersSummary } from "@/server/services/admin-orders";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewOrderWatcher } from "@/components/admin/NewOrderWatcher";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { IconEye, IconGlobe } from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: { default: dict.admin.title, template: `%s — ${dict.admin.brand}` }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const session = await requireAdminPage(locale);
  const { newCount } = await newOrdersSummary();
  const base = `/${locale}/admin`;
  const items = [
    { key: "overview" as const, href: base, label: dict.admin.nav.overview },
    { key: "orders" as const, href: `${base}/orders`, label: dict.admin.nav.orders, badge: newCount || undefined },
    { key: "products" as const, href: `${base}/products`, label: dict.admin.nav.products },
    { key: "categories" as const, href: `${base}/categories`, label: dict.admin.nav.categories },
    { key: "settings" as const, href: `${base}/settings`, label: dict.admin.nav.settings },
  ];
  return (
    <AdminProviders locale={locale}>
      <div className="min-h-dvh bg-cream/60 pb-24 lg:pb-0">
        <header className="no-print sticky top-0 z-30 border-b border-sand bg-ivory">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
            <Link href={base} className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-wordmark)] text-3xl text-burgundy" lang="ar">بسمان</span>
              <span className="hidden text-sm text-muted sm:inline">{dict.admin.title}</span>
            </Link>
            <div className="flex items-center gap-1">
              <NewOrderWatcher locale={locale} initialNew={newCount} />
              <Link href={`/${locale}`} className="btn btn-ghost btn-sm hidden sm:inline-flex" target="_blank"><IconEye size={20} /> {dict.admin.nav.viewStore}</Link>
              <Link href={`/${locale === "ar" ? "en" : "ar"}/admin`} className="btn btn-ghost btn-sm" aria-label={dict.nav.switchLanguageLabel}><IconGlobe size={20} /> {dict.nav.switchLanguage}</Link>
              <LogoutButton locale={locale} label={dict.admin.nav.logout} />
            </div>
          </div>
        </header>
        <div className="flex">
          <aside className="no-print sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 border-e border-sand bg-ivory p-4 lg:block">
            <AdminNav items={items} variant="side" />
            <p className="mt-6 border-t border-sand px-4 pt-4 text-sm text-muted">{session.displayName}</p>
          </aside>
          <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
        </div>
        <AdminNav items={items} variant="bottom" />
      </div>
    </AdminProviders>
  );
}
