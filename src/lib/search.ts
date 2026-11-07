/**
 * Normalises Arabic and English text so that searches are forgiving:
 *  - removes tashkeel (diacritics) and tatweel
 *  - unifies alef forms (أ إ آ ٱ → ا), ta marbuta (ة → ه), alef maqsura (ى → ي),
 *    hamza on waw/ya (ؤ → و, ئ → ي)
 *  - lower-cases Latin text and strips accents (Chloé → chloe)
 *  - converts Arabic-Indic digits
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin combining accents
    .replace(/[ً-ٰٟۖ-ۭ]/g, "") // Arabic diacritics
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when every word of the query appears (as a prefix of a word) in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const h = normalizeSearchText(haystack);
  const words = h.split(" ");
  // Also match with the Arabic definite article removed ("العود" ↔ "عود").
  const stripped = words.map((w) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w));
  return q.split(" ").every((term) => {
    const t = term.startsWith("ال") && term.length > 3 ? term.slice(2) : term;
    return words.some((w) => w.startsWith(term)) || stripped.some((w) => w.startsWith(t)) || h.includes(term);
  });
}
