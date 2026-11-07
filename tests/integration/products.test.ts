import { beforeAll, describe, expect, it } from "vitest";
import { adminDeleteProduct, adminRemoveDemoContent, adminSaveCategory, adminSetProductStatus, adminUpdateProduct, adminDeleteCategory } from "@/server/services/admin-catalog";
import { getCatalog, getProductBySlug, invalidateCatalog } from "@/server/services/catalog";
import { getProduct, listAllProducts } from "@/server/repos/products";
import { HttpError } from "@/server/http";
import { createProduct, productInput, seedSettings } from "../helpers/fixtures";

beforeAll(() => seedSettings());

describe("product management", () => {
  it("creates a product with a unique slug and retrieves it", async () => {
    const p = await createProduct({ name: { ar: "ورد", en: "Rose Garden" } });
    expect(p.slug).toBe("rose-garden");
    expect(p.version).toBe(1);
    expect(await getProduct(p.id)).toMatchObject({ id: p.id, brand: "TEST", status: "active" });
    const twin = await createProduct({ name: { ar: "ورد", en: "Rose Garden" } });
    expect(twin.slug).toBe("rose-garden-2");
    invalidateCatalog();
    expect((await getProductBySlug("rose-garden"))?.id).toBe(p.id);
  });

  it("creates Arabic-only slugs when no English name is given", async () => {
    const p = await createProduct({ name: { ar: "عود ملكي", en: null } });
    expect(p.slug).toBe("عود-ملكي");
  });

  it("updates with optimistic concurrency", async () => {
    const p = await createProduct();
    const updated = await adminUpdateProduct(p.id, productInput({ brand: "NEW", name: p.name as never }), 1);
    expect(updated.version).toBe(2);
    expect(updated.brand).toBe("NEW");
    // keeps variant ids stable when the client sends them back
    expect(updated.variants[0]!.id).not.toBe(p.variants[0]!.id); // no id sent → new variant
    await expect(adminUpdateProduct(p.id, productInput(), 1)).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("keeps variant ids when provided and changes slug atomically", async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    const next = await adminUpdateProduct(p.id, productInput({ slug: "renamed-scent", variants: [{ id: v.id, label: { ar: "75 مل", en: "75 ml" }, sizeMl: 75, sku: null, price: 20000, salePrice: null, trackStock: true, stock: 9 }] }), p.version);
    expect(next.variants[0]!.id).toBe(v.id);
    expect(next.slug).toBe("renamed-scent");
    const other = await createProduct();
    await expect(adminUpdateProduct(other.id, productInput({ slug: "renamed-scent" }), other.version)).rejects.toMatchObject({ code: "slugTaken" });
  });

  it("archives (hidden from storefront) and restores", async () => {
    const p = await createProduct();
    await adminSetProductStatus(p.id, "archived");
    invalidateCatalog();
    expect((await getCatalog()).products.some((x) => x.id === p.id)).toBe(false);
    await adminSetProductStatus(p.id, "active");
    invalidateCatalog();
    expect((await getCatalog()).products.some((x) => x.id === p.id)).toBe(true);
  });

  it("deletes permanently", async () => {
    const p = await createProduct();
    await adminDeleteProduct(p.id);
    expect(await getProduct(p.id)).toBeNull();
    await expect(adminDeleteProduct(p.id)).rejects.toBeInstanceOf(HttpError);
  });

  it("detaches products when their category is deleted", async () => {
    const c = await adminSaveCategory({ name: { ar: "فئة", en: "Category X" }, sortOrder: 5 });
    const p = await createProduct({ categoryId: c.id });
    await adminDeleteCategory(c.id);
    expect((await getProduct(p.id))!.categoryId).toBeNull();
  });

  it("removes only demo content", async () => {
    const { adminCreateProduct } = await import("@/server/services/admin-catalog");
    const demo = await adminCreateProduct(productInput(), { isDemo: true });
    const real = await createProduct();
    const removed = await adminRemoveDemoContent();
    expect(removed).toBeGreaterThanOrEqual(1);
    const all = await listAllProducts();
    expect(all.some((p) => p.id === demo.id)).toBe(false);
    expect(all.some((p) => p.id === real.id)).toBe(true);
  });
});
