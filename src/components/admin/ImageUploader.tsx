"use client";

import { useRef, useState } from "react";
import { getDictionary } from "@/lib/i18n";
import { imageUrl } from "@/lib/media";
import type { Locale } from "@/lib/types";
import { Spinner } from "../ui/Spinner";
import { IconImage, IconTrash } from "../ui/icons";

export interface UploadedImage {
  key: string;
  width: number;
  height: number;
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (file.size > MAX_BYTES || !TYPES.includes(file.type)) throw new Error("invalid");
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: fd, credentials: "same-origin" });
  if (!res.ok) throw new Error("upload");
  return res.json();
}

export function ImageUploader({ locale, images, onChange, max = 8, single = false }: { locale: Locale; images: UploadedImage[]; onChange: (imgs: UploadedImage[]) => void; max?: number; single?: boolean }) {
  const dict = getDictionary(locale);
  const t = dict.admin.productForm;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    let next = single ? [] : [...images];
    for (const f of Array.from(files).slice(0, single ? 1 : max - images.length)) {
      try {
        next = [...next, await uploadImage(f)];
        onChange(next);
      } catch {
        setError(t.uploadFailed);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      {images.length ? (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.key} className="overflow-hidden rounded-[var(--radius-md)] border border-sand bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(img.key, 400)} alt="" className="aspect-[4/5] w-full object-cover" />
              <div className="flex flex-wrap gap-1 p-2">
                {i === 0 ? (
                  <span className="badge bg-champagne/30 text-gold">{t.mainImage}</span>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm min-h-9 px-2 text-xs" onClick={() => onChange([img, ...images.filter((x) => x.key !== img.key)])}>{t.makeMain}</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm ms-auto min-h-9 px-2 text-danger" onClick={() => onChange(images.filter((x) => x.key !== img.key))} aria-label={t.removeImage}>
                  <IconTrash size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {images.length < max || single ? (
        <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-line bg-white px-4 py-8 text-center hover:border-champagne ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? <Spinner size={28} /> : <IconImage size={32} className="text-gold" />}
          <span className="font-semibold text-charcoal">{busy ? t.uploading : t.uploadImages}</span>
          <span className="text-sm text-muted">{t.imagesHint}</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={!single} className="sr-only" onChange={(e) => pick(e.target.files)} data-testid="image-input" />
        </label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
