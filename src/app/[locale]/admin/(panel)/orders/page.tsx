import Link from "next/link";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { adminListOrders } from "@/server/services/admin-orders";
import { orderListQuerySchema } from "@/lib/validation";
import { OrderList } from "@/components/admin/OrderList";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconDownload, IconList, IconSearch } from "@/components/ui/icons";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.orders.title };
}

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SP }) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdminPage(locale);
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = orderListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : orderListQuerySchema.parse({});
  const { orders, cursor } = await adminListOrders(query);
  const t = dict.admin.orders;

  const tabs: { key: typeof query.status; label: string }[] = [
    { key: "all", label: t.filterAll },
    { key: "new", label: dict.status.new },
    { key: "open", label: t.filterOpen },
    { key: "confirmed", label: dict.status.confirmed },
    { key: "preparing", label: dict.status.preparing },
    { key: "out_for_delivery", label: dict.status.out_for_delivery },
    { key: "delivered", label: dict.status.delivered },
    { key: "cancelled", label: dict.status.cancelled },
  ];
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { status: query.status === "all" ? undefined : query.status, q: query.q, from: query.from, to: query.to, ...over };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };
  const exportQs = new URLSearchParams({ status: query.status, locale, ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{t.title}</h1>
        <a href={`/api/admin/orders/export?${exportQs}`} className="btn btn-secondary btn-sm" download><IconDownload size={20} /> {t.exportCsv}</a>
      </div>

      <form method="get" className="grid gap-3 rounded-[var(--radius-lg)] border border-sand bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        {query.status !== "all" ? <input type="hidden" name="status" value={query.status} /> : null}
        <div>
          <label htmlFor="o-q" className="field-label">{t.search}</label>
          <input id="o-q" name="q" defaultValue={query.q} className="input" dir="ltr" inputMode="text" data-testid="order-search" />
        </div>
        <div>
          <label htmlFor="o-from" className="field-label">{t.from}</label>
          <input id="o-from" name="from" type="date" defaultValue={query.from} className="input" />
        </div>
        <div>
          <label htmlFor="o-to" className="field-label">{t.to}</label>
          <input id="o-to" name="to" type="date" defaultValue={query.to} className="input" />
        </div>
        <button className="btn btn-dark"><IconSearch /> {t.searchButton}</button>
      </form>

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label={t.status}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={link({ status: tab.key === "all" ? undefined : tab.key, q: undefined })}
            aria-current={query.status === tab.key ? "page" : undefined}
            className={`btn btn-sm shrink-0 ${query.status === tab.key ? "btn-dark" : "btn-ghost border border-sand bg-white"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {orders.length ? (
        <OrderList orders={orders} locale={locale} dict={dict} />
      ) : (
        <div className="card"><EmptyState icon={<IconList size={28} />} title={query.q || query.from || query.to || query.status !== "all" ? t.emptyFiltered : t.empty} /></div>
      )}

      {cursor ? (
        <div className="text-center">
          <Link href={link({ cursor })} className="btn btn-secondary">{t.loadMore}</Link>
        </div>
      ) : null}
    </div>
  );
}
