import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog } from "@/server/services/catalog";
import { pageMetadata, resolveLocale } from "@/server/page-helpers";
import { brandsOf, filterProducts, paginate, type CatalogFilters, type SortKey } from "@/lib/catalog";
import { pick } from "@/lib/i18n";
import type { Gender } from "@/lib/types";
import { ProductCard } from "@/components/store/ProductCard";
import { AutoSubmitSelect } from "@/components/store/AutoSubmit";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconSearch, IconChevron } from "@/components/ui/icons";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 80);

function parseFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters {
  const sort = one(sp.sort);
  const gender = one(sp.gender);
  return {
    q: one(sp.q)?.trim() || undefined,
    category: one(sp.category) || undefined,
    brand: one(sp.brand) || undefined,
    gender: gender === "men" || gender === "women" || gender === "unisex" ? (gender as Gender) : undefined,
    sort: (["newest", "priceAsc", "priceDesc", "featured"] as const).includes(sort as SortKey) ? (sort as SortKey) : "newest",
    page: Number(one(sp.page)) || 1,
  };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SP }): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  const f = parseFilters(await searchParams);
  const meta = pageMetadata({ locale, path: "/shop", title: f.q ? dict.shop.searchResultsFor(f.q) : dict.shop.allProducts, description: dict.meta.description });
  // Filtered/search result pages should not compete with the main listing in search engines.
  return f.q || f.brand || f.gender || (f.page ?? 1) > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ShopPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SP }) {
  const { locale, dict } = await resolveLocale(params);
  const f = parseFilters(await searchParams);
  const { products, categories, settings } = await getCatalog();
  const results = filterProducts(products, categories, f);
  const { items, page, totalPages, total } = paginate(results, f.page ?? 1);
  const brands = brandsOf(products);
  const hasFilters = Boolean(f.q || f.category || f.brand || f.gender);
  const activeCategory = categories.find((c) => c.slug === f.category);

  const qs = (overrides: Partial<Record<keyof CatalogFilters, string | number | undefined>>) => {
    const p = new URLSearchParams();
    const merged = { q: f.q, category: f.category, brand: f.brand, gender: f.gender, sort: f.sort === "newest" ? undefined : f.sort, page: undefined, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/${locale}/shop${s ? `?${s}` : ""}`;
  };

  const title = f.q ? dict.shop.searchResultsFor(f.q) : activeCategory ? pick(activeCategory.name, locale) : dict.shop.allProducts;

  const filterForm = (
    <form method="get" action={`/${locale}/shop`} className="space-y-6" aria-label={dict.shop.filters}>
      {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
      <fieldset>
        <legend className="field-label">{dict.shop.category}</legend>
        <div className="space-y-1">
          <Radio name="category" value="" checked={!f.category} label={dict.shop.all} />
          {categories.map((c) => <Radio key={c.id} name="category" value={c.slug} checked={f.category === c.slug} label={pick(c.name, locale)} />)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label">{dict.shop.gender}</legend>
        <div className="space-y-1">
          <Radio name="gender" value="" checked={!f.gender} label={dict.shop.all} />
          {(["women", "men", "unisex"] as const).map((g) => <Radio key={g} name="gender" value={g} checked={f.gender === g} label={dict.gender[g]} />)}
        </div>
      </fieldset>
      {brands.length > 1 ? (
        <div>
          <label htmlFor="f-brand" className="field-label">{dict.shop.brand}</label>
          <select id="f-brand" name="brand" defaultValue={f.brand ?? ""} className="input">
            <option value="">{dict.shop.all}</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      ) : null}
      <input type="hidden" name="sort" value={f.sort} />
      <div className="flex flex-col gap-2">
        <button className="btn btn-dark btn-block">{dict.shop.applyFilters}</button>
        {hasFilters ? <Link href={`/${locale}/shop`} className="btn btn-ghost btn-block">{dict.shop.clearFilters}</Link> : null}
      </div>
    </form>
  );

  return (
    <div className="container-page py-10 md:py-14">
      <header className="mb-8 border-b border-sand pb-8">
        <nav aria-label="breadcrumb" className="text-sm text-muted">
          <Link href={`/${locale}`} className="hover:text-burgundy">{dict.nav.home}</Link>
          <IconChevron size={14} className="mx-1.5 inline rtl:rotate-180" />
          <span>{dict.shop.title}</span>
        </nav>
        <h1 className="mt-3 text-4xl">{title}</h1>
        <form method="get" action={`/${locale}/shop`} role="search" className="mt-6 flex max-w-xl gap-2">
          {f.category ? <input type="hidden" name="category" value={f.category} /> : null}
          <label htmlFor="shop-q" className="sr-only">{dict.nav.search}</label>
          <input id="shop-q" name="q" type="search" defaultValue={f.q} placeholder={dict.nav.searchPlaceholder} className="input" data-testid="shop-search" enterKeyHint="search" />
          <button className="btn btn-dark px-5" aria-label={dict.nav.search}><IconSearch /></button>
        </form>
      </header>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{filterForm}</aside>

        <section aria-labelledby="results-h">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-h" className="font-sans text-base font-normal text-muted" data-testid="results-count">{dict.shop.resultsCount(total)}</h2>
            <div className="flex items-center gap-2">
              <details className="relative lg:hidden">
                <summary className="btn btn-secondary btn-sm cursor-pointer list-none">{dict.shop.filters}</summary>
                <div className="fixed inset-x-4 top-[calc(var(--header-h)+12px)] z-30 max-h-[75dvh] overflow-y-auto rounded-[var(--radius-lg)] border border-sand bg-ivory p-5 shadow-[var(--shadow-lift)]">{filterForm}</div>
              </details>
              <form method="get" action={`/${locale}/shop`} className="flex items-center gap-2">
                {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
                {f.category ? <input type="hidden" name="category" value={f.category} /> : null}
                {f.brand ? <input type="hidden" name="brand" value={f.brand} /> : null}
                {f.gender ? <input type="hidden" name="gender" value={f.gender} /> : null}
                <label htmlFor="sort" className="sr-only">{dict.shop.sort}</label>
                <AutoSubmitSelect id="sort" name="sort" defaultValue={f.sort} className="input h-10 min-h-0 py-1.5 text-sm" data-testid="sort">
                  <option value="newest">{dict.shop.sortOptions.newest}</option>
                  <option value="priceAsc">{dict.shop.sortOptions.priceAsc}</option>
                  <option value="priceDesc">{dict.shop.sortOptions.priceDesc}</option>
                  <option value="featured">{dict.shop.sortOptions.featured}</option>
                </AutoSubmitSelect>
                <noscript><button className="btn btn-sm btn-secondary">{dict.shop.sort}</button></noscript>
              </form>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="card">
              {products.length === 0 ? (
                <EmptyState icon={<IconSearch size={28} />} title={dict.shop.emptyCatalogTitle} text={dict.shop.emptyCatalogText} />
              ) : (
                <EmptyState
                  icon={<IconSearch size={28} />}
                  title={dict.shop.noResultsTitle}
                  text={dict.shop.noResultsText}
                  action={<Link href={`/${locale}/shop`} className="btn btn-secondary">{dict.shop.clearFilters}</Link>}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6">
              {items.map((p, i) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} lowStockThreshold={settings.lowStockThreshold} priority={i < 2} />)}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="mt-14 flex items-center justify-center gap-3" aria-label={dict.shop.page(page, totalPages)}>
              {page > 1 ? <Link className="btn btn-secondary btn-sm" href={qs({ page: page - 1 })} rel="prev">{dict.shop.previous}</Link> : null}
              <span className="text-sm text-muted">{dict.shop.page(page, totalPages)}</span>
              {page < totalPages ? <Link className="btn btn-secondary btn-sm" href={qs({ page: page + 1 })} rel="next">{dict.shop.next}</Link> : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Radio({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-cream">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-[var(--color-burgundy)]" />
      <span>{label}</span>
    </label>
  );
}
