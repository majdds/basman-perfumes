import { normalizeSearchText } from "./search";

/**
 * URL slug built from the English name when available (best for sharing),
 * falling back to Arabic letters, which browsers and WhatsApp handle fine.
 */
export function slugify(nameEn: string | undefined, nameAr: string): string {
  const base = normalizeSearchText(nameEn?.trim() ? nameEn : nameAr)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70)
    .replace(/^-|-$/g, "");
  return base || "product";
}

// Linear-time in practice: segments are separated by a mandatory "-", so there is no
// ambiguous backtracking, and inputs are capped at 80 characters by the schema.
// eslint-disable-next-line security/detect-unsafe-regex
export const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
