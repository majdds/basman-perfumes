import { adminCreateProduct } from "@/server/services/admin-catalog";
import { putSettings, defaultSettings } from "@/server/repos/settings";
import type { ProductInput, PlaceOrderInput } from "@/lib/validation";

export async function seedSettings(overrides: Partial<ReturnType<typeof defaultSettings>> = {}) {
  await putSettings({
    ...defaultSettings(),
    deliveryAreas: [
      { id: "ramallah", name: { ar: "رام الله", en: "Ramallah" }, fee: 2000, freeOver: 50000, active: true },
      { id: "closed", name: { ar: "مغلقة", en: "Closed" }, fee: 1000, freeOver: null, active: false },
    ],
    ...overrides,
  });
}

export function productInput(over: Partial<ProductInput> = {}): ProductInput {
  return {
    name: { ar: "عطر اختبار", en: `Test Scent ${Math.random().toString(36).slice(2, 7)}` },
    slug: null,
    brand: "TEST",
    description: { ar: "وصف", en: "Description" },
    categoryId: null,
    gender: "unisex",
    fragranceFamily: { ar: null, en: null },
    images: [],
    variants: [{ label: { ar: "50 مل", en: "50 ml" }, sizeMl: 50, sku: null, price: 18000, salePrice: 15000, trackStock: true, stock: 5 }],
    featured: false,
    available: true,
    ...over,
  };
}

export const createProduct = (over: Partial<ProductInput> = {}) => adminCreateProduct(productInput(over));

export function orderInput(productId: string, variantId: string, quantity = 1, over: Partial<PlaceOrderInput["customer"]> = {}): PlaceOrderInput {
  return {
    customer: { name: "Test Customer", phone: "0599000111", areaId: "ramallah", address: "Test street 1, Ramallah", notes: null, email: null, ...over },
    items: [{ productId, variantId, quantity }],
    locale: "ar",
  };
}

export const key = () => crypto.randomUUID();
