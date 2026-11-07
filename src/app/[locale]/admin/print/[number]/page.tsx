import { notFound } from "next/navigation";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { getOrder } from "@/server/repos/orders";
import { getSettings } from "@/server/repos/settings";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { pick } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { formatPhoneForDisplay, parsePalestinianPhone } from "@/lib/phone";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { robots: { index: false, follow: false } };

/** A4/receipt-friendly printable order slip. */
export default async function PrintOrder({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdminPage(locale);
  const { number } = await params;
  if (!ORDER_NUMBER_PATTERN.test(number)) notFound();
  const [order, settings] = await Promise.all([getOrder(number), getSettings()]);
  if (!order) notFound();
  const t = dict.admin.order;
  const storePhone = parsePalestinianPhone(settings.phone);
  return (
    <main className="mx-auto max-w-2xl bg-white p-8 print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton label={t.print} /></div>
      <header className="flex items-start justify-between border-b-2 border-charcoal pb-4">
        <div>
          <p className="font-[family-name:var(--font-wordmark)] text-4xl text-burgundy" lang="ar">بسمان</p>
          <p className="text-sm">{pick(settings.addressText, locale)}</p>
          {storePhone ? <p className="ltr-nums text-sm">{formatPhoneForDisplay(storePhone.national)}</p> : null}
        </div>
        <div className="text-end">
          <p className="text-sm text-muted">{t.receipt}</p>
          <p className="ltr-nums text-2xl font-bold">{order.number}</p>
          <p className="text-sm">{formatDateTime(order.createdAt, locale)}</p>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 border-b border-sand py-4">
        <div>
          <p className="text-sm text-muted">{t.customer}</p>
          <p className="font-semibold">{order.customer.name}</p>
          <p className="ltr-nums text-start" dir="ltr">{order.customer.phoneNational ? formatPhoneForDisplay(order.customer.phoneNational) : ""}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t.delivery}</p>
          <p className="font-semibold">{pick(order.delivery.areaName, locale)}</p>
          <p className="whitespace-pre-line">{order.delivery.address}</p>
          {order.delivery.notes ? <p className="mt-1 text-sm">{t.notes}: {order.delivery.notes}</p> : null}
        </div>
      </section>
      <table className="mt-4 w-full">
        <thead className="border-b border-charcoal text-sm">
          <tr><th className="py-2 text-start">{dict.admin.products.name}</th><th className="py-2 text-center">{t.qty}</th><th className="py-2 text-end">{t.price}</th><th className="py-2 text-end">{t.lineTotal}</th></tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={`${l.productId}:${l.variantId}`} className="border-b border-sand">
              <td className="py-2">{pick(l.name, locale)}{pick(l.variantLabel, locale) ? ` — ${pick(l.variantLabel, locale)}` : ""}</td>
              <td className="ltr-nums py-2 text-center">{l.quantity}</td>
              <td className="ltr-nums py-2 text-end">{formatPrice(l.unitPrice, locale)}</td>
              <td className="ltr-nums py-2 text-end">{formatPrice(l.lineTotal, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-4 w-64 space-y-1">
        <div className="flex justify-between"><dt>{t.subtotal}</dt><dd className="ltr-nums">{formatPrice(order.subtotal, locale)}</dd></div>
        <div className="flex justify-between"><dt>{t.deliveryFee}</dt><dd className="ltr-nums">{formatPrice(order.deliveryFee, locale)}</dd></div>
        <div className="flex justify-between border-t-2 border-charcoal pt-1 text-lg font-bold"><dt>{dict.cart.total}</dt><dd className="ltr-nums">{formatPrice(order.total, locale)}</dd></div>
      </dl>
      <p className="mt-6 rounded border border-charcoal p-3 text-center font-semibold">{t.cod} — {formatPrice(order.total, locale)}</p>
      <p className="mt-8 text-center text-sm text-muted">{t.thanks}</p>
    </main>
  );
}
