"use client";

import { useSyncExternalStore } from "react";

/**
 * The cart lives in localStorage and contains ONLY product ids, variant ids
 * and quantities — no prices, no personal data. Prices are always fetched
 * from (and recalculated by) the server.
 */
export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

const KEY = "basman_cart_v1";
const MAX_LINES = 25;
const MAX_QTY = 20;
const listeners = new Set<() => void>();
let snapshot: CartItem[] = [];
let loaded = false;

function isItem(x: unknown): x is CartItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.productId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.productId) &&
    typeof o.variantId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.variantId) &&
    Number.isInteger(o.quantity) && (o.quantity as number) >= 1 && (o.quantity as number) <= MAX_QTY
  );
}

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isItem).slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = read();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      snapshot = read();
      listeners.forEach((l) => l());
    }
  });
}

function write(items: CartItem[]) {
  snapshot = items.slice(0, MAX_LINES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked: cart still works for this page view */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  get(): CartItem[] {
    ensureLoaded();
    return snapshot;
  },
  add(productId: string, variantId: string, quantity: number, max = MAX_QTY) {
    ensureLoaded();
    const items = [...snapshot];
    const i = items.findIndex((x) => x.productId === productId && x.variantId === variantId);
    if (i >= 0) items[i] = { ...items[i]!, quantity: Math.min(items[i]!.quantity + quantity, max, MAX_QTY) };
    else items.push({ productId, variantId, quantity: Math.min(quantity, max, MAX_QTY) });
    write(items.filter((x) => x.quantity > 0));
  },
  setQuantity(productId: string, variantId: string, quantity: number) {
    ensureLoaded();
    write(
      snapshot
        .map((x) => (x.productId === productId && x.variantId === variantId ? { ...x, quantity: Math.min(quantity, MAX_QTY) } : x))
        .filter((x) => x.quantity > 0),
    );
  },
  remove(productId: string, variantId: string) {
    ensureLoaded();
    write(snapshot.filter((x) => !(x.productId === productId && x.variantId === variantId)));
  },
  replace(items: CartItem[]) {
    ensureLoaded();
    write(items.filter(isItem));
  },
  clear() {
    ensureLoaded();
    write([]);
  },
  subscribe(l: () => void) {
    ensureLoaded();
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

const EMPTY: CartItem[] = [];

export function useCart(): CartItem[] {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}

export function useCartCount(): number {
  return useCart().reduce((n, i) => n + i.quantity, 0);
}
