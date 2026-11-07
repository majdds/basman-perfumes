"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { getDictionary } from "@/lib/i18n";
import { useAdmin } from "./AdminProviders";

export function ProductRowActions({ id, status, canDelete }: { id: string; status: "active" | "archived"; canDelete: boolean }) {
  const { locale, toast, confirm } = useAdmin();
  const t = getDictionary(locale).admin.products;
  const common = getDictionary(locale).admin.common;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
    } catch {
      toast(common.error, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        <button className="btn btn-ghost btn-sm border border-sand" disabled={busy} onClick={async () => (await confirm(t.confirmArchive)) && run(() => api(`/api/admin/products/${id}`, { method: "PATCH", body: { status: "archived" } }), t.archived_ok)}>
          {t.archive}
        </button>
      ) : (
        <button className="btn btn-ghost btn-sm border border-sand" disabled={busy} onClick={() => run(() => api(`/api/admin/products/${id}`, { method: "PATCH", body: { status: "active" } }), t.restored_ok)}>
          {t.restore}
        </button>
      )}
      {canDelete && status === "archived" ? (
        <button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={async () => (await confirm(t.confirmDelete, { danger: true, confirmLabel: t.deleteForever })) && run(() => api(`/api/admin/products/${id}`, { method: "DELETE" }), t.deleted_ok)}>
          {t.deleteForever}
        </button>
      ) : null}
    </div>
  );
}
