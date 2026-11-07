import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "../http";
import {
  ConflictError,
  createProduct,
  deleteCategory as repoDeleteCategory,
  deleteProduct as repoDeleteProduct,
  getProduct,
  listAllProducts,
  listCategories,
  putCategory,
  updateProduct,
} from "../repos/products";
import { deleteImages } from "./images";
import { invalidateCatalog } from "./catalog";
import { slugify } from "@/lib/slug";
import type { Category, Product, ProductVariant } from "@/lib/types";
import type { ProductInput } from "@/lib/validation";

function toVariants(input: ProductInput["variants"], previous: ProductVariant[] = []): ProductVariant[] {
  return input.map((v) => {
    const keepId = v.id && previous.some((p) => p.id === v.id) ? v.id : undefined;
    return {
      id: keepId ?? randomUUID().slice(0, 8),
      label: { ar: v.label.ar ?? "", en: v.label.en ?? "" },
      sizeMl: v.sizeMl ?? null,
      sku: v.sku ?? null,
      price: v.price,
      salePrice: v.salePrice && v.salePrice > 0 ? v.salePrice : null,
      trackStock: v.trackStock,
      stock: v.trackStock ? (v.stock ?? 0) : null,
    };
  });
}

function fromInput(input: ProductInput) {
  return {
    name: { ar: input.name.ar, en: input.name.en ?? "" },
    brand: input.brand,
    description: { ar: input.description.ar ?? "", en: input.description.en ?? "" },
    categoryId: input.categoryId,
    gender: input.gender,
    fragranceFamily: input.fragranceFamily.ar || input.fragranceFamily.en ? { ar: input.fragranceFamily.ar ?? "", en: input.fragranceFamily.en ?? "" } : null,
    images: input.images,
    featured: input.featured,
    available: input.available,
  };
}

async function uniqueSlug(base: string, ownId?: string): Promise<string> {
  const all = await listAllProducts();
  const taken = new Set(all.filter((p) => p.id !== ownId).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${randomUUID().slice(0, 6)}`;
}

export async function adminCreateProduct(input: ProductInput, opts: { isDemo?: boolean; createdAt?: string } = {}): Promise<Product> {
  const now = opts.createdAt ?? new Date().toISOString();
  const slug = input.slug ? input.slug : await uniqueSlug(slugify(input.name.en ?? undefined, input.name.ar));
  const product: Product = {
    id: randomUUID(),
    slug,
    ...fromInput(input),
    variants: toVariants(input.variants),
    status: "active",
    isDemo: opts.isDemo ?? false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  try {
    await createProduct(product);
  } catch (e) {
    if (e instanceof ConflictError && e.code === "slug") throw new HttpError(409, "slugTaken");
    throw e;
  }
  invalidateCatalog();
  return product;
}

export async function adminUpdateProduct(id: string, input: ProductInput, expectedVersion: number): Promise<Product> {
  const current = await getProduct(id);
  if (!current) throw new HttpError(404, "not_found");
  if (current.version !== expectedVersion) throw new HttpError(409, "conflict");
  const slug = input.slug && input.slug !== current.slug ? input.slug : current.slug;
  const next: Product = {
    ...current,
    ...fromInput(input),
    slug,
    variants: toVariants(input.variants, current.variants),
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  };
  try {
    await updateProduct(next, expectedVersion, current.slug);
  } catch (e) {
    if (e instanceof ConflictError) throw new HttpError(409, e.code === "slug" ? "slugTaken" : "conflict");
    throw e;
  }
  const removed = current.images.map((i) => i.key).filter((k) => !next.images.some((i) => i.key === k));
  if (removed.length) await deleteImages(removed).catch(() => undefined);
  invalidateCatalog();
  return next;
}

export async function adminSetProductStatus(id: string, status: Product["status"]): Promise<Product> {
  const current = await getProduct(id);
  if (!current) throw new HttpError(404, "not_found");
  const next = { ...current, status, updatedAt: new Date().toISOString(), version: current.version + 1 };
  try {
    await updateProduct(next, current.version, current.slug);
  } catch (e) {
    if (e instanceof ConflictError) throw new HttpError(409, "conflict");
    throw e;
  }
  invalidateCatalog();
  return next;
}

/** Permanent deletion. Past orders keep their own snapshot of name/price. */
export async function adminDeleteProduct(id: string): Promise<void> {
  const current = await getProduct(id);
  if (!current) throw new HttpError(404, "not_found");
  await repoDeleteProduct(current);
  await deleteImages(current.images.map((i) => i.key)).catch(() => undefined);
  invalidateCatalog();
}

export async function adminRemoveDemoContent(): Promise<number> {
  const [products, categories] = await Promise.all([listAllProducts(), listCategories()]);
  const demo = products.filter((p) => p.isDemo);
  for (const p of demo) {
    await repoDeleteProduct(p);
    await deleteImages(p.images.map((i) => i.key)).catch(() => undefined);
  }
  const realCategoryIds = new Set(products.filter((p) => !p.isDemo).map((p) => p.categoryId));
  for (const c of categories.filter((c) => c.isDemo && !realCategoryIds.has(c.id))) await repoDeleteCategory(c.id);
  invalidateCatalog();
  return demo.length;
}

// ─── Categories ──────────────────────────────────────────────────────────
export async function adminSaveCategory(
  input: { name: { ar: string; en: string }; sortOrder: number },
  id?: string,
  isDemo = false,
): Promise<Category> {
  const categories = await listCategories();
  const existing = id ? categories.find((c) => c.id === id) : undefined;
  if (id && !existing) throw new HttpError(404, "not_found");
  const base = slugify(input.name.en, input.name.ar);
  const taken = new Set(categories.filter((c) => c.id !== id).map((c) => c.slug));
  let slug = existing?.slug && slugify(input.name.en, input.name.ar) === existing.slug ? existing.slug : base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const category: Category = { id: existing?.id ?? randomUUID(), slug, name: input.name, sortOrder: input.sortOrder, isDemo: existing?.isDemo ?? isDemo };
  await putCategory(category);
  invalidateCatalog();
  return category;
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const products = await listAllProducts();
  // Detach products from the category first so none point at a missing category.
  for (const p of products.filter((p) => p.categoryId === id)) {
    await updateProduct({ ...p, categoryId: null, updatedAt: new Date().toISOString(), version: p.version + 1 }, p.version, p.slug);
  }
  await repoDeleteCategory(id);
  invalidateCatalog();
}
