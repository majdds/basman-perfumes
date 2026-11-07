"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cart, useCart } from "../cart/cart-store";
import { QuantityStepper } from "../ui/QuantityStepper";
import { Price } from "../ui/Price";
import { IconBag, IconCheck } from "../ui/icons";
import type { Locale } from "@/lib/types";

export interface VariantView {
  id: string;
  label: string;
  price: number;
  salePrice: number | null;
  maxQty: number; // 0 = cannot be ordered
  availability: "in_stock" | "low_stock" | "out_of_stock" | "unavailable";
  stockLeft: number | null; // only shown when low
}

interface Labels {
  size: string;
  quantity: string;
  increase: string;
  decrease: string;
  addToCart: string;
  added: string;
  viewCart: string;
  inStock: string;
  lowStock: string; // contains {n}
  outOfStock: string;
  unavailable: string;
  maxReached: string;
  priceWas: string;
}

export function AddToCart({ productId, variants, locale, labels }: { productId: string; variants: VariantView[]; locale: Locale; labels: Labels }) {
  const firstAvailable = variants.findIndex((v) => v.maxQty > 0);
  const [vi, setVi] = useState(firstAvailable >= 0 ? firstAvailable : 0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const items = useCart();
  const v = variants[vi]!;
  const inCart = useMemo(() => items.find((i) => i.productId === productId && i.variantId === v.id)?.quantity ?? 0, [items, productId, v.id]);
  const remaining = Math.max(0, v.maxQty - inCart);
  const canAdd = remaining > 0;

  const status =
    v.availability === "out_of_stock"
      ? { text: labels.outOfStock, cls: "text-danger" }
      : v.availability === "unavailable"
        ? { text: labels.unavailable, cls: "text-muted" }
        : v.availability === "low_stock" && v.stockLeft
          ? { text: labels.lowStock.replace("{n}", String(v.stockLeft)), cls: "text-warning" }
          : { text: labels.inStock, cls: "text-success" };

  return (
    <div className="space-y-7">
      <div>
        <Price price={v.price} salePrice={v.salePrice} locale={locale} size="lg" wasLabel={labels.priceWas} />
        <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${status.cls}`} data-testid="availability">
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" /> {status.text}
        </p>
      </div>

      {variants.length > 1 ? (
        <fieldset>
          <legend className="field-label">{labels.size}</legend>
          <div className="flex flex-wrap gap-2.5">
            {variants.map((x, i) => (
              <label
                key={x.id}
                className={`relative cursor-pointer rounded-[var(--radius-md)] border px-5 py-3 text-center transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-champagne ${
                  i === vi ? "border-charcoal bg-charcoal text-ivory" : "border-line bg-white hover:border-charcoal"
                } ${x.maxQty === 0 ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={x.id}
                  checked={i === vi}
                  onChange={() => {
                    setVi(i);
                    setQty(1);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                <span className="block font-semibold">{x.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {canAdd ? (
          <div>
            <span className="field-label" id="qty-label">{labels.quantity}</span>
            <QuantityStepper value={Math.min(qty, remaining)} max={remaining} onChange={setQty} labels={labels} />
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-lg min-w-56 flex-1"
          disabled={!canAdd}
          data-testid="add-to-cart"
          onClick={() => {
            cart.add(productId, v.id, Math.min(qty, remaining), v.maxQty);
            setAdded(true);
            setQty(1);
          }}
        >
          <IconBag /> {labels.addToCart}
        </button>
      </div>
      {!canAdd && v.maxQty > 0 ? <p className="text-sm text-muted">{labels.maxReached}</p> : null}

      <div aria-live="polite">
        {added ? (
          <div className="alert alert-success items-center justify-between" data-testid="added-alert">
            <span className="flex items-center gap-2 font-semibold"><IconCheck /> {labels.added}</span>
            <Link href={`/${locale}/cart`} className="btn btn-sm btn-dark">{labels.viewCart}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
