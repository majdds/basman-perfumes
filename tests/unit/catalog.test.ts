import { describe, expect, it } from "vitest";
import { brandsOf, filterProducts, fromPrice, paginate, productAvailability } from "@/lib/catalog";
import { priceCart } from "@/lib/order-pricing";
import type { Category, Product } from "@/lib/types";

const cat: Category = { id: "c1", slug: "oriental", name: { ar: "شرقي", en: "Oriental" }, sortOrder: 1, isDemo: false };
const mk = (id: string, over: Partial<Product> = {}): Product => ({
  id, slug: id, name: { ar: `عطر ${id}`, en: `Scent ${id}` }, brand: "Basman", description: { ar: "", en: "" }, categoryId: null, gender: null,
  fragranceFamily: null, images: [], featured: false, available: true, status: "active", isDemo: false,
  createdAt: `2026-01-0${id.length}T00:00:00Z`, updatedAt: "", version: 1,
  variants: [{ id: "v1", label: { ar: "", en: "" }, price: 10000, salePrice: null, trackStock: false }],
  ...over,
});

describe("catalogue filtering", () => {
  const list = [
    mk("a", { categoryId: "c1", gender: "men", brand: "Dior", createdAt: "2026-01-01T00:00:00Z" }),
    mk("b", { gender: "women", brand: "Gucci", featured: true, createdAt: "2026-01-02T00:00:00Z", variants: [{ id: "v", label: { ar: "", en: "" }, price: 30000, salePrice: 5000, trackStock: false }] }),
    mk("c", { gender: "unisex", status: "archived", createdAt: "2026-01-03T00:00:00Z" }),
    mk("d", { gender: "unisex", name: { ar: "مسك أبيض", en: "White Musk" }, createdAt: "2026-01-04T00:00:00Z", variants: [{ id: "v", label: { ar: "", en: "" }, price: 20000, salePrice: null, trackStock: false }] }),
  ];
  it("hides archived products", () => expect(filterProducts(list, [cat], {}).map((p) => p.id)).toEqual(["d", "b", "a"]));
  it("filters by category slug, gender (incl. unisex), brand, query", () => {
    expect(filterProducts(list, [cat], { category: "oriental" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterProducts(list, [cat], { category: "missing" })).toEqual([]);
    expect(filterProducts(list, [cat], { gender: "men" }).map((p) => p.id).sort()).toEqual(["a", "d"]);
    expect(filterProducts(list, [cat], { brand: "gucci" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterProducts(list, [cat], { q: "ابيض" }).map((p) => p.id)).toEqual(["d"]);
  });
  it("sorts by effective price and newest", () => {
    expect(filterProducts(list, [cat], { sort: "priceAsc" }).map((p) => p.id)).toEqual(["b", "a", "d"]);
    expect(filterProducts(list, [cat], { sort: "priceDesc" }).map((p) => p.id)).toEqual(["d", "a", "b"]);
    expect(filterProducts(list, [cat], { sort: "featured" })[0]!.id).toBe("b");
  });
  it("paginates and clamps page numbers", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 3, 12)).toMatchObject({ page: 3, totalPages: 3, items: [24] });
    expect(paginate(items, 99, 12).page).toBe(3);
    expect(paginate(items, -2, 12).page).toBe(1);
  });
  it("lists brands of active products only", () => expect(brandsOf(list)).toEqual(["Basman", "Dior", "Gucci"]));
  it("never invents a sale", () => expect(fromPrice(mk("x")).salePrice).toBeNull());
});

describe("availability", () => {
  it("reflects real stock only", () => {
    const tracked = (stock: number) => mk("t", { variants: [{ id: "v", label: { ar: "", en: "" }, price: 1, trackStock: true, stock }] });
    expect(productAvailability(tracked(0), 3)).toBe("out_of_stock");
    expect(productAvailability(tracked(2), 3)).toBe("low_stock");
    expect(productAvailability(tracked(10), 3)).toBe("in_stock");
    expect(productAvailability(mk("u", { available: false }), 3)).toBe("unavailable");
  });
});

describe("server-side cart pricing", () => {
  const p = mk("p", { variants: [
    { id: "v1", label: { ar: "50 مل", en: "50 ml" }, price: 18000, salePrice: 15000, trackStock: true, stock: 3 },
    { id: "v2", label: { ar: "100 مل", en: "100 ml" }, price: 29000, salePrice: null, trackStock: false },
  ] });
  const products = new Map([[p.id, p]]);
  const area = { id: "r", name: { ar: "", en: "" }, fee: 2000, freeOver: 50000, active: true };

  it("uses catalogue prices, merges duplicate lines and adds delivery", () => {
    const r = priceCart([{ productId: "p", variantId: "v1", quantity: 1 }, { productId: "p", variantId: "v1", quantity: 1 }, { productId: "p", variantId: "v2", quantity: 1 }], products, area);
    expect(r.problems).toEqual([]);
    expect(r.lines.find((l) => l.variantId === "v1")).toMatchObject({ quantity: 2, unitPrice: 15000, listPrice: 18000, lineTotal: 30000 });
    expect(r).toMatchObject({ subtotal: 59000, deliveryFee: 0, total: 59000 });
  });
  it("reports stock and availability problems instead of pricing them", () => {
    const r = priceCart([{ productId: "p", variantId: "v1", quantity: 4 }, { productId: "zz", variantId: "v1", quantity: 1 }], products, area);
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual([
      { productId: "p", variantId: "v1", code: "insufficient_stock", available: 3 },
      { productId: "zz", variantId: "v1", code: "product_unavailable" },
    ]);
  });
});
