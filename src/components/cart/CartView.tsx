"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cart, useCart } from "./cart-store";
import { useQuote } from "./useQuote";
import { QuantityStepper } from "../ui/QuantityStepper";
import { EmptyState } from "../ui/EmptyState";
import { IconAlert, IconBag, IconCash, IconTrash } from "../ui/icons";
import { ProductImage } from "../store/ProductImage";
import { formatPrice } from "@/lib/money";
import { getDictionary, pick } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function CartView({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const items = useCart();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { quote, error, adjusted, retry } = useQuote(items, null);

  if (!hydrated || (items.length > 0 && !quote && !error)) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true" aria-label={dict.common.loading}>
        <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="skeleton h-32" />)}</div>
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={<IconBag size={30} />} title={dict.cart.empty} text={dict.cart.emptyText} action={<Link href={`/${locale}/shop`} className="btn btn-primary">{dict.cart.browse}</Link>} />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="alert alert-error" role="alert">
        <IconAlert className="shrink-0" />
        <div>
          <p>{error === "network" ? dict.errors.network : error === "rateLimited" ? dict.errors.rateLimited : dict.errors.generic}</p>
          <button className="btn btn-sm btn-secondary mt-3" onClick={retry}>{dict.common.retry}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
      <section aria-label={dict.cart.title}>
        {adjusted ? <p className="alert alert-warning mb-5" role="status"><IconAlert size={20} className="shrink-0" /> {dict.cart.adjusted}</p> : null}
        <ul className="divide-y divide-sand border-y border-sand">
          {quote!.lines.map((l) => {
            const name = pick(l.name, locale);
            const variant = pick(l.variantLabel, locale);
            return (
              <li key={`${l.productId}:${l.variantId}`} className="flex gap-4 py-5 sm:gap-6" data-testid="cart-line">
                <Link href={`/${locale}/products/${encodeURIComponent(l.slug)}`} className="w-24 shrink-0 overflow-hidden rounded-[var(--radius-md)] sm:w-28">
                  <ProductImage image={l.imageKey ? { key: l.imageKey, width: 400, height: 500 } : undefined} alt={name} sizes="112px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{l.brand}</p>
                      <Link href={`/${locale}/products/${encodeURIComponent(l.slug)}`} className="mt-0.5 block font-semibold text-charcoal hover:text-burgundy">{name}</Link>
                      {variant ? <p className="text-sm text-muted">{variant}</p> : null}
                    </div>
                    <p className="ltr-nums shrink-0 font-semibold" data-testid="line-total">{formatPrice(l.lineTotal, locale)}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <QuantityStepper
                      size="sm"
                      value={l.quantity}
                      max={Math.max(l.maxQty, 1)}
                      onChange={(n) => cart.setQuantity(l.productId, l.variantId, n)}
                      labels={{ decrease: dict.product.decrease, increase: dict.product.increase, quantity: dict.product.quantity }}
                    />
                    <span className="text-sm text-muted">
                      <span className="ltr-nums">{formatPrice(l.unitPrice, locale)}</span> {dict.cart.each}
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => cart.remove(l.productId, l.variantId)} aria-label={dict.cart.removeItem(name)}>
                      <IconTrash size={18} /> <span className="hidden sm:inline">{dict.cart.remove}</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href={`/${locale}/shop`} className="mt-6 inline-block link-underline">{dict.cart.continueShopping}</Link>
      </section>

      <aside className="h-fit rounded-[var(--radius-lg)] border border-sand bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+24px)]">
        <dl className="space-y-3">
          <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="ltr-nums font-semibold" data-testid="subtotal">{formatPrice(quote!.subtotal, locale)}</dd></div>
          <div className="flex justify-between text-muted"><dt>{dict.cart.delivery}</dt><dd className="text-sm">{dict.cart.deliveryAtCheckout}</dd></div>
          <div className="flex justify-between border-t border-sand pt-3 text-lg"><dt className="font-semibold">{dict.cart.estimatedTotal}</dt><dd className="ltr-nums font-bold">{formatPrice(quote!.subtotal, locale)}</dd></div>
        </dl>
        <Link href={`/${locale}/checkout`} className="btn btn-primary btn-lg btn-block mt-6" data-testid="go-checkout">{dict.cart.checkout}</Link>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted"><IconCash size={20} className="shrink-0 text-gold" /> {dict.common.codShort}</p>
      </aside>
    </div>
  );
}
