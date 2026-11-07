import "server-only";
import { listAllProducts, listCategories } from "../repos/products";
import { getSettings } from "../repos/settings";
import type { Category, Product, StoreSettings } from "@/lib/types";

/**
 * Small in-process cache for the storefront catalogue. Each server instance
 * keeps it for CACHE_MS; admin changes invalidate the local instance at once,
 * and other instances pick changes up within CACHE_MS. Orders always re-read
 * products with strongly consistent reads, so a stale cache can never cause a
 * wrong price or overselling.
 */
const CACHE_MS = 30_000;
let cache: { at: number; data: Promise<CatalogData> } | null = null;

export interface CatalogData {
  products: Product[]; // active products only
  categories: Category[];
  settings: StoreSettings;
}

async function load(): Promise<CatalogData> {
  const [products, categories, settings] = await Promise.all([listAllProducts(), listCategories(), getSettings()]);
  return {
    products: products.filter((p) => p.status === "active"),
    categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    settings,
  };
}

export function getCatalog(): Promise<CatalogData> {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_MS) {
    const data = load();
    cache = { at: now, data };
    data.catch(() => {
      if (cache?.data === data) cache = null;
    });
  }
  return cache.data;
}

export function invalidateCatalog() {
  cache = null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug) ?? null;
}
