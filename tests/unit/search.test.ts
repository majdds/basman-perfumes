import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeSearchText } from "@/lib/search";

describe("Arabic/English search normalisation", () => {
  it("unifies alef, ta marbuta, ya and removes diacritics/tatweel", () => {
    expect(normalizeSearchText("أُمْسِيَة")).toBe(normalizeSearchText("امسيه"));
    expect(normalizeSearchText("إحساس")).toBe("احساس");
    expect(normalizeSearchText("عـــود")).toBe("عود");
    expect(normalizeSearchText("ليلى")).toBe("ليلي");
  });
  it("lower-cases and strips Latin accents", () => {
    expect(normalizeSearchText("Chloé EAU de PARFUM")).toBe("chloe eau de parfum");
  });
  it("matches with or without the Arabic definite article", () => {
    expect(matchesQuery("عود الليل", "العود")).toBe(true);
    expect(matchesQuery("العود الملكي", "عود")).toBe(true);
  });
  it("requires every word and matches prefixes", () => {
    expect(matchesQuery("Oud Al Layl DEMO شرقي", "oud lay")).toBe(true);
    expect(matchesQuery("Oud Al Layl", "oud rose")).toBe(false);
    expect(matchesQuery("مسك أبيض", "ابيض")).toBe(true);
  });
  it("treats an empty query as match-all and ignores punctuation", () => {
    expect(matchesQuery("anything", "  ")).toBe(true);
    expect(matchesQuery("Jimmy Choo", "jimmy-choo!")).toBe(true);
  });
});
