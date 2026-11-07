"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, useCart } from "./cart-store";
import { useQuote } from "./useQuote";
import { Field, describedBy } from "../ui/Field";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { IconAlert, IconBag, IconCash, IconCheck } from "../ui/icons";
import { api, ApiError } from "@/lib/api-client";
import { errorMessage, getDictionary, pick } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import { formatPhoneForDisplay, parsePalestinianPhone } from "@/lib/phone";
import { checkoutCustomerSchema } from "@/lib/validation";
import type { Locale } from "@/lib/types";

export interface AreaOption {
  id: string;
  name: { ar: string; en: string };
  fee: number;
  freeOver: number | null;
  active: boolean;
}

type Form = { name: string; phone: string; areaId: string; address: string; notes: string; email: string };
const EMPTY: Form = { name: "", phone: "", areaId: "", address: "", notes: "", email: "" };
const KEY_STORAGE = "basman_checkout_key";

function newKey() {
  return crypto.randomUUID();
}

export function CheckoutFlow({ locale, areas, orderingEnabled }: { locale: Locale; areas: AreaOption[]; orderingEnabled: boolean }) {
  const dict = getDictionary(locale);
  const router = useRouter();
  const items = useCart();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<"details" | "review">("details");
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedArea = areas.find((a) => a.id === form.areaId);
  const areaClosed = selectedArea ? !selectedArea.active : false;
  const area = areaClosed ? undefined : selectedArea;
  const { quote, error: quoteError, adjusted, retry } = useQuote(items, area?.id ?? null);

  useEffect(() => setHydrated(true), []);
  useEffect(() => headingRef.current?.focus(), [step]);

  if (!hydrated) return <div className="skeleton h-96" aria-busy="true" />;

  if (!orderingEnabled) {
    return <p className="alert alert-warning"><IconAlert className="shrink-0" /> {dict.checkout.orderingDisabled}</p>;
  }
  if (items.length === 0 && !submitting) {
    return (
      <div className="card">
        <EmptyState icon={<IconBag size={30} />} title={dict.cart.empty} text={dict.checkout.emptyCart} action={<Link href={`/${locale}/shop`} className="btn btn-primary">{dict.cart.browse}</Link>} />
      </div>
    );
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };

  const validate = () => {
    const r = checkoutCustomerSchema.safeParse(form);
    if (r.success && !areaClosed) return r.data;
    const out: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) out[String(i.path[0])] ??= errorMessage(dict, i.message);
    if (!form.areaId) out.areaId = dict.errors.invalid_area;
    if (areaClosed) out.areaId = dict.checkout.areaUnavailable;
    setErrors(out);
    const first = Object.keys(out)[0];
    if (first) document.getElementById(`co-${first}`)?.focus();
    return null;
  };

  const toReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // A new idempotency key per checkout attempt; reused if the same order is retried.
    if (!sessionStorage.getItem(KEY_STORAGE)) sessionStorage.setItem(KEY_STORAGE, newKey());
    setSubmitError(null);
    setStep("review");
    window.scrollTo({ top: 0 });
  };

  const placeOrder = async () => {
    const customer = validate();
    if (!customer || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const key = sessionStorage.getItem(KEY_STORAGE) ?? newKey();
    sessionStorage.setItem(KEY_STORAGE, key);
    try {
      const res = await api<{ orderNumber: string }>("/api/orders", {
        body: { customer, items, locale, website: honeypot || undefined },
        headers: { "Idempotency-Key": key },
      });
      sessionStorage.removeItem(KEY_STORAGE);
      cart.clear();
      router.replace(`/${locale}/order/${res.orderNumber}`);
    } catch (e) {
      setSubmitting(false);
      const err = e instanceof ApiError ? e : new ApiError(0, "generic", null);
      if (err.code === "validation" || err.code === "invalid_area") {
        const fields = ((err.details as { fields?: Record<string, string> } | null)?.fields ?? {}) as Record<string, string>;
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(fields)) mapped[k.replace(/^customer\./, "")] = errorMessage(dict, v);
        setErrors(mapped);
        setStep("details");
        return;
      }
      if (err.code === "cart_problems" || err.code === "stock_changed") {
        sessionStorage.removeItem(KEY_STORAGE);
        retry();
        setSubmitError(dict.errors.stock_changed);
        return;
      }
      if (err.code === "idempotency_mismatch") sessionStorage.setItem(KEY_STORAGE, newKey());
      setSubmitError(
        err.code === "network" ? dict.errors.network
          : err.code === "rateLimited" ? dict.errors.rateLimited
          : err.code === "ordering_disabled" ? dict.errors.ordering_disabled
          : dict.errors.generic,
      );
    }
  };

  const summary = (
    <aside className="h-fit rounded-[var(--radius-lg)] border border-sand bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+24px)]" aria-label={dict.checkout.items}>
      <h2 className="text-xl">{dict.checkout.items}</h2>
      {adjusted ? <p className="alert alert-warning mt-4 text-sm">{dict.cart.adjusted}</p> : null}
      {quoteError ? (
        <p className="alert alert-error mt-4 text-sm">{dict.errors.network} <button className="link-underline" onClick={retry}>{dict.common.retry}</button></p>
      ) : null}
      {!quote ? (
        <div className="mt-4 space-y-3"><div className="skeleton h-12" /><div className="skeleton h-12" /></div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-sand">
            {quote.lines.map((l) => (
              <li key={`${l.productId}:${l.variantId}`} className="flex justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-semibold text-charcoal">{pick(l.name, locale)}</span>
                  {pick(l.variantLabel, locale) ? <span className="text-muted"> · {pick(l.variantLabel, locale)}</span> : null}
                  <span className="ltr-nums block text-muted">× {l.quantity}</span>
                </span>
                <span className="ltr-nums shrink-0 font-semibold">{formatPrice(l.lineTotal, locale)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-sand pt-4">
            <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="ltr-nums">{formatPrice(quote.subtotal, locale)}</dd></div>
            <div className="flex justify-between">
              <dt>{dict.cart.delivery}</dt>
              <dd className="ltr-nums" data-testid="delivery-fee">{!area ? <span className="text-sm text-muted">{dict.cart.deliveryAtCheckout}</span> : quote.deliveryFee === 0 ? dict.cart.free : formatPrice(quote.deliveryFee, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-sand pt-3 text-lg font-bold"><dt>{dict.cart.total}</dt><dd className="ltr-nums" data-testid="total">{formatPrice(quote.total, locale)}</dd></div>
          </dl>
        </>
      )}
      <div className="mt-5 flex items-start gap-2 rounded-[var(--radius-md)] bg-cream p-3 text-sm">
        <IconCash size={20} className="shrink-0 text-gold" />
        <span><strong>{dict.checkout.paymentMethod}: {dict.common.cod}</strong><br />{dict.checkout.codExplain}</span>
      </div>
    </aside>
  );

  return (
    <div>
      <ol className="mb-8 flex items-center gap-3 text-sm" aria-label={dict.checkout.title}>
        <StepPill n={1} label={dict.checkout.stepDetails} active={step === "details"} done={step === "review"} />
        <span className="h-px w-10 bg-line" aria-hidden="true" />
        <StepPill n={2} label={dict.checkout.stepReview} active={step === "review"} done={false} />
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
        {step === "details" ? (
          <form onSubmit={toReview} noValidate className="space-y-6" aria-labelledby="co-h">
            <h2 id="co-h" ref={headingRef} tabIndex={-1} className="text-2xl outline-none">{dict.checkout.stepDetails}</h2>
            {Object.values(errors).some(Boolean) ? <p className="alert alert-error" role="alert"><IconAlert className="shrink-0" /> {dict.errors.fixErrors}</p> : null}
            <Field id="co-name" label={dict.checkout.name} error={errors.name}>
              <input id="co-name" className="input" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} aria-describedby={describedBy("co-name", undefined, errors.name)} maxLength={80} required />
            </Field>
            <Field id="co-phone" label={dict.checkout.phone} hint={dict.checkout.phoneHint} error={errors.phone}>
              <input id="co-phone" className="input ltr-nums text-start" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} aria-describedby={describedBy("co-phone", dict.checkout.phoneHint, errors.phone)} maxLength={20} placeholder="0599 123 456" required />
            </Field>
            <Field id="co-areaId" label={dict.checkout.area} error={areaClosed ? null : errors.areaId}>
              <select id="co-areaId" className="input" value={form.areaId} onChange={set("areaId")} aria-invalid={areaClosed || !!errors.areaId} aria-describedby={areaClosed ? "co-area-closed" : describedBy("co-areaId", undefined, errors.areaId)} required>
                <option value="">{dict.checkout.chooseArea}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {pick(a.name, locale)} — {!a.active ? dict.checkout.areaUnavailableShort : a.fee === 0 ? dict.cart.free : formatPrice(a.fee, locale)}
                  </option>
                ))}
              </select>
              {areaClosed ? (
                <p id="co-area-closed" className="alert alert-warning mt-3" role="status" data-testid="area-closed-note">
                  <IconAlert className="shrink-0" /> {dict.checkout.areaUnavailable}
                </p>
              ) : null}
            </Field>
            <Field id="co-address" label={dict.checkout.address} hint={dict.checkout.addressHint} error={errors.address}>
              <textarea id="co-address" className="input" autoComplete="street-address" rows={3} value={form.address} onChange={set("address")} aria-invalid={!!errors.address} aria-describedby={describedBy("co-address", dict.checkout.addressHint, errors.address)} maxLength={300} required />
            </Field>
            <Field id="co-notes" label={dict.checkout.notes} hint={dict.checkout.notesHint} optionalLabel={dict.common.optional} error={errors.notes}>
              <textarea id="co-notes" className="input" rows={2} value={form.notes} onChange={set("notes")} maxLength={500} aria-describedby={describedBy("co-notes", dict.checkout.notesHint, errors.notes)} />
            </Field>
            <Field id="co-email" label={dict.checkout.email} optionalLabel={dict.common.optional} error={errors.email}>
              <input id="co-email" className="input" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} aria-describedby={describedBy("co-email", undefined, errors.email)} maxLength={120} />
            </Field>
            {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
            <div aria-hidden="true" className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0 [clip-path:inset(50%)]">
              <label htmlFor="co-website">Website</label>
              <input id="co-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block sm:w-auto" data-testid="to-review">{dict.checkout.review}</button>
          </form>
        ) : (
          <section aria-labelledby="rv-h" className="space-y-6">
            <h2 id="rv-h" ref={headingRef} tabIndex={-1} className="text-2xl outline-none">{dict.checkout.reviewTitle}</h2>
            <div className="card divide-y divide-sand">
              <div className="p-5">
                <h3 className="text-base text-muted">{dict.checkout.contact}</h3>
                <p className="mt-1 font-semibold">{form.name}</p>
                <p className="ltr-nums text-start" dir="ltr">{formatPhoneForDisplay(parsePalestinianPhone(form.phone)?.national ?? form.phone)}</p>
                {form.email ? <p dir="ltr" className="text-start">{form.email}</p> : null}
              </div>
              <div className="p-5">
                <h3 className="text-base text-muted">{dict.checkout.deliverTo}</h3>
                <p className="mt-1 font-semibold">{area ? pick(area.name, locale) : ""}</p>
                <p className="whitespace-pre-line">{form.address}</p>
                {form.notes ? <p className="mt-2 text-sm text-muted">{form.notes}</p> : null}
              </div>
              <div className="flex items-center gap-3 p-5">
                <IconCash className="text-gold" />
                <div><p className="font-semibold">{dict.common.cod}</p><p className="text-sm text-muted">{dict.checkout.codExplain}</p></div>
              </div>
            </div>
            {submitError ? <p className="alert alert-error" role="alert"><IconAlert className="shrink-0" /> {submitError}</p> : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep("details")} disabled={submitting}>{dict.checkout.edit}</button>
              <button type="button" className="btn btn-primary btn-lg flex-1" onClick={placeOrder} disabled={submitting || !quote} aria-busy={submitting} data-testid="place-order">
                {submitting ? <><Spinner /> {dict.checkout.placing}</> : <><IconCheck /> {dict.checkout.placeOrder}</>}
              </button>
            </div>
            <p className="text-sm text-muted">
              {dict.checkout.agree} <Link href={`/${locale}/privacy`} className="link-underline" target="_blank">{dict.checkout.privacyLink}</Link>.
            </p>
          </section>
        )}
        {summary}
      </div>
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${active ? "font-semibold text-charcoal" : "text-muted"}`} aria-current={active ? "step" : undefined}>
      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${active ? "bg-burgundy text-ivory" : done ? "bg-success text-white" : "bg-sand text-muted"}`}>
        {done ? <IconCheck size={14} /> : <span className="ltr-nums">{n}</span>}
      </span>
      {label}
    </li>
  );
}
