import { calculateTotals, checkQuantity, effectivePrice, MAX_LINES_PER_ORDER } from "./pricing";
import type { DeliveryArea, OrderLine, Product } from "./types";

export interface RequestedItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export type LineProblem =
  | { productId: string; variantId: string; code: "product_unavailable" }
  | { productId: string; variantId: string; code: "out_of_stock" }
  | { productId: string; variantId: string; code: "insufficient_stock"; available: number }
  | { productId: string; variantId: string; code: "invalid_quantity" };

export interface PricedCart {
  lines: OrderLine[];
  problems: LineProblem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  area: DeliveryArea | null;
}

/**
 * Prices a cart using ONLY server-side product data. Client-supplied prices
 * are never accepted; the client sends product/variant ids and quantities.
 * Duplicate lines for the same variant are merged.
 */
export function priceCart(items: RequestedItem[], products: Map<string, Product>, area: DeliveryArea | null): PricedCart {
  const merged = new Map<string, RequestedItem>();
  for (const it of items.slice(0, MAX_LINES_PER_ORDER)) {
    const k = `${it.productId}:${it.variantId}`;
    const prev = merged.get(k);
    merged.set(k, prev ? { ...prev, quantity: prev.quantity + it.quantity } : { ...it });
  }

  const lines: OrderLine[] = [];
  const problems: LineProblem[] = [];
  for (const it of merged.values()) {
    const p = products.get(it.productId);
    const v = p?.variants.find((x) => x.id === it.variantId);
    if (!p || !v || p.status !== "active" || !p.available) {
      problems.push({ productId: it.productId, variantId: it.variantId, code: "product_unavailable" });
      continue;
    }
    const check = checkQuantity(it.quantity, v);
    if (!check.ok) {
      if (check.reason === "insufficient_stock")
        problems.push({ productId: p.id, variantId: v.id, code: "insufficient_stock", available: check.available });
      else problems.push({ productId: p.id, variantId: v.id, code: check.reason });
      continue;
    }
    const unitPrice = effectivePrice(v);
    lines.push({
      productId: p.id,
      variantId: v.id,
      slug: p.slug,
      name: p.name,
      variantLabel: v.label,
      brand: p.brand,
      imageKey: p.images[0]?.key ?? null,
      unitPrice,
      listPrice: v.price,
      quantity: it.quantity,
      lineTotal: unitPrice * it.quantity,
      stockTracked: v.trackStock,
    });
  }
  const totals = calculateTotals(lines, area ? { fee: area.fee, freeOver: area.freeOver } : null);
  return { lines, problems, ...totals, area };
}
