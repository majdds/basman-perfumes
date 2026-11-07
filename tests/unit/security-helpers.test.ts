import { describe, expect, it } from "vitest";
import { csvCell } from "@/server/services/admin-orders";
import { sniffImageType } from "@/server/services/images";
import { decodeCursor, encodeCursor } from "@/server/repos/orders";
import { OBJECT_KEY } from "@/server/storage";

describe("CSV export safety", () => {
  it.each(["=HYPERLINK(\"http://x\")", "+1+1", "-2", "@SUM(A1)", "\tcmd"])("neutralises formula %s", (v) => {
    expect(csvCell(v).startsWith("\"'")).toBe(true);
  });
  it("quotes and escapes", () => expect(csvCell('a "b", c')).toBe('"a ""b"", c"'));
});

describe("file type sniffing uses content, not names", () => {
  it("recognises real signatures", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpeg");
    expect(sniffImageType(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("png");
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))).toBe("webp");
  });
  it("rejects everything else", () => {
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("storage keys block path traversal", () => {
  it.each(["products/../../etc/passwd", "../x-400.webp", "products/abc-400.webp", "products/3f2c0e9a-1111-4222-8333-944455556666-400.webp/../x", "other/3f2c0e9a-1111-4222-8333-944455556666-400.webp"])("rejects %s", (k) => {
    expect(OBJECT_KEY.test(k)).toBe(false);
  });
  it("accepts generated keys", () => expect(OBJECT_KEY.test("products/3f2c0e9a-1111-4222-8333-944455556666-800.webp")).toBe(true));
});

describe("pagination cursors", () => {
  it("round-trip and reject tampering", () => {
    const c = encodeCursor({ PK: "ORDER#BS-222222", SK: "META", GSI1PK: "ORDERS", GSI1SK: "2026" })!;
    expect(decodeCursor(c)).toEqual({ PK: "ORDER#BS-222222", SK: "META", GSI1PK: "ORDERS", GSI1SK: "2026" });
    expect(decodeCursor(Buffer.from(JSON.stringify({ PK: { S: "x" } })).toString("base64url"))).toBeUndefined();
    expect(decodeCursor(Buffer.from(JSON.stringify({ Evil: "x" })).toString("base64url"))).toBeUndefined();
    expect(decodeCursor("not-base64-json")).toBeUndefined();
  });
});
