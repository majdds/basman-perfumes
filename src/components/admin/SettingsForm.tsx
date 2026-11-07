"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { errorMessage, getDictionary } from "@/lib/i18n";
import { agorotToShekels, shekelsToAgorot } from "@/lib/money";
import { parsePalestinianPhone } from "@/lib/phone";
import type { StoreSettings } from "@/lib/types";
import { useAdmin } from "./AdminProviders";
import { ImageUploader } from "./ImageUploader";
import { TextField, Toggle } from "./ProductForm";
import { Spinner } from "../ui/Spinner";
import { IconCheck, IconPlus, IconTrash } from "../ui/icons";

interface Area { id?: string; ar: string; en: string; fee: string; freeOver: string; active: boolean }

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const { locale, toast, confirm } = useAdmin();
  const dict = getDictionary(locale);
  const t = dict.admin.settings;
  const router = useRouter();
  const [s, setS] = useState({
    phone: parsePalestinianPhone(settings.phone)?.national ?? settings.phone,
    whatsapp: parsePalestinianPhone(settings.whatsapp)?.national ?? settings.whatsapp,
    addressAr: settings.addressText.ar,
    addressEn: settings.addressText.en,
    mapsUrl: settings.mapsUrl ?? "",
    hoursAr: settings.hours?.ar ?? "",
    hoursEn: settings.hours?.en ?? "",
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    annAr: settings.announcement?.ar ?? "",
    annEn: settings.announcement?.en ?? "",
    lowStock: String(settings.lowStockThreshold),
    retention: String(settings.retentionDays),
    orderingEnabled: settings.orderingEnabled,
  });
  const [hero, setHero] = useState(settings.heroImageKey ? [{ key: settings.heroImageKey, width: 1200, height: 1500 }] : []);
  const [areas, setAreas] = useState<Area[]>(settings.deliveryAreas.map((a) => ({ id: a.id, ar: a.name.ar, en: a.name.en, fee: String(agorotToShekels(a.fee)), freeOver: a.freeOver ? String(agorotToShekels(a.freeOver)) : "", active: a.active })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof s) => (v: string) => setS((x) => ({ ...x, [k]: v }));
  const err = (k: string) => (errors[k] ? errorMessage(dict, errors[k]) : null);
  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: {
          phone: s.phone,
          whatsapp: s.whatsapp,
          addressText: { ar: s.addressAr, en: s.addressEn },
          mapsUrl: s.mapsUrl.trim() || null,
          hours: { ar: s.hoursAr || null, en: s.hoursEn || null },
          instagramUrl: s.instagramUrl,
          facebookUrl: s.facebookUrl,
          deliveryAreas: areas.map((a) => ({ ...(a.id ? { id: a.id } : {}), name: { ar: a.ar, en: a.en }, fee: shekelsToAgorot(num(a.fee)), freeOver: a.freeOver ? shekelsToAgorot(num(a.freeOver)) : null, active: a.active })),
          lowStockThreshold: Number.parseInt(s.lowStock, 10) || 0,
          retentionDays: Number.parseInt(s.retention, 10) || 0,
          orderingEnabled: s.orderingEnabled,
          heroImageKey: hero[0]?.key ?? null,
          announcement: { ar: s.annAr || null, en: s.annEn || null },
        },
      });
      toast(t.saved);
      router.refresh();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.code === "validation") {
        setErrors((e2.details as { fields?: Record<string, string> } | null)?.fields ?? {});
        toast(dict.errors.fixErrors, "error");
      } else toast(dict.admin.common.error, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <Card title={t.store}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="s-phone" label={t.phone} value={s.phone} onChange={set("phone")} error={err("phone")} dir="ltr" inputMode="text" />
          <TextField id="s-wa" label={t.whatsapp} value={s.whatsapp} onChange={set("whatsapp")} error={err("whatsapp")} dir="ltr" />
          <TextField id="s-addr-ar" label={t.addressAr} value={s.addressAr} onChange={set("addressAr")} error={err("addressText.ar")} dir="rtl" />
          <TextField id="s-addr-en" label={t.addressEn} value={s.addressEn} onChange={set("addressEn")} error={err("addressText.en")} dir="ltr" />
          <TextField id="s-hours-ar" label={t.hoursAr} value={s.hoursAr} onChange={set("hoursAr")} dir="rtl" optional={dict.common.optional} />
          <TextField id="s-hours-en" label={t.hoursEn} value={s.hoursEn} onChange={set("hoursEn")} dir="ltr" optional={dict.common.optional} />
          <div className="sm:col-span-2"><TextField id="s-maps" label={t.mapsUrl} value={s.mapsUrl} onChange={set("mapsUrl")} error={err("mapsUrl")} dir="ltr" optional={dict.common.optional} /></div>
          <TextField id="s-ig" label={t.instagram} value={s.instagramUrl} onChange={set("instagramUrl")} error={err("instagramUrl")} dir="ltr" />
          <TextField id="s-fb" label={t.facebook} value={s.facebookUrl} onChange={set("facebookUrl")} error={err("facebookUrl")} dir="ltr" />
          <TextField id="s-ann-ar" label={t.announcementAr} value={s.annAr} onChange={set("annAr")} dir="rtl" optional={dict.common.optional} />
          <TextField id="s-ann-en" label={t.announcementEn} value={s.annEn} onChange={set("annEn")} dir="ltr" optional={dict.common.optional} />
        </div>
      </Card>

      <Card title={t.heroImage} hint={t.heroImageHint}>
        <ImageUploader locale={locale} images={hero} onChange={setHero} max={1} single />
      </Card>

      <Card title={t.delivery} hint={t.deliveryHint}>
        <div className="space-y-3">
          {areas.map((a, i) => (
            <div key={a.id ?? `n${i}`} className="grid gap-3 rounded-[var(--radius-md)] border border-sand bg-cream/40 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_120px_150px_auto]">
              <TextField id={`a${i}ar`} label={t.areaAr} value={a.ar} onChange={(v) => setAreas((x) => x.map((y, j) => (j === i ? { ...y, ar: v } : y)))} error={err(`deliveryAreas.${i}.name.ar`)} dir="rtl" />
              <TextField id={`a${i}en`} label={t.areaEn} value={a.en} onChange={(v) => setAreas((x) => x.map((y, j) => (j === i ? { ...y, en: v } : y)))} error={err(`deliveryAreas.${i}.name.en`)} dir="ltr" />
              <TextField id={`a${i}fee`} label={t.fee} value={a.fee} onChange={(v) => setAreas((x) => x.map((y, j) => (j === i ? { ...y, fee: v } : y)))} inputMode="decimal" dir="ltr" />
              <TextField id={`a${i}free`} label={t.freeOver} value={a.freeOver} onChange={(v) => setAreas((x) => x.map((y, j) => (j === i ? { ...y, freeOver: v } : y)))} inputMode="decimal" dir="ltr" />
              <div className="flex items-end gap-3">
                <Toggle id={`a${i}act`} label={t.areaActive} checked={a.active} onChange={(v) => setAreas((x) => x.map((y, j) => (j === i ? { ...y, active: v } : y)))} />
                <button type="button" className="btn btn-ghost text-danger" aria-label={t.removeArea} onClick={() => setAreas((x) => x.filter((_, j) => j !== i))}><IconTrash /></button>
              </div>
            </div>
          ))}
          {err("deliveryAreas") ? <p className="field-error">{err("deliveryAreas")}</p> : null}
          <button type="button" className="btn btn-secondary" onClick={() => setAreas((x) => [...x, { ar: "", en: "", fee: "0", freeOver: "", active: true }])}><IconPlus /> {t.addArea}</button>
        </div>
      </Card>

      <Card title={t.orders}>
        <div className="space-y-5">
          <Toggle id="s-ordering" label={t.orderingEnabled} hint={t.orderingEnabledHint} checked={s.orderingEnabled} onChange={(v) => setS((x) => ({ ...x, orderingEnabled: v }))} />
          <div className="max-w-xs"><TextField id="s-low" label={t.lowStock} value={s.lowStock} onChange={set("lowStock")} inputMode="numeric" dir="ltr" /></div>
        </div>
      </Card>

      <Card title={t.privacy}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="max-w-md flex-1"><TextField id="s-ret" label={t.retentionDays} value={s.retention} onChange={set("retention")} inputMode="numeric" dir="ltr" /></div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              if (!(await confirm(t.retentionDays))) return;
              try {
                const r = await api<{ anonymized: number }>("/api/admin/settings/retention", { body: {} });
                toast(t.retentionDone(r.anonymized));
              } catch {
                toast(dict.admin.common.error, "error");
              }
            }}
          >
            {t.runRetention}
          </button>
        </div>
      </Card>

      <div className="sticky bottom-20 z-20 rounded-[var(--radius-lg)] border border-sand bg-ivory/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur lg:bottom-4">
        <button className="btn btn-primary btn-lg btn-block" disabled={saving} data-testid="save-settings">{saving ? <Spinner /> : <IconCheck />} {dict.common.save}</button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { locale, toast } = useAdmin();
  const dict = getDictionary(locale);
  const t = dict.admin.settings;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4 sm:grid-cols-3 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== repeat) {
          setError(t.passwordMismatch);
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await api("/api/admin/password", { body: { currentPassword: current, newPassword: next } });
          setCurrent("");
          setNext("");
          setRepeat("");
          toast(t.passwordChanged);
        } catch (e2) {
          const ae = e2 instanceof ApiError ? e2 : null;
          if (ae?.code === "wrongPassword") setError(t.wrongPassword);
          else if (ae?.code === "validation") setError(errorMessage(dict, Object.values((ae.details as { fields?: Record<string, string> })?.fields ?? {})[0]));
          else setError(dict.admin.common.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div><label className="field-label" htmlFor="pw-c">{t.currentPassword}</label><input id="pw-c" type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" /></div>
      <div><label className="field-label" htmlFor="pw-n">{t.newPassword}</label><input id="pw-n" type="password" className="input" autoComplete="new-password" minLength={12} value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" /></div>
      <div><label className="field-label" htmlFor="pw-r">{t.repeatPassword}</label><input id="pw-r" type="password" className="input" autoComplete="new-password" minLength={12} value={repeat} onChange={(e) => setRepeat(e.target.value)} dir="ltr" /></div>
      <button className="btn btn-dark sm:col-span-3 sm:w-fit" disabled={busy || !current || !next || !repeat} data-testid="change-password">{t.changePassword}</button>
      {error ? <p className="field-error sm:col-span-3" role="alert">{error}</p> : null}
    </form>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-sand bg-white p-5 sm:p-7">
      <h2 className="text-xl">{title}</h2>
      {hint ? <p className="mt-1 text-muted">{hint}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
