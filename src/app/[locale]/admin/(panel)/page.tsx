import Link from "next/link";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { dashboardStats } from "@/server/services/admin-orders";
import { listOrders } from "@/server/repos/orders";
import { pick } from "@/lib/i18n";
import { OrderList } from "@/components/admin/OrderList";
import { RemoveDemoButton } from "@/components/admin/RemoveDemoButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlert, IconCheck, IconList, IconPlus } from "@/components/ui/icons";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const session = await requireAdminPage(locale);
  const [stats, recent] = await Promise.all([dashboardStats(), listOrders({ status: "all", limit: 6 })]);
  const t = dict.admin.overview;

  const cards = [
    { label: t.newOrders, value: stats.newCount, href: `/${locale}/admin/orders?status=new`, highlight: stats.newCount > 0, testid: "stat-new" },
    { label: t.openOrders, value: stats.openCount, href: `/${locale}/admin/orders?status=open` },
    { label: t.todayOrders, value: stats.todayCount, href: `/${locale}/admin/orders` },
    { label: t.totalOrders, value: stats.totalCount, href: `/${locale}/admin/orders` },
    { label: t.products, value: stats.productCount, href: `/${locale}/admin/products` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl">{t.greeting(session.displayName)}</h1>
        <div className="flex flex-wrap gap-3">
          <Link href={`/${locale}/admin/products/new`} className="btn btn-primary"><IconPlus /> {t.addProduct}</Link>
          <Link href={`/${locale}/admin/orders?status=new`} className="btn btn-secondary"><IconList /> {t.seeNewOrders}</Link>
        </div>
      </div>

      {stats.demoCount > 0 ? (
        <div className="alert alert-warning flex-wrap items-center justify-between">
          <span className="flex items-center gap-2 font-semibold"><IconAlert className="shrink-0" /> {t.demoBanner}</span>
          {session.role === "owner" ? <RemoveDemoButton /> : null}
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className={`block rounded-[var(--radius-lg)] border p-5 transition hover:shadow-[var(--shadow-soft)] ${c.highlight ? "border-burgundy bg-burgundy text-ivory" : "border-sand bg-white"}`} data-testid={c.testid}>
              <span className={`block text-sm font-semibold ${c.highlight ? "text-ivory/85" : "text-muted"}`}>{c.label}</span>
              <span className="ltr-nums mt-2 block font-sans text-4xl font-bold">{c.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="recent-h">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent-h" className="text-xl">{t.recentOrders}</h2>
            <Link href={`/${locale}/admin/orders`} className="font-semibold text-burgundy">{dict.common.viewAll}</Link>
          </div>
          {recent.orders.length ? (
            <OrderList orders={recent.orders} locale={locale} dict={dict} />
          ) : (
            <div className="card"><EmptyState icon={<IconList size={28} />} title={dict.admin.orders.empty} /></div>
          )}
        </section>
        <section aria-labelledby="stock-h" className="h-fit rounded-[var(--radius-lg)] border border-sand bg-white p-5">
          <h2 id="stock-h" className="text-xl">{t.lowStock}</h2>
          {stats.lowStock.length ? (
            <>
              <p className="mt-2 text-sm text-muted">{t.lowStockText}</p>
              <ul className="mt-3 divide-y divide-sand">
                {stats.lowStock.slice(0, 12).map(({ product, variant }) => (
                  <li key={`${product.id}:${variant.id}`}>
                    <Link href={`/${locale}/admin/products/${product.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-burgundy">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{pick(product.name, locale)}</span>
                        {pick(variant.label, locale) ? <span className="text-sm text-muted">{pick(variant.label, locale)}</span> : null}
                      </span>
                      <span className={`ltr-nums badge ${(variant.stock ?? 0) === 0 ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>{variant.stock ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-success"><IconCheck /> {t.noLowStock}</p>
          )}
        </section>
      </div>
    </div>
  );
}
