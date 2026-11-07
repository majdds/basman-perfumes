import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { resolveLocale } from "@/server/page-helpers";
import { getOrder } from "@/server/repos/orders";
import { getCatalog } from "@/server/services/catalog";
import { verifyViewToken } from "@/server/services/orders";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { pick } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { whatsappLink } from "@/lib/phone";
import { IconCash, IconCheck, IconInfo, IconPhone, IconWhatsapp } from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.confirmation.summary, robots: { index: false, follow: false } };
}

export default async function OrderConfirmationPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { number } = await params;
  const { settings } = await getCatalog();
  const valid = ORDER_NUMBER_PATTERN.test(number);
  const order = valid ? await getOrder(number) : null;
  const token = valid ? (await cookies()).get(`ord_${number}`)?.value : undefined;

  // Only the browser that placed the order can see it (protects customer data).
  if (!order || !verifyViewToken(order, token)) {
    return (
      <div className="container-page max-w-2xl py-20 text-center">
        <h1 className="text-3xl">{dict.confirmation.notFoundTitle}</h1>
        <p className="mt-4 text-muted">{dict.confirmation.notFoundText}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={whatsappLink(settings.whatsapp)} className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer"><IconWhatsapp /> {dict.common.whatsapp}</a>
          <Link href={`/${locale}/shop`} className="btn btn-secondary">{dict.confirmation.backToShop}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success"><IconCheck size={32} /></span>
        <h1 className="mt-6 text-3xl sm:text-4xl" data-testid="confirmation-title">{dict.confirmation.title}</h1>
        <p className="mt-6 text-muted">{dict.confirmation.orderNumber}</p>
        <p className="ltr-nums mt-1 font-[family-name:var(--font-display-en)] text-4xl font-bold tracking-wider text-burgundy" data-testid="order-number">{order.number}</p>
        <p className="mt-2 text-sm text-muted">{dict.confirmation.keepNumber}</p>
      </div>

      <section className="mt-10 rounded-[var(--radius-lg)] border border-sand bg-white p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl"><IconInfo className="text-gold" /> {dict.confirmation.whatNext}</h2>
        <p className="mt-3 text-ink">{dict.confirmation.nextText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={whatsappLink(settings.whatsapp, dict.confirmation.whatsappMessage(order.number))} className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">
            <IconWhatsapp /> {dict.confirmation.whatsappCta}
          </a>
          <a href={`tel:${settings.phone}`} className="btn btn-secondary"><IconPhone /> {dict.common.callUs}</a>
        </div>
      </section>

      <section className="mt-8 rounded-[var(--radius-lg)] border border-sand bg-white p-6 sm:p-8" aria-labelledby="sum-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sum-h" className="text-xl">{dict.confirmation.summary}</h2>
          <p className="text-sm text-muted">{formatDateTime(order.createdAt, locale)}</p>
        </div>
        <ul className="mt-4 divide-y divide-sand">
          {order.lines.map((l) => (
            <li key={`${l.productId}:${l.variantId}`} className="flex justify-between gap-4 py-3">
              <span>
                <span className="font-semibold">{pick(l.name, locale)}</span>
                {pick(l.variantLabel, locale) ? <span className="text-muted"> · {pick(l.variantLabel, locale)}</span> : null}
                <span className="ltr-nums block text-sm text-muted">{l.quantity} × {formatPrice(l.unitPrice, locale)}</span>
              </span>
              <span className="ltr-nums font-semibold">{formatPrice(l.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 border-t border-sand pt-4">
          <div className="flex justify-between"><dt>{dict.cart.subtotal}</dt><dd className="ltr-nums">{formatPrice(order.subtotal, locale)}</dd></div>
          <div className="flex justify-between"><dt>{dict.cart.delivery} · {pick(order.delivery.areaName, locale)}</dt><dd className="ltr-nums">{order.deliveryFee === 0 ? dict.cart.free : formatPrice(order.deliveryFee, locale)}</dd></div>
          <div className="flex justify-between border-t border-sand pt-3 text-lg font-bold"><dt>{dict.cart.total}</dt><dd className="ltr-nums">{formatPrice(order.total, locale)}</dd></div>
        </dl>
        <p className="mt-5 flex items-center gap-2 rounded-[var(--radius-md)] bg-cream p-3 text-sm"><IconCash size={20} className="text-gold" /> {dict.common.codShort}</p>
      </section>

      <div className="mt-10 text-center">
        <Link href={`/${locale}/shop`} className="btn btn-secondary">{dict.confirmation.backToShop}</Link>
      </div>
    </div>
  );
}
