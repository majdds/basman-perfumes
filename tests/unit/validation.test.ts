import { describe, expect, it } from "vitest";
import { cartQuoteSchema, newPasswordSchema, placeOrderSchema, productInputSchema, settingsInputSchema } from "@/lib/validation";

const order = {
  customer: { name: "Test Customer", phone: "0599123456", areaId: "ramallah", address: "Al-Irsal Street, building 4", notes: null, email: null },
  items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
  locale: "ar",
};

describe("order validation", () => {
  it("accepts a valid order and trims fields", () => {
    const r = placeOrderSchema.safeParse({ ...order, customer: { ...order.customer, name: "  Test Customer  " } });
    expect(r.success).toBe(true);
    expect(r.success && r.data.customer.name).toBe("Test Customer");
  });
  it("rejects client-supplied prices and unknown fields (mass assignment)", () => {
    expect(placeOrderSchema.safeParse({ ...order, total: 1 }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, items: [{ ...order.items[0], price: 1 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, customer: { ...order.customer, status: "delivered" } }).success).toBe(false);
  });
  it("rejects invalid phone, empty cart, absurd quantities and long text", () => {
    expect(placeOrderSchema.safeParse({ ...order, customer: { ...order.customer, phone: "12345" } }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, items: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, items: [{ ...order.items[0], quantity: 999 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, customer: { ...order.customer, address: "x".repeat(301) } }).success).toBe(false);
  });
  it("rejects NoSQL-injection-shaped ids", () => {
    expect(placeOrderSchema.safeParse({ ...order, items: [{ productId: { $ne: null }, variantId: "v1", quantity: 1 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...order, items: [{ productId: "PRODUCT#x", variantId: "v1", quantity: 1 }] }).success).toBe(false);
    expect(cartQuoteSchema.safeParse({ items: [{ productId: "../../etc", variantId: "v", quantity: 1 }] }).success).toBe(false);
  });
  it("rejects a filled honeypot", () => {
    expect(placeOrderSchema.safeParse({ ...order, website: "http://spam" }).success).toBe(false);
  });
  it("strips control characters", () => {
    const r = placeOrderSchema.safeParse({ ...order, customer: { ...order.customer, name: "Ali\u0000\u0007 Test" } });
    expect(r.success && r.data.customer.name).toBe("Ali Test");
  });
});

describe("product validation", () => {
  const product = {
    name: { ar: "عطر", en: "Scent" }, slug: null, brand: "Brand", description: { ar: null, en: null }, categoryId: null, gender: null,
    fragranceFamily: { ar: null, en: null }, images: [], featured: false, available: true,
    variants: [{ label: { ar: null, en: null }, price: 10000, salePrice: null, trackStock: true, stock: 3 }],
  };
  it("accepts a minimal product", () => expect(productInputSchema.safeParse(product).success).toBe(true));
  it("requires sale price < price", () => {
    const r = productInputSchema.safeParse({ ...product, variants: [{ ...product.variants[0], salePrice: 10000 }] });
    expect(r.success).toBe(false);
  });
  it("only accepts server-generated image keys", () => {
    expect(productInputSchema.safeParse({ ...product, images: [{ key: "../../secret", width: 1, height: 1 }] }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, images: [{ key: "products/3f2c0e9a-1111-4222-8333-944455556666", width: 800, height: 1000 }] }).success).toBe(true);
  });
  it("forbids system fields like isDemo/version/status", () => {
    expect(productInputSchema.safeParse({ ...product, isDemo: true }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, status: "active" }).success).toBe(false);
  });
});

describe("settings validation", () => {
  it("requires https links", () => {
    const base = {
      phone: "0569398080", whatsapp: "0569398080", addressText: { ar: "رام الله", en: "Ramallah" }, mapsUrl: null, hours: { ar: null, en: null },
      instagramUrl: "https://instagram.com/x", facebookUrl: "https://facebook.com/x",
      deliveryAreas: [{ name: { ar: "رام الله", en: "Ramallah" }, fee: 2000, freeOver: null, active: true }],
      lowStockThreshold: 3, retentionDays: 730, orderingEnabled: true, heroImageKey: null, announcement: { ar: null, en: null },
    };
    expect(settingsInputSchema.safeParse(base).success).toBe(true);
    expect(settingsInputSchema.safeParse({ ...base, mapsUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ ...base, instagramUrl: "http://insecure" }).success).toBe(false);
  });
});

describe("password policy", () => {
  it.each(["short", "aaaaaaaaaaaaaaaa", "123456789012", "Password1234", "basman123456"])("rejects %s", (p) => {
    expect(newPasswordSchema.safeParse(p).success).toBe(false);
  });
  it("accepts long passphrases", () => expect(newPasswordSchema.safeParse("ورد وعود 2026 رام الله").success).toBe(true));
});
