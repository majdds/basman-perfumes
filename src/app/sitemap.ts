import type { MetadataRoute } from "next";
import { getCatalog } from "@/server/services/catalog";
import { siteUrl } from "@/server/page-helpers";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { products, categories } = await getCatalog();
  const entry = (path: string, lastModified?: string, priority = 0.7): MetadataRoute.Sitemap[number] => ({
    url: `${base}/ar${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    alternates: { languages: { ar: `${base}/ar${path}`, en: `${base}/en${path}` } },
  });
  return [
    entry("", undefined, 1),
    entry("/shop", undefined, 0.9),
    entry("/contact", undefined, 0.6),
    entry("/privacy", undefined, 0.2),
    ...categories.map((c) => entry(`/shop?category=${encodeURIComponent(c.slug)}`, undefined, 0.6)),
    ...products.filter((p) => !p.isDemo).map((p) => entry(`/products/${encodeURIComponent(p.slug)}`, p.updatedAt, 0.8)),
  ];
}
