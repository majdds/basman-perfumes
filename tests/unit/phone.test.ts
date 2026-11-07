import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, parsePalestinianPhone, phoneSearchKey, toLatinDigits, whatsappLink } from "@/lib/phone";

describe("Palestinian phone numbers", () => {
  it.each([
    ["0599123456", "+970599123456", "mobile"],
    ["0599 123 456", "+970599123456", "mobile"],
    ["059-912-3456", "+970599123456", "mobile"],
    ["0569398080", "+970569398080", "mobile"],
    ["+970 599 123 456", "+970599123456", "mobile"],
    ["00970599123456", "+970599123456", "mobile"],
    ["970599123456", "+970599123456", "mobile"],
    ["+970 0599 123 456", "+970599123456", "mobile"],
    ["599123456", "+970599123456", "mobile"],
    ["٠٥٩٩١٢٣٤٥٦", "+970599123456", "mobile"],
    ["0521234567", "+972521234567", "mobile"],
    ["+972 54 123 4567", "+972541234567", "mobile"],
    ["022951234", "+97022951234", "landline"],
    ["02 295 1234", "+97022951234", "landline"],
    ["092381234", "+97092381234", "landline"],
    ["+972 2 627 1234", "+97226271234", "landline"],
  ])("accepts %s", (input, e164, kind) => {
    const p = parsePalestinianPhone(input);
    expect(p).not.toBeNull();
    expect(p!.e164).toBe(e164);
    expect(p!.kind).toBe(kind);
  });

  it.each([
    "", "123", "05991234", "05991234567", "0579123456", "0312345678", "+972 599 123 456", "+44 7700 900123", "abc0599123456", "0599123456; DROP", "1".repeat(40),
  ])("rejects %s", (input) => {
    expect(parsePalestinianPhone(input)).toBeNull();
  });

  it("produces a stable search key regardless of formatting", () => {
    expect(phoneSearchKey("+970 599 123 456")).toBe("0599123456");
    expect(phoneSearchKey("0599-123-456")).toBe("0599123456");
  });

  it("builds WhatsApp and display formats", () => {
    expect(whatsappLink("+970569398080", "مرحبا")).toBe("https://wa.me/970569398080?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7");
    expect(formatPhoneForDisplay("0569398080")).toBe("0569 398 080");
    expect(formatPhoneForDisplay("022951234")).toBe("02 295 1234");
    expect(toLatinDigits("۰۵۹۹")).toBe("0599");
  });
});
