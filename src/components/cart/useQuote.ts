"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { LineProblem } from "@/lib/order-pricing";
import type { OrderLine } from "@/lib/types";
import { cart, type CartItem } from "./cart-store";

export interface QuoteLine extends OrderLine {
  maxQty: number;
}
export interface Quote {
  lines: QuoteLine[];
  problems: LineProblem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  areaId: string | null;
}

/**
 * Fetches authoritative prices/stock from the server for the current cart.
 * If the server reports problems (product gone, not enough stock) the local
 * cart is corrected automatically and `adjusted` is set so the UI can say so.
 */
export function useQuote(items: CartItem[], areaId: string | null) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adjusted, setAdjusted] = useState(false);
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(items) + "|" + (areaId ?? "");
  const last = useRef<string>("");

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const q = await api<Quote>("/api/cart/quote", { body: { items, areaId }, signal: ctrl.signal });
        if (q.problems.length) {
          const fixed: CartItem[] = [];
          for (const it of items) {
            const p = q.problems.find((x) => x.productId === it.productId && x.variantId === it.variantId);
            if (!p) fixed.push(it);
            else if (p.code === "insufficient_stock" && p.available > 0) fixed.push({ ...it, quantity: p.available });
          }
          setAdjusted(true);
          cart.replace(fixed);
          return; // the cart change triggers a fresh quote
        }
        last.current = key;
        setQuote(q);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof ApiError ? e.code : "generic");
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  return { quote, error, loading, adjusted, retry: () => setNonce((n) => n + 1) };
}
