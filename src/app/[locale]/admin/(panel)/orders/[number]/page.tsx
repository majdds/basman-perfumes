import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { getOrder, markOrderSeen } from "@/server/repos/orders";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { pick } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { formatPhoneForDisplay, whatsappLink } from "@/lib/phone";
import { OrderActions } from "@/components/admin/OrderActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { IconChevron, IconPhone, IconPrint, IconWhatsapp } from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { dict } = await resolveLocale(params);
  const { number } = await params;
  return { title: dict.admin.order.title(number) };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdminPage(locale);
  const { number } = await params;
  if (!ORDER_NUMBER_PATTERN.test(number)) notFound();
  const order = await getOrder(number);
  if (!order) notFound();
  if (!order.seenByAdmin) await markOrderSeen(number).catch(() => undefined);
  const t = dict.admin.order;
  const waText = t.whatsappConfirm(order.customer.name, order.number);

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-4 text-sm text-muted">
        <Link href={`/${locale}/admin/orders`} className="hover:text-burgundy">{dict.admin.orders.title}</Link>
        <IconChevron size={14} className="mx-1.5 inline rtl:rotate-180" />
        <span className="ltr-nums">{order.number}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="ltr-nums text-3xl" data-testid="order-title">{order.number}</h1>
        <StatusBadge status={order.status} label={dict.status[order.status]} large />
        <span className="text-muted">{formatDateTime(order.createdAt, locale)}</span>
        <Link href={`/${locale}/admin/print/${order.number}`} target="_blank" className="btn btn-secondary btn-sm ms-auto"><IconPrint size={20} /> {t.print}</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {order.anonymized ? <p className="alert alert-info">{t.anonymized}</p> : null}
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg text-muted">{t.customer}</h2>
            <p className="mt-1 text-2xl font-semibold text-charcoal">{order.customer.name}</p>
            {order.customer.phoneNational ? (
              <>
                <p className="ltr-nums mt-1 text-xl text-start" dir="ltr">{formatPhoneForDisplay(order.customer.phoneNational)}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={`tel:${order.customer.phone}`} className="btn btn-dark"><IconPhone /> {t.call}</a>
                  <a href={whatsappLink(order.customer.phone, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp"><IconWhatsapp /> {t.whatsapp}</a>
                </div>
              </>
            ) : null}
            {order.customer.email ? <p className="mt-3 text-start" dir="ltr">{order.customer.email}</p> : null}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg text-muted">{t.delivery}</h2>
            <p className="mt-1 text-xl font-semibold">{pick(order.delivery.areaName, locale)}</p>
            <p className="mt-1 whitespace-pre-line text-lg">{order.delivery.address}</p>
            <h3 className="mt-5 text-base text-muted">{t.notes}</h3>
            <p className="mt-1 whitespace-pre-line">{order.delivery.notes || <span className="text-muted">{t.noNotes}</span>}</p>
          </section>

          <section className="card overflow-hidden">
            <h2 className="p-5 pb-0 text-lg text-muted sm:p-6 sm:pb-0">{t.items}</h2>
            <table className="mt-3 w-full text-start">
              <thead className="border-b border-sand text-sm text-muted">
                <tr>
                  <th className="px-5 py-2 text-start font-semibold sm:px-6">{dict.admin.products.name}</th>
                  <th className="px-2 py-2 text-center font-semibold">{t.qty}</th>
                  <th className="px-5 py-2 text-end font-semibold sm:px-6">{t.lineTotal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {order.lines.map((l) => (
                  <tr key={`${l.productId}:${l.variantId}`}>
                    <td className="px-5 py-3 sm:px-6">
                      <span className="block font-semibold">{pick(l.name, locale)}</span>
                      <span className="text-sm text-muted">{l.brand}{pick(l.variantLabel, locale) ? ` · ${pick(l.variantLabel, locale)}` : ""} · <span className="ltr-nums">{formatPrice(l.unitPrice, locale)}</span></span>
                    </td>
                    <td className="ltr-nums px-2 py-3 text-center text-lg font-bold">{l.quantity}</td>
                    <td className="ltr-nums px-5 py-3 text-end font-semibold sm:px-6">{formatPrice(l.lineTotal, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-2 border-t border-sand bg-cream/50 p-5 sm:p-6">
              <div className="flex justify-between"><dt>{t.subtotal}</dt><dd className="ltr-nums">{formatPrice(order.subtotal, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t.deliveryFee}</dt><dd className="ltr-nums">{formatPrice(order.deliveryFee, locale)}</dd></div>
              <div className="flex justify-between text-xl font-bold"><dt>{t.total}</dt><dd className="ltr-nums" data-testid="order-total">{formatPrice(order.total, locale)}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-lg">{t.currentStatus}: <StatusBadge status={order.status} label={dict.status[order.status]} large /></h2>
            <OrderActions number={order.number} status={order.status} />
          </section>
          <section className="card p-5">
            <h2 className="text-lg">{t.history}</h2>
            <ol className="mt-3 space-y-3 border-s border-sand ps-4">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[21px] top-2 h-2.5 w-2.5 rounded-full bg-champagne" />
                  <p className="font-semibold">{dict.status[h.status]}</p>
                  <p className="text-sm text-muted">{formatDateTime(h.at, locale)} · {t.by} {h.by === "customer" ? t.customerLabel : h.by}</p>
                  {h.note ? <p className="text-sm">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
