"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { errorMessage, getDictionary, pick } from "@/lib/i18n";
import { agorotToShekels, shekelsToAgorot } from "@/lib/money";
import type { Category, Gender, Locale, Product } from "@/lib/types";
import { useAdmin } from "./AdminProviders";
import { ImageUploader, type UploadedImage } from "./ImageUploader";
import { Spinner } from "../ui/Spinner";
import { IconCheck, IconEye, IconPlus, IconTrash } from "../ui/icons";

interface VariantState {
  id?: string;
  labelAr: string;
  labelEn: string;
  sizeMl: string;
  sku: string;
  price: string;
  salePrice: string;
  trackStock: boolean;
  stock: string;
}

const money = (a: number | null | undefined) => (a ? String(agorotToShekels(a)) : "");
const toAgorot = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(n) ? null : shekelsToAgorot(n);
};
const toInt = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10));

export function ProductForm({ locale, categories, product }: { locale: Locale; categories: Category[]; product?: Product }) {
  const { toast } = useAdmin();
  const dict = getDictionary(locale);
  const t = dict.admin.productForm;
  const router = useRouter();
  const [nameAr, setNameAr] = useState(product?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(product?.name.en ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [gender, setGender] = useState<Gender | "">(product?.gender ?? "");
  const [familyAr, setFamilyAr] = useState(product?.fragranceFamily?.ar ?? "");
  const [familyEn, setFamilyEn] = useState(product?.fragranceFamily?.en ?? "");
  const [descAr, setDescAr] = useState(product?.description.ar ?? "");
  const [descEn, setDescEn] = useState(product?.description.en ?? "");
  const [images, setImages] = useState<UploadedImage[]>(product?.images.map(({ key, width, height }) => ({ key, width, height })) ?? []);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [variants, setVariants] = useState<VariantState[]>(
    product?.variants.map((v) => ({
      id: v.id,
      labelAr: v.label.ar,
      labelEn: v.label.en,
      sizeMl: v.sizeMl ? String(v.sizeMl) : "",
      sku: v.sku ?? "",
      price: money(v.price),
      salePrice: money(v.salePrice),
      trackStock: v.trackStock,
      stock: v.stock != null ? String(v.stock) : "",
    })) ?? [{ labelAr: "", labelEn: "", sizeMl: "", sku: "", price: "", salePrice: "", trackStock: true, stock: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const err = (path: string) => (errors[path] ? errorMessage(dict, errors[path]) : null);
  const setV = (i: number, patch: Partial<VariantState>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      name: { ar: nameAr, en: nameEn || null },
      slug: product && slug && slug !== product.slug ? slug : null,
      brand,
      description: { ar: descAr || null, en: descEn || null },
      categoryId: categoryId || null,
      gender: gender || null,
      fragranceFamily: { ar: familyAr || null, en: familyEn || null },
      images,
      variants: variants.map((v) => {
        const sizeMl = toInt(v.sizeMl);
        return {
          ...(v.id ? { id: v.id } : {}),
          label: { ar: v.labelAr || (sizeMl ? `${sizeMl} مل` : null), en: v.labelEn || (sizeMl ? `${sizeMl} ml` : null) },
          sizeMl,
          sku: v.sku || null,
          price: toAgorot(v.price) ?? 0,
          salePrice: toAgorot(v.salePrice),
          trackStock: v.trackStock,
          stock: v.trackStock ? (toInt(v.stock) ?? 0) : null,
        };
      }),
      featured,
      available,
    };
    try {
      if (product) {
        await api(`/api/admin/products/${product.id}`, { method: "PUT", body: { version: product.version, product: body } });
        toast(t.saved);
        router.refresh();
      } else {
        await api<Product>("/api/admin/products", { body });
        toast(t.created);
        router.push(`/${locale}/admin/products`);
      }
    } catch (e2) {
      const ae = e2 instanceof ApiError ? e2 : null;
      if (ae?.code === "validation") {
        const fields = (ae.details as { fields?: Record<string, string> } | null)?.fields ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace(/^product\./, ""), v])));
        toast(dict.errors.fixErrors, "error");
      } else if (ae?.code === "conflict") toast(t.conflict, "error");
      else if (ae?.code === "slugTaken") {
        setErrors({ slug: "invalidSlug" });
        toast(t.slugTaken, "error");
      } else if (ae?.status === 401) toast(dict.admin.common.unauthorized, "error");
      else toast(dict.admin.common.error, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <Section title={t.basics}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="p-name-ar" label={t.nameAr} value={nameAr} onChange={setNameAr} error={err("name.ar")} required dir="rtl" />
          <TextField id="p-name-en" label={t.nameEn} value={nameEn} onChange={setNameEn} error={err("name.en")} dir="ltr" optional={dict.common.optional} />
          <TextField id="p-brand" label={t.brand} hint={t.brandHint} value={brand} onChange={setBrand} error={err("brand")} required />
          <div>
            <label htmlFor="p-cat" className="field-label">{t.category}</label>
            <select id="p-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t.noCategory}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{pick(c.name, locale)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-gender" className="field-label">{t.gender}</label>
            <select id="p-gender" className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender | "")}>
              <option value="">{t.noGender}</option>
              <option value="women">{dict.gender.women}</option>
              <option value="men">{dict.gender.men}</option>
              <option value="unisex">{dict.gender.unisex}</option>
            </select>
          </div>
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
            <TextField id="p-fam-ar" label={t.familyAr} value={familyAr} onChange={setFamilyAr} optional={dict.common.optional} dir="rtl" />
            <TextField id="p-fam-en" label={t.familyEn} value={familyEn} onChange={setFamilyEn} optional={dict.common.optional} dir="ltr" />
          </div>
          <TextArea id="p-desc-ar" label={t.descAr} value={descAr} onChange={setDescAr} error={err("description.ar")} dir="rtl" optional={dict.common.optional} />
          <TextArea id="p-desc-en" label={t.descEn} value={descEn} onChange={setDescEn} error={err("description.en")} dir="ltr" optional={dict.common.optional} />
        </div>
      </Section>

      <Section title={t.images}>
        <ImageUploader locale={locale} images={images} onChange={setImages} />
      </Section>

      <Section title={t.variants} hint={t.variantsHint}>
        <div className="space-y-4">
          {variants.map((v, i) => (
            <fieldset key={v.id ?? `new-${i}`} className="rounded-[var(--radius-lg)] border border-sand bg-cream/40 p-4 sm:p-5" data-testid="variant">
              <legend className="sr-only">{t.variants} {i + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField id={`v${i}-price`} label={t.price} value={v.price} onChange={(x) => setV(i, { price: x })} error={err(`variants.${i}.price`)} inputMode="decimal" dir="ltr" required />
                <TextField id={`v${i}-sale`} label={t.salePrice} value={v.salePrice} onChange={(x) => setV(i, { salePrice: x })} error={err(`variants.${i}.salePrice`)} inputMode="decimal" dir="ltr" />
                <TextField id={`v${i}-ml`} label={t.sizeMl} value={v.sizeMl} onChange={(x) => setV(i, { sizeMl: x })} error={err(`variants.${i}.sizeMl`)} inputMode="numeric" dir="ltr" optional={dict.common.optional} />
                <TextField id={`v${i}-lar`} label={t.sizeLabelAr} value={v.labelAr} onChange={(x) => setV(i, { labelAr: x })} optional={dict.common.optional} dir="rtl" />
                <TextField id={`v${i}-len`} label={t.sizeLabelEn} value={v.labelEn} onChange={(x) => setV(i, { labelEn: x })} optional={dict.common.optional} dir="ltr" />
                <TextField id={`v${i}-sku`} label={t.sku} value={v.sku} onChange={(x) => setV(i, { sku: x })} dir="ltr" />
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <Toggle id={`v${i}-track`} label={t.trackStock} checked={v.trackStock} onChange={(c) => setV(i, { trackStock: c })} />
                {v.trackStock ? (
                  <div className="w-40">
                    <TextField id={`v${i}-stock`} label={t.stock} value={v.stock} onChange={(x) => setV(i, { stock: x.replace(/\D/g, "") })} error={err(`variants.${i}.stock`)} inputMode="numeric" dir="ltr" />
                  </div>
                ) : null}
                {variants.length > 1 ? (
                  <button type="button" className="btn btn-ghost btn-sm ms-auto text-danger" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>
                    <IconTrash size={18} /> {t.removeVariant}
                  </button>
                ) : null}
              </div>
            </fieldset>
          ))}
          {variants.length < 10 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setVariants((vs) => [...vs, { labelAr: "", labelEn: "", sizeMl: "", sku: "", price: "", salePrice: "", trackStock: true, stock: "" }])}>
              <IconPlus /> {t.addVariant}
            </button>
          ) : null}
        </div>
      </Section>

      <Section title={t.visibility}>
        <div className="space-y-4">
          <Toggle id="p-available" label={t.available} hint={t.availableHint} checked={available} onChange={setAvailable} />
          <Toggle id="p-featured" label={t.featuredLabel} checked={featured} onChange={setFeatured} />
          {product ? <TextField id="p-slug" label={t.slug} hint={t.slugHint} value={slug} onChange={setSlug} error={err("slug")} dir="ltr" /> : null}
        </div>
      </Section>

      <div className="sticky bottom-20 z-20 flex flex-wrap gap-3 rounded-[var(--radius-lg)] border border-sand bg-ivory/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur lg:bottom-4">
        <button className="btn btn-primary btn-lg flex-1" disabled={saving} data-testid="save-product">
          {saving ? <Spinner /> : <IconCheck />} {saving ? dict.common.saving : t.save}
        </button>
        {product && product.status === "active" ? (
          <a href={`/${locale}/products/${encodeURIComponent(product.slug)}`} target="_blank" className="btn btn-secondary btn-lg"><IconEye /> {t.preview}</a>
        ) : null}
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-sand bg-white p-5 sm:p-7">
      <h2 className="text-xl">{title}</h2>
      {hint ? <p className="mt-1 text-muted">{hint}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

type TFProps = { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; required?: boolean; optional?: string; dir?: "rtl" | "ltr"; inputMode?: "decimal" | "numeric" | "text" };

export function TextField({ id, label, value, onChange, error, hint, required, optional, dir, inputMode }: TFProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}{optional ? <span className="ms-2 text-sm font-normal text-muted">({optional})</span> : null}</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} required={required} dir={dir} inputMode={inputMode} />
      {hint && !error ? <p id={`${id}-h`} className="field-hint">{hint}</p> : null}
      {error ? <p id={`${id}-e`} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

function TextArea({ id, label, value, onChange, error, dir, optional }: TFProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}{optional ? <span className="ms-2 text-sm font-normal text-muted">({optional})</span> : null}</label>
      <textarea id={id} className="input" rows={5} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} aria-invalid={!!error} />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-success" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "start-7" : "start-1"}`} />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-semibold text-charcoal">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}
