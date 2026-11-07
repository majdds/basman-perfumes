import { describe, expect, it } from "vitest";
import { agorotToShekels, formatPrice, isValidAgorot, shekelsToAgorot } from "@/lib/money";

describe("money", () => {
  it("converts shekels to integer agorot without float drift", () => {
    expect(shekelsToAgorot(19.99)).toBe(1999);
    expect(shekelsToAgorot(0.1 + 0.2)).toBe(30);
    expect(shekelsToAgorot(250)).toBe(25000);
    expect(agorotToShekels(1999)).toBe(19.99);
  });
  it("rejects non-finite amounts", () => {
    expect(() => shekelsToAgorot(Number.NaN)).toThrow();
    expect(() => shekelsToAgorot(Infinity)).toThrow();
  });
  it("validates agorot values", () => {
    expect(isValidAgorot(100)).toBe(true);
    expect(isValidAgorot(-1)).toBe(false);
    expect(isValidAgorot(1.5)).toBe(false);
    expect(isValidAgorot("100")).toBe(false);
  });
  it("formats ILS per locale with Western digits", () => {
    expect(formatPrice(25000, "ar")).toBe("250 ₪");
    expect(formatPrice(25000, "en")).toBe("₪250");
    expect(formatPrice(9950, "en")).toBe("₪99.50");
    expect(formatPrice(123456700, "en")).toBe("₪1,234,567");
    expect(formatPrice(0, "ar")).toBe("0 ₪");
  });
});
