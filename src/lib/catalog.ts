import { matchesQuery } from "./search";
import { effectivePrice, hasValidSale, availableQuantity } from "./pricing";
import type { Category, Gender, Locale, Product, ProductVariant } from "./types";
import { pick } from "./i18n";

export const PAGE_SIZE = 12;
export type SortKey = "newest" | "priceAsc" | "priceDesc" | "featured";

export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "unavailable";

export function variantAvailability(p: Product, v: ProductVariant, lowThreshold: number): Availability {
  if (!p.available || p.status !== "active") return "unavailable";
  if (!v.trackStock) return "in_stock";
  const stock = v.stock ?? 0;
  if (stock <= 0) return "out_of_stock";
  if (stock <= lowThreshold) return "low_stock";
  return "in_stock";
}

/** Best (lowest) effective price across the purchasable variants, for cards and sorting. */
export function fromPrice(p: Product) {
  const sorted = [...p.variants].sort((a, b) => effectivePrice(a) - effectivePrice(b));
  const v = sorted[0]!;
  return { price: v.price, salePrice: hasValidSale(v) ? v.salePrice! : null, multiple: p.variants.length > 1 };
}

export function productAvailability(p: Product, lowThreshold: number): Availability {
  const states = p.variants.map((v) => variantAvailability(p, v, lowThreshold));
  if (states.includes("in_stock")) return "in_stock";
  if (states.includes("low_stock")) return "low_stock";
  if (states.includes("unavailable")) return "unavailable";
  return "out_of_stock";
}

export interface CatalogFilters {
  q?: string;
  category?: string; // category slug
  gender?: Gender;
  brand?: string;
  sort?: SortKey;
  page?: number;
}

export function searchableText(p: Product): string {
  return [p.name.ar, p.name.en, p.brand, p.fragranceFamily?.ar, p.fragranceFamily?.en, p.description.ar, p.description.en]
    .filter(Boolean)
    .join(" ");
}

export function filterProducts(products: Product[], categories: Category[], f: CatalogFilters): Product[] {
  const cat = f.category ? categories.find((c) => c.slug === f.category) : undefined;
  let list = products.filter((p) => p.status === "active");
  if (f.category) list = cat ? list.filter((p) => p.categoryId === cat.id) : [];
  if (f.gender) list = list.filter((p) => p.gender === f.gender || (f.gender !== "unisex" && p.gender === "unisex"));
  if (f.brand) list = list.filter((p) => p.brand.toLowerCase() === f.brand!.toLowerCase());
  if (f.q?.trim()) list = list.filter((p) => matchesQuery(searchableText(p), f.q!));
  return sortProducts(list, f.sort ?? "newest");
}

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const copy = [...list];
  const price = (p: Product) => effectivePrice({ price: fromPrice(p).price, salePrice: fromPrice(p).salePrice });
  switch (sort) {
    case "priceAsc":
      return copy.sort((a, b) => price(a) - price(b) || b.createdAt.localeCompare(a.createdAt));
    case "priceDesc":
      return copy.sort((a, b) => price(b) - price(a) || b.createdAt.localeCompare(a.createdAt));
    case "featured":
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt));
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function paginate<T>(list: T[], page: number, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return { items: list.slice((current - 1) * size, current * size), page: current, totalPages, total: list.length };
}

export function brandsOf(products: Product[]): string[] {
  return [...new Set(products.filter((p) => p.status === "active").map((p) => p.brand))].sort((a, b) => a.localeCompare(b));
}

export function maxOrderable(p: Product, v: ProductVariant): number {
  if (!p.available || p.status !== "active") return 0;
  return availableQuantity(v);
}

export function productTitle(p: Product, locale: Locale): string {
  return pick(p.name, locale);
}
