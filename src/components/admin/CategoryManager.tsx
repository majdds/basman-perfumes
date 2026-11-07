"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { getDictionary } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { useAdmin } from "./AdminProviders";
import { IconCheck, IconPlus, IconTrash } from "../ui/icons";

export function CategoryManager({ categories, canDelete }: { categories: Category[]; canDelete: boolean }) {
  const { locale, toast, confirm } = useAdmin();
  const dict = getDictionary(locale);
  const t = dict.admin.categories;
  const router = useRouter();
  const [rows, setRows] = useState(categories.map((c) => ({ id: c.id as string | undefined, ar: c.name.ar, en: c.name.en, order: String(c.sortOrder) })));
  const [busy, setBusy] = useState<number | null>(null);

  const save = async (i: number) => {
    const r = rows[i]!;
    setBusy(i);
    try {
      const body = { name: { ar: r.ar, en: r.en }, sortOrder: Number(r.order) || 0 };
      const saved = await api<Category>(r.id ? `/api/admin/categories/${r.id}` : "/api/admin/categories", { method: r.id ? "PUT" : "POST", body });
      setRows((rs) => rs.map((x, j) => (j === i ? { ...x, id: saved.id } : x)));
      toast(t.saved);
      router.refresh();
    } catch {
      toast(dict.errors.fixErrors, "error");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (i: number) => {
    const r = rows[i]!;
    if (!r.id) return setRows((rs) => rs.filter((_, j) => j !== i));
    if (!(await confirm(t.confirmDelete, { danger: true, confirmLabel: dict.common.delete }))) return;
    setBusy(i);
    try {
      await api(`/api/admin/categories/${r.id}`, { method: "DELETE" });
      setRows((rs) => rs.filter((_, j) => j !== i));
      toast(t.deleted);
      router.refresh();
    } catch {
      toast(dict.admin.common.error, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id ?? `n${i}`} className="grid gap-3 rounded-[var(--radius-lg)] border border-sand bg-white p-4 sm:grid-cols-[1fr_1fr_90px_auto] sm:items-end">
          <div><label className="field-label" htmlFor={`c${i}a`}>{t.nameAr}</label><input id={`c${i}a`} className="input" dir="rtl" value={r.ar} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} /></div>
          <div><label className="field-label" htmlFor={`c${i}e`}>{t.nameEn}</label><input id={`c${i}e`} className="input" dir="ltr" value={r.en} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} /></div>
          <div><label className="field-label" htmlFor={`c${i}o`}>{t.order}</label><input id={`c${i}o`} className="input ltr-nums" inputMode="numeric" value={r.order} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, order: e.target.value.replace(/\D/g, "") } : x)))} /></div>
          <div className="flex gap-2">
            <button className="btn btn-dark" disabled={busy === i} onClick={() => save(i)} aria-label={dict.common.save}><IconCheck /> {dict.common.save}</button>
            {canDelete || !r.id ? <button className="btn btn-ghost text-danger" disabled={busy === i} onClick={() => remove(i)} aria-label={dict.common.delete}><IconTrash /></button> : null}
          </div>
        </div>
      ))}
      <button className="btn btn-secondary" onClick={() => setRows((rs) => [...rs, { id: undefined, ar: "", en: "", order: String(rs.length + 1) }])}><IconPlus /> {t.add}</button>
    </div>
  );
}
