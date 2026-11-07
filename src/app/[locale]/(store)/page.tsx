import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog } from "@/server/services/catalog";
import { pageMetadata, resolveLocale } from "@/server/page-helpers";
import { storeJsonLd } from "@/server/structured-data";
import { pick } from "@/lib/i18n";
import { fromPrice } from "@/lib/catalog";
import { imageSrcSet, imageUrl } from "@/lib/media";
import { formatPhoneForDisplay, parsePalestinianPhone, whatsappLink } from "@/lib/phone";
import { ProductCard } from "@/components/store/ProductCard";
import { HeroArt } from "@/components/store/HeroArt";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconArrow, IconCash, IconChat, IconClock, IconFacebook, IconInstagram, IconPhone, IconPin, IconStore, IconTruck, IconWhatsapp,
} from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return pageMetadata({ locale, path: "/", title: `${dict.meta.siteName} — ${dict.meta.tagline}`, description: dict.meta.description });
}

const WHY_ICONS = [IconCash, IconChat, IconTruck, IconStore];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { products, categories, settings } = await getCatalog();
  const low = settings.lowStockThreshold;

  const featured = products.filter((p) => p.featured).slice(0, 4);
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((p) => !featured.slice(0, 4).includes(p)).slice(0, 4);
  const onSale = products.filter((p) => fromPrice(p).salePrice !== null).slice(0, 4);
  const cats = categories
    .map((c) => ({ c, items: products.filter((p) => p.categoryId === c.id) }))
    .filter((x) => x.items.length > 0);
  const phone = parsePalestinianPhone(settings.phone);

  return (
    <>
      <JsonLd data={storeJsonLd(settings, locale)} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-10 py-12 md:grid-cols-[1.05fr_0.95fr] md:py-20 lg:gap-20">
          <div className="order-2 md:order-1">
            <p className="eyebrow">{dict.home.heroEyebrow}</p>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[4rem] lg:leading-[1.1]">{dict.home.heroTitle}</h1>
            <p className="mt-6 max-w-lg text-lg text-muted">{dict.home.heroText}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={`/${locale}/shop`} className="btn btn-primary btn-lg" data-testid="hero-cta">
                {dict.home.heroCta}
                <IconArrow size={20} className="rtl:rotate-180" />
              </Link>
              <Link href={`/${locale}/contact`} className="btn btn-secondary btn-lg">{dict.home.heroSecondary}</Link>
            </div>
            <p className="mt-8 flex items-center gap-2.5 text-sm text-muted">
              <IconCash size={20} className="text-gold" /> {dict.common.codShort}
            </p>
          </div>
          <div className="order-1 mx-auto w-full max-w-md md:order-2 md:max-w-none">
            {settings.heroImageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(settings.heroImageKey, 1200)}
                srcSet={imageSrcSet(settings.heroImageKey)}
                sizes="(min-width: 768px) 45vw, 90vw"
                alt={dict.meta.siteName}
                fetchPriority="high"
                className="aspect-[4/5] w-full rounded-t-[999px] rounded-b-[var(--radius-lg)] object-cover"
              />
            ) : (
              <HeroArt title={dict.meta.siteName} />
            )}
          </div>
        </div>
      </section>

      {products.length === 0 ? (
        <section className="container-page">
          <div className="card">
            <EmptyState
              icon={<IconStore size={30} />}
              title={dict.shop.emptyCatalogTitle}
              text={dict.shop.emptyCatalogText}
              action={<a href={whatsappLink(settings.whatsapp)} className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer"><IconWhatsapp /> {dict.common.whatsapp}</a>}
            />
          </div>
        </section>
      ) : null}

      {/* ── Featured ─────────────────────────────────────────── */}
      {featured.length ? (
        <section className="container-page py-14" aria-labelledby="featured-h">
          <SectionHeading id="featured-h" title={dict.home.featured} subtitle={dict.home.featuredText} href={`/${locale}/shop?sort=featured`} more={dict.common.viewAll} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {featured.map((p, i) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} lowStockThreshold={low} priority={i < 2} />)}
          </div>
        </section>
      ) : null}

      {/* ── Categories ───────────────────────────────────────── */}
      {cats.length ? (
        <section className="bg-cream/70 py-16" aria-labelledby="cats-h">
          <div className="container-page">
            <SectionHeading id="cats-h" title={dict.home.categories} />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map(({ c, items }) => {
                const img = items.find((p) => p.images[0])?.images[0];
                return (
                  <li key={c.id}>
                    <Link href={`/${locale}/shop?category=${encodeURIComponent(c.slug)}`} className="group relative flex h-40 items-end overflow-hidden rounded-[var(--radius-lg)] bg-charcoal p-6 sm:h-52">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl(img.key, 800)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-105 group-hover:opacity-45" />
                      ) : null}
                      <span className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/10 to-transparent" />
                      <span className="relative">
                        <span className="block font-[family-name:var(--font-display)] text-2xl text-ivory">{pick(c.name, locale)}</span>
                        <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-champagne">
                          {dict.shop.resultsCount(items.length)} <IconArrow size={16} className="rtl:rotate-180" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── New arrivals ─────────────────────────────────────── */}
      {newest.length ? (
        <section className="container-page py-16" aria-labelledby="new-h">
          <SectionHeading id="new-h" title={dict.home.newArrivals} href={`/${locale}/shop?sort=newest`} more={dict.common.viewAll} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {newest.map((p) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} lowStockThreshold={low} />)}
          </div>
        </section>
      ) : null}

      {/* ── Brand story ──────────────────────────────────────── */}
      <section className="bg-charcoal py-20 text-ivory" aria-labelledby="about-h">
        <div className="container-page grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="eyebrow text-champagne">{dict.meta.siteName}</p>
            <h2 id="about-h" className="mt-3 text-3xl text-ivory sm:text-4xl">{dict.home.aboutTitle}</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#d9d0c3]">{dict.home.aboutText}</p>
          </div>
          <figure className="border-s-2 border-champagne ps-6 md:ps-10">
            <blockquote className="font-[family-name:var(--font-display-ar)] text-3xl leading-[1.6] text-ivory sm:text-4xl" lang="ar" dir="rtl">
              عطركم من بسمان<br />أكبر ضمان لكم
            </blockquote>
            <figcaption className="mt-4 text-sm text-champagne">— {dict.meta.siteName}</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Sale ─────────────────────────────────────────────── */}
      {onSale.length ? (
        <section className="container-page py-16" aria-labelledby="sale-h">
          <SectionHeading id="sale-h" title={dict.home.sale} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {onSale.map((p) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} lowStockThreshold={low} />)}
          </div>
        </section>
      ) : null}

      {/* ── Why Basman ───────────────────────────────────────── */}
      <section className="container-page py-16" aria-labelledby="why-h">
        <SectionHeading id="why-h" title={dict.home.whyTitle} center />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dict.home.why.map((w, i) => {
            const Icon = WHY_ICONS[i] ?? IconStore;
            return (
              <li key={w.title} className="card p-7 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream text-burgundy"><Icon size={26} /></span>
                <h3 className="mt-5 text-lg">{w.title}</h3>
                <p className="mt-2 text-muted">{w.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Visit us ─────────────────────────────────────────── */}
      <section className="container-page" aria-labelledby="visit-h">
        <div className="grid overflow-hidden rounded-[var(--radius-xl)] border border-sand bg-white md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="eyebrow">{dict.home.visitTitle}</p>
            <h2 id="visit-h" className="mt-3 text-3xl">{dict.meta.siteName}</h2>
            <ul className="mt-7 space-y-4">
              <li className="flex gap-3"><IconPin className="mt-1 shrink-0 text-gold" /><span>{pick(settings.addressText, locale)}</span></li>
              {phone ? (
                <li className="flex gap-3"><IconPhone className="mt-0.5 shrink-0 text-gold" /><a className="ltr-nums link-underline" href={`tel:${phone.e164}`}>{formatPhoneForDisplay(phone.national)}</a></li>
              ) : null}
              <li className="flex gap-3"><IconClock className="mt-0.5 shrink-0 text-gold" /><span>{pick(settings.hours, locale) || dict.contact.hoursPending}</span></li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp"><IconWhatsapp /> {dict.common.whatsapp}</a>
              {settings.mapsUrl ? (
                <a href={settings.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><IconPin /> {dict.contact.directions}</a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-center gap-5 bg-cream p-8 sm:p-12">
            <p className="font-[family-name:var(--font-display)] text-2xl text-charcoal">{dict.home.followUs}</p>
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between rounded-[var(--radius-md)] border border-sand bg-white p-5 hover:border-champagne">
              <span className="flex items-center gap-3"><IconInstagram className="text-burgundy" /> <span dir="ltr">@basman_perfumes</span></span>
              <IconArrow size={18} className="text-muted rtl:rotate-180" />
            </a>
            <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between rounded-[var(--radius-md)] border border-sand bg-white p-5 hover:border-champagne">
              <span className="flex items-center gap-3"><IconFacebook className="text-burgundy" /> <span dir="ltr">Basman بسمان</span></span>
              <IconArrow size={18} className="text-muted rtl:rotate-180" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ id, title, subtitle, href, more, center }: { id: string; title: string; subtitle?: string; href?: string; more?: string; center?: boolean }) {
  return (
    <div className={`mb-9 flex flex-wrap items-end justify-between gap-4 ${center ? "justify-center text-center" : ""}`}>
      <div>
        <h2 id={id} className="text-3xl sm:text-[2.4rem]">{title}</h2>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        <div className={`mt-4 h-px w-16 bg-champagne ${center ? "mx-auto" : ""}`} />
      </div>
      {href && more ? (
        <Link href={href} className="inline-flex items-center gap-1.5 font-semibold text-burgundy hover:text-burgundy-deep">
          {more} <IconArrow size={18} className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}
