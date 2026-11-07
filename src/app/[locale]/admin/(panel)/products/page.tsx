import Link from "next/link";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { listAllProducts } from "@/server/repos/products";
import { getSettings } from "@/server/repos/settings";
import { pick } from "@/lib/i18n";
import { fromPrice, searchableText } from "@/lib/catalog";
import { matchesQuery } from "@/lib/search";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/store/ProductImage";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBox, IconPlus, IconSearch } from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.products.title };
}

export default async function AdminProducts({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; archived?: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const session = await requireAdminPage(locale);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const showArchived = sp.archived === "1";
  const [all, settings] = await Promise.all([listAllProducts(), getSettings()]);
  const list = all
    .filter((p) => (showArchived ? p.status === "archived" : p.status === "active"))
    .filter((p) => !q || matchesQuery(searchableText(p), q));
  const t = dict.admin.products;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{t.title}</h1>
        <Link href={`/${locale}/admin/products/new`} className="btn btn-primary" data-testid="add-product"><IconPlus /> {t.add}</Link>
      </div>
      <form method="get" className="flex flex-wrap gap-3">
        <label htmlFor="pq" className="sr-only">{t.search}</label>
        <input id="pq" name="q" defaultValue={q} placeholder={t.search} className="input max-w-md flex-1" />
        {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        <button className="btn btn-dark"><IconSearch /></button>
        <Link href={showArchived ? `?` : `?archived=1`} className="btn btn-ghost border border-sand bg-white">{showArchived ? t.visible : t.showArchived}</Link>
      </form>

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={<IconBox size={28} />} title={t.empty} text={q ? undefined : t.emptyText} /></div>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => {
            const price = fromPrice(p);
            const tracked = p.variants.filter((v) => v.trackStock);
            const stock = tracked.reduce((n, v) => n + (v.stock ?? 0), 0);
            const low = tracked.some((v) => (v.stock ?? 0) <= settings.lowStockThreshold);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-sand bg-white p-3 sm:p-4" data-testid="admin-product">
                <Link href={`/${locale}/admin/products/${p.id}`} className="w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)]">
                  <ProductImage image={p.images[0]} alt="" sizes="64px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/${locale}/admin/products/${p.id}`} className="block truncate text-lg font-semibold text-charcoal hover:text-burgundy">{pick(p.name, locale)}</Link>
                  <p className="text-sm text-muted">{p.brand}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.isDemo ? <span className="badge bg-warning-soft text-warning">{dict.common.demo}</span> : null}
                    {p.featured ? <span className="badge bg-champagne/25 text-gold">{t.featured}</span> : null}
                    {!p.available ? <span className="badge bg-sand text-muted">{t.hidden}</span> : null}
                  </div>
                </div>
                <div className="text-end">
                  <Price price={price.price} salePrice={price.salePrice} locale={locale} />
                  <p className={`text-sm ${low ? "font-semibold text-warning" : "text-muted"}`}>
                    {t.stock}: <span className="ltr-nums">{tracked.length ? stock : t.untracked}</span>
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Link href={`/${locale}/admin/products/${p.id}`} className="btn btn-dark btn-sm">{dict.common.edit}</Link>
                  <ProductRowActions id={p.id} status={p.status} canDelete={session.role === "owner"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
