import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCatalog, getProductBySlug } from "@/server/services/catalog";
import { pageMetadata, resolveLocale, siteUrl } from "@/server/page-helpers";
import { productJsonLd } from "@/server/structured-data";
import { maxOrderable, variantAvailability, fromPrice } from "@/lib/catalog";
import { pick } from "@/lib/i18n";
import { imageUrl } from "@/lib/media";
import { formatPrice } from "@/lib/money";
import { hasValidSale } from "@/lib/pricing";
import { whatsappLink } from "@/lib/phone";
import { AddToCart, type VariantView } from "@/components/store/AddToCart";
import { ProductGallery } from "@/components/store/ProductGallery";
import { ProductCard } from "@/components/store/ProductCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { IconCash, IconChevron, IconInfo, IconTruck, IconWhatsapp } from "@/components/ui/icons";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const p = await getProductBySlug(decodeURIComponent(slug));
  if (!p) return { title: dict.errors.notFoundTitle, robots: { index: false } };
  const name = pick(p.name, locale);
  const price = fromPrice(p);
  const desc = (pick(p.description, locale) || `${p.brand} — ${name}`).slice(0, 155);
  const img = p.images[0] ? imageUrl(p.images[0].key, 1200) : undefined;
  const meta = pageMetadata({
    locale,
    path: `/products/${encodeURIComponent(p.slug)}`,
    title: `${name} — ${p.brand} · ${formatPrice(price.salePrice ?? price.price, locale)}`,
    description: desc,
    image: img ? (img.startsWith("http") ? img : `${siteUrl()}${img}`) : undefined,
  });
  return p.isDemo ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, dict } = await resolveLocale(params);
  const { slug } = await params;
  const product = await getProductBySlug(decodeURIComponent(slug));
  if (!product) notFound();
  const { products, categories, settings } = await getCatalog();
  const low = settings.lowStockThreshold;
  const name = pick(product.name, locale);
  const category = categories.find((c) => c.id === product.categoryId);
  const description = pick(product.description, locale);

  const variants: VariantView[] = product.variants.map((v) => {
    const availability = variantAvailability(product, v, low);
    return {
      id: v.id,
      label: pick(v.label, locale) || (v.sizeMl ? `${v.sizeMl} ${locale === "ar" ? "مل" : "ml"}` : name),
      price: v.price,
      salePrice: hasValidSale(v) ? v.salePrice! : null,
      maxQty: maxOrderable(product, v),
      availability,
      stockLeft: availability === "low_stock" ? (v.stock ?? null) : null,
    };
  });

  const url = `${siteUrl()}/${locale}/products/${encodeURIComponent(product.slug)}`;
  const related = products.filter((p) => p.id !== product.id && (p.categoryId === product.categoryId || p.brand === product.brand)).slice(0, 4);
  const details: [string, string][] = [
    [dict.product.brand, product.brand],
    ...(product.fragranceFamily && pick(product.fragranceFamily, locale) ? [[dict.product.family, pick(product.fragranceFamily, locale)] as [string, string]] : []),
    ...(product.gender ? [[dict.product.gender, dict.gender[product.gender]] as [string, string]] : []),
    ...(product.variants.some((v) => v.sizeMl) ? [[dict.product.size, product.variants.filter((v) => v.sizeMl).map((v) => `${v.sizeMl} ${locale === "ar" ? "مل" : "ml"}`).join(" · ")] as [string, string]] : []),
  ];

  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd data={productJsonLd(product, locale, low)} />
      <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted">
        <Link href={`/${locale}`} className="hover:text-burgundy">{dict.nav.home}</Link>
        <IconChevron size={14} className="mx-1.5 inline rtl:rotate-180" />
        <Link href={`/${locale}/shop`} className="hover:text-burgundy">{dict.shop.title}</Link>
        {category ? (
          <>
            <IconChevron size={14} className="mx-1.5 inline rtl:rotate-180" />
            <Link href={`/${locale}/shop?category=${encodeURIComponent(category.slug)}`} className="hover:text-burgundy">{pick(category.name, locale)}</Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={name} labels={product.images.map((_, i) => dict.product.imageOf(name, i + 1))} />

        <div className="lg:pt-4">
          <p className="eyebrow">{product.brand}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl" data-testid="product-title">{name}</h1>
          {product.isDemo ? (
            <p className="alert alert-warning mt-5 text-sm"><IconInfo size={18} className="shrink-0" /> {dict.product.demoNotice}</p>
          ) : null}
          <div className="my-7 h-px bg-sand" />
          <AddToCart
            productId={product.id}
            variants={variants}
            locale={locale}
            labels={{
              size: dict.product.chooseSize,
              quantity: dict.product.quantity,
              increase: dict.product.increase,
              decrease: dict.product.decrease,
              addToCart: dict.product.addToCart,
              added: dict.product.added,
              viewCart: dict.product.viewCart,
              inStock: dict.product.inStock,
              lowStock: dict.product.lowStock(999).replace("999", "{n}"),
              outOfStock: dict.product.outOfStock,
              unavailable: dict.product.unavailable,
              maxReached: dict.product.maxReached,
              priceWas: dict.product.priceWas,
            }}
          />
          <ul className="mt-8 space-y-3 rounded-[var(--radius-lg)] bg-cream p-5 text-sm">
            <li className="flex items-center gap-3"><IconCash size={20} className="text-gold" /> {dict.common.codShort}</li>
            <li className="flex items-center gap-3"><IconTruck size={20} className="text-gold" /> {dict.home.why[2]!.text}</li>
          </ul>

          {description ? (
            <section className="mt-10">
              <h2 className="text-xl">{dict.product.description}</h2>
              <div className="prose-basman mt-3 whitespace-pre-line text-ink">{description}</div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-xl">{dict.product.details}</h2>
            <dl className="mt-3 divide-y divide-sand border-y border-sand">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn btn-secondary btn-sm" href={whatsappLink("", `${name}\n${url}`)} target="_blank" rel="noopener noreferrer">
              <IconWhatsapp size={18} /> {dict.product.shareWhatsapp}
            </a>
            <a className="btn btn-ghost btn-sm" href={whatsappLink(settings.whatsapp, `${name}\n${url}`)} target="_blank" rel="noopener noreferrer">
              {dict.product.askWhatsapp}
            </a>
          </div>
        </div>
      </div>

      {related.length ? (
        <section className="mt-20" aria-labelledby="rel-h">
          <h2 id="rel-h" className="mb-8 text-3xl">{dict.product.related}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} lowStockThreshold={low} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
