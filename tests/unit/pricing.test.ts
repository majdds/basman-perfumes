import { describe, expect, it } from "vitest";
import {
  availableQuantity, calculateTotals, checkQuantity, deliveryFeeFor, discountPercent, effectivePrice, hasValidSale, MAX_QTY_PER_LINE,
} from "@/lib/pricing";

describe("discounts", () => {
  it("applies a sale price only when it is positive and lower", () => {
    expect(effectivePrice({ price: 10000, salePrice: 8000 })).toBe(8000);
    expect(effectivePrice({ price: 10000, salePrice: 10000 })).toBe(10000);
    expect(effectivePrice({ price: 10000, salePrice: 12000 })).toBe(10000);
    expect(effectivePrice({ price: 10000, salePrice: 0 })).toBe(10000);
    expect(effectivePrice({ price: 10000, salePrice: null })).toBe(10000);
    expect(hasValidSale({ price: 10000, salePrice: -5 })).toBe(false);
  });
  it("computes the discount percentage honestly", () => {
    expect(discountPercent({ price: 32000, salePrice: 27000 })).toBe(16);
    expect(discountPercent({ price: 32000, salePrice: null })).toBeNull();
  });
});

describe("delivery fees", () => {
  it("charges the area fee", () => expect(deliveryFeeFor(5000, { fee: 2000 })).toBe(2000));
  it("is free above the threshold (inclusive)", () => {
    expect(deliveryFeeFor(30000, { fee: 2000, freeOver: 30000 })).toBe(0);
    expect(deliveryFeeFor(29999, { fee: 2000, freeOver: 30000 })).toBe(2000);
  });
  it("is zero when no area is chosen yet", () => expect(deliveryFeeFor(5000, null)).toBe(0));
});

describe("totals", () => {
  it("adds subtotal and delivery", () => {
    expect(calculateTotals([{ unitPrice: 18000, quantity: 2 }, { unitPrice: 6000, quantity: 1 }], { fee: 2000 })).toEqual({ subtotal: 42000, deliveryFee: 2000, total: 44000 });
  });
  it("charges no delivery for an empty cart", () => {
    expect(calculateTotals([], { fee: 2000 })).toEqual({ subtotal: 0, deliveryFee: 0, total: 0 });
  });
});

describe("quantity and stock validation", () => {
  const tracked = (stock: number) => ({ trackStock: true, stock });
  it("rejects invalid quantities", () => {
    for (const q of [0, -1, 1.5, Number.NaN, MAX_QTY_PER_LINE + 1]) expect(checkQuantity(q, { trackStock: false }).ok).toBe(false);
  });
  it("accepts any valid quantity when stock is not tracked", () => expect(checkQuantity(MAX_QTY_PER_LINE, { trackStock: false }).ok).toBe(true));
  it("blocks out-of-stock and over-stock", () => {
    expect(checkQuantity(1, tracked(0))).toEqual({ ok: false, reason: "out_of_stock", available: 0 });
    expect(checkQuantity(3, tracked(2))).toEqual({ ok: false, reason: "insufficient_stock", available: 2 });
    expect(checkQuantity(2, tracked(2))).toEqual({ ok: true });
  });
  it("caps the orderable quantity", () => {
    expect(availableQuantity(tracked(3))).toBe(3);
    expect(availableQuantity(tracked(500))).toBe(MAX_QTY_PER_LINE);
    expect(availableQuantity({ trackStock: false })).toBe(MAX_QTY_PER_LINE);
    expect(availableQuantity(tracked(-4))).toBe(0);
  });
});
