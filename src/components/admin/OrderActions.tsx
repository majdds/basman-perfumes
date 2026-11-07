"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { getDictionary } from "@/lib/i18n";
import { isTerminal, nextStatus, ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { useAdmin } from "./AdminProviders";
import { Spinner } from "../ui/Spinner";
import { IconArrow, IconClose } from "../ui/icons";

export function OrderActions({ number, status }: { number: string; status: OrderStatus }) {
  const { locale, toast, confirm } = useAdmin();
  const dict = getDictionary(locale);
  const t = dict.admin.order;
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [manual, setManual] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");

  if (isTerminal(status)) return <p className="alert alert-info">{t.final}</p>;
  const next = nextStatus(status);

  const change = async (to: OrderStatus) => {
    if (to === "cancelled" && !(await confirm(t.confirmCancel, { danger: true, confirmLabel: t.cancelOrder }))) return;
    if (to === "delivered" && !(await confirm(t.confirmDelivered, { confirmLabel: dict.status.delivered }))) return;
    setBusy(to);
    try {
      await api(`/api/admin/orders/${number}`, { method: "PATCH", body: { status: to, note: note || null } });
      toast(t.statusUpdated(dict.status[to]));
      setNote("");
      setManual("");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError && e.status === 401 ? dict.admin.common.unauthorized : dict.admin.common.error, "error");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {next ? (
        <div>
          <p className="field-label">{t.nextStep}</p>
          <button className="btn btn-primary btn-lg btn-block text-xl" disabled={!!busy} onClick={() => change(next)} data-testid="advance-status" data-next={next}>
            {busy === next ? <Spinner /> : <IconArrow className="rtl:rotate-180" />} {t.advanceTo(dict.status[next])}
          </button>
        </div>
      ) : null}

      <div>
        <label htmlFor="st-note" className="field-label">{t.note}</label>
        <input id="st-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>

      <details className="rounded-[var(--radius-md)] border border-sand bg-white p-4">
        <summary className="cursor-pointer font-semibold">{t.changeStatus}</summary>
        <div className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="st-manual" className="sr-only">{t.changeStatus}</label>
          <select id="st-manual" className="input flex-1" value={manual} onChange={(e) => setManual(e.target.value as OrderStatus)} data-testid="manual-status">
            <option value="">—</option>
            {ORDER_STATUSES.filter((s) => s !== status && s !== "cancelled").map((s) => <option key={s} value={s}>{dict.status[s]}</option>)}
          </select>
          <button className="btn btn-dark" disabled={!manual || !!busy} onClick={() => manual && change(manual)} data-testid="manual-apply">{dict.common.save}</button>
        </div>
      </details>

      <button className="btn btn-outline-danger btn-block" disabled={!!busy} onClick={() => change("cancelled")} data-testid="cancel-order">
        {busy === "cancelled" ? <Spinner /> : <IconClose />} {t.cancelOrder}
      </button>
    </div>
  );
}
