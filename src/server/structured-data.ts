import "server-only";
import { BUSINESS } from "@/config/business";
import { fromPrice, productAvailability } from "@/lib/catalog";
import { pick } from "@/lib/i18n";
import { imageUrl } from "@/lib/media";
import { agorotToShekels } from "@/lib/money";
import type { Locale, Product, StoreSettings } from "@/lib/types";
import { siteUrl } from "./page-helpers";

export function storeJsonLd(settings: StoreSettings, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${siteUrl()}/#store`,
    name: locale === "ar" ? BUSINESS.nameAr : BUSINESS.nameEn,
    alternateName: locale === "ar" ? BUSINESS.nameEn : BUSINESS.nameAr,
    url: `${siteUrl()}/${locale}`,
    telephone: settings.phone,
    image: `${siteUrl()}/og-${locale}.png`,
    priceRange: "₪₪",
    currenciesAccepted: "ILS",
    paymentAccepted: "Cash",
    address: {
      "@type": "PostalAddress",
      streetAddress: pick(settings.addressText, locale),
      addressLocality: pick(BUSINESS.city, locale),
      addressCountry: BUSINESS.country,
    },
    areaServed: { "@type": "Country", name: "Palestine" },
    ...(settings.mapsUrl ? { hasMap: settings.mapsUrl } : {}),
    sameAs: [settings.instagramUrl, settings.facebookUrl],
  };
}

export function productJsonLd(p: Product, locale: Locale, lowStockThreshold: number) {
  const a = productAvailability(p, lowStockThreshold);
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    price: agorotToShekels(v.salePrice && v.salePrice < v.price ? v.salePrice : v.price).toFixed(2),
    priceCurrency: "ILS",
    availability:
      a === "out_of_stock" || a === "unavailable" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    url: `${siteUrl()}/${locale}/products/${encodeURIComponent(p.slug)}`,
    seller: { "@id": `${siteUrl()}/#store` },
    ...(pick(v.label, locale) ? { name: pick(v.label, locale) } : {}),
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pick(p.name, locale),
    brand: { "@type": "Brand", name: p.brand },
    description: pick(p.description, locale) || undefined,
    image: p.images.map((i) => `${imageUrl(i.key, 1200).startsWith("http") ? "" : siteUrl()}${imageUrl(i.key, 1200)}`),
    sku: p.variants[0]?.sku ?? undefined,
    offers: offers.length === 1 ? offers[0] : { "@type": "AggregateOffer", priceCurrency: "ILS", lowPrice: agorotToShekels(fromPrice(p).salePrice ?? fromPrice(p).price).toFixed(2), offerCount: offers.length, offers },
  };
}
