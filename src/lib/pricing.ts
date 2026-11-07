import type { Agorot } from "./money";

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES_PER_ORDER = 25;

export interface PriceableVariant {
  price: Agorot;
  salePrice?: Agorot | null;
  trackStock: boolean;
  stock?: number | null;
}

/** A sale price only applies when it is positive and genuinely lower than the price. */
export function hasValidSale(v: Pick<PriceableVariant, "price" | "salePrice">): boolean {
  return typeof v.salePrice === "number" && v.salePrice > 0 && v.salePrice < v.price;
}

export function effectivePrice(v: Pick<PriceableVariant, "price" | "salePrice">): Agorot {
  return hasValidSale(v) ? v.salePrice! : v.price;
}

export function discountPercent(v: Pick<PriceableVariant, "price" | "salePrice">): number | null {
  if (!hasValidSale(v)) return null;
  return Math.round(((v.price - v.salePrice!) / v.price) * 100);
}

export type StockCheck =
  | { ok: true }
  | { ok: false; reason: "invalid_quantity" | "out_of_stock" | "insufficient_stock"; available: number };

export function checkQuantity(quantity: number, v: Pick<PriceableVariant, "trackStock" | "stock">): StockCheck {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
    return { ok: false, reason: "invalid_quantity", available: availableQuantity(v) };
  }
  if (!v.trackStock) return { ok: true };
  const stock = Math.max(0, v.stock ?? 0);
  if (stock === 0) return { ok: false, reason: "out_of_stock", available: 0 };
  if (quantity > stock) return { ok: false, reason: "insufficient_stock", available: stock };
  return { ok: true };
}

/** Maximum a customer may put in the cart for this variant. */
export function availableQuantity(v: Pick<PriceableVariant, "trackStock" | "stock">): number {
  if (!v.trackStock) return MAX_QTY_PER_LINE;
  return Math.max(0, Math.min(MAX_QTY_PER_LINE, v.stock ?? 0));
}

export interface DeliveryRule {
  fee: Agorot;
  /** Free delivery when the subtotal reaches this amount (optional). */
  freeOver?: Agorot | null;
}

export function deliveryFeeFor(subtotal: Agorot, rule: DeliveryRule | null): Agorot {
  if (!rule) return 0;
  if (rule.freeOver && rule.freeOver > 0 && subtotal >= rule.freeOver) return 0;
  return rule.fee;
}

export interface LineInput {
  unitPrice: Agorot;
  quantity: number;
}

export function calculateTotals(lines: LineInput[], rule: DeliveryRule | null) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const deliveryFee = lines.length === 0 ? 0 : deliveryFeeFor(subtotal, rule);
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}
