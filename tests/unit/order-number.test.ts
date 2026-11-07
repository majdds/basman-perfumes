import { describe, expect, it } from "vitest";
import { randomInt } from "node:crypto";
import { generateOrderNumber, normalizeOrderNumberInput, ORDER_NUMBER_ALPHABET, ORDER_NUMBER_PATTERN } from "@/lib/order-number";

describe("order numbers", () => {
  it("match the documented format and avoid look-alike characters", () => {
    for (let i = 0; i < 2000; i++) {
      const n = generateOrderNumber(randomInt);
      expect(n).toMatch(ORDER_NUMBER_PATTERN);
      expect(n.slice(3)).not.toMatch(/[01ILOU]/);
    }
  });
  it("are effectively unique (30^6 ≈ 729M combinations)", () => {
    const set = new Set(Array.from({ length: 20000 }, () => generateOrderNumber(randomInt)));
    expect(set.size).toBeGreaterThan(19990);
    expect(ORDER_NUMBER_ALPHABET.length ** 6).toBe(729_000_000);
  });
  it("is deterministic given the random source", () => {
    expect(generateOrderNumber(() => 0)).toBe("BS-222222");
  });
  it("normalises what an owner types in the search box", () => {
    expect(normalizeOrderNumberInput("bs-7k3m9q")).toBe("BS-7K3M9Q");
    expect(normalizeOrderNumberInput("7k3m9q")).toBe("BS-7K3M9Q");
    expect(normalizeOrderNumberInput(" BS 7K3M9Q ")).toBe("BS-7K3M9Q");
  });
});
