import { describe, expect, it } from "vitest";
import ar from "@/lib/i18n/ar";
import en from "@/lib/i18n/en";
import { dir, errorMessage, getDictionary, pick } from "@/lib/i18n";
import { formatDate, formatDateTime, startOfStoreDayUtc, storeDateKey } from "@/lib/dates";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("dictionaries", () => {
  it("have identical keys in Arabic and English", () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });
  it("have no empty strings", () => {
    const walk = (o: unknown): void => {
      if (typeof o === "string") expect(o.trim().length).toBeGreaterThan(0);
      else if (o && typeof o === "object") Object.values(o).forEach(walk);
    };
    walk(ar);
    walk(en);
  });
  it("translate all order statuses", () => {
    expect(ar.status.out_for_delivery).toBe("خرج للتوصيل");
    expect(en.status.cancelled).toBe("Cancelled");
  });
  it("resolve validation keys and fall back safely", () => {
    expect(errorMessage(getDictionary("ar"), "invalidPhone")).toContain("رقم الهاتف");
    expect(errorMessage(getDictionary("en"), "nonexistent")).toBe(en.errors.invalid);
  });
  it("pick the requested language with fallback", () => {
    expect(pick({ ar: "عطر", en: "" }, "en")).toBe("عطر");
    expect(pick({ ar: "عطر", en: "Scent" }, "en")).toBe("Scent");
    expect(dir("ar")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });
});

describe("Palestine time zone", () => {
  it("formats dates in Asia/Hebron with Western digits", () => {
    // 2026-07-01T21:30Z is 00:30 on 2 July in Palestine (UTC+3 summer time).
    expect(storeDateKey(new Date("2026-07-01T21:30:00Z"))).toBe("2026-07-02");
    expect(formatDate("2026-07-01T21:30:00Z", "en")).toBe("2 July 2026");
    expect(formatDateTime("2026-07-01T21:30:00Z", "ar")).toMatch(/2026/);
    expect(formatDateTime("2026-07-01T21:30:00Z", "ar")).not.toMatch(/[٠-٩]/);
  });
  it("computes the UTC start of a store day across DST", () => {
    expect(startOfStoreDayUtc("2026-07-02").toISOString()).toBe("2026-07-01T21:00:00.000Z"); // summer, UTC+3
    expect(startOfStoreDayUtc("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z"); // winter, UTC+2
  });
});
