import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { pick } from "@/lib/i18n";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Locale, Order } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { IconChevron } from "../ui/icons";

/** Orders as large tappable cards — readable on phones and tablets as well as desktops. */
export function OrderList({ orders, locale, dict }: { orders: Order[]; locale: Locale; dict: Dictionary }) {
  return (
    <ul className="space-y-3" data-testid="order-list">
      {orders.map((o) => {
        const isNew = o.status === "new";
        return (
          <li key={o.number}>
            <Link
              href={`/${locale}/admin/orders/${o.number}`}
              className={`flex items-center gap-4 rounded-[var(--radius-lg)] border bg-white p-4 transition hover:shadow-[var(--shadow-soft)] sm:p-5 ${isNew ? "border-burgundy/40 border-s-4 border-s-burgundy" : "border-sand"}`}
              data-testid="order-row"
              data-order={o.number}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="ltr-nums text-lg font-bold text-charcoal">{o.number}</span>
                  <StatusBadge status={o.status} label={dict.status[o.status]} />
                  {isNew && !o.seenByAdmin ? <span className="h-2.5 w-2.5 rounded-full bg-burgundy" aria-label={dict.admin.orders.newBadge} /> : null}
                </div>
                <p className="mt-1 truncate text-ink">
                  <span className="font-semibold">{o.customer.name}</span>
                  {o.customer.phoneNational ? <span className="ltr-nums text-muted"> · {formatPhoneForDisplay(o.customer.phoneNational)}</span> : null}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {pick(o.delivery.areaName, locale)} · {formatDateTime(o.createdAt, locale)}
                </p>
              </div>
              <div className="text-end">
                <p className="ltr-nums text-lg font-bold text-charcoal">{formatPrice(o.total, locale)}</p>
                <p className="text-sm text-muted">{o.lines.reduce((n, l) => n + l.quantity, 0)} ×</p>
              </div>
              <IconChevron className="shrink-0 text-muted rtl:rotate-180" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
