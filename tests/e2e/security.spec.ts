import { expect, test } from "@playwright/test";
import { adminApi, apiContext, BASE, ORIGIN } from "./helpers";

test.describe("unauthorised administrative access", () => {
  test("admin pages redirect to login without a session", async ({ page }) => {
    for (const path of ["/ar/admin", "/ar/admin/orders", "/en/admin/products/new", "/ar/admin/settings", "/ar/admin/print/BS-222222"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
  });

  test("admin APIs return 401 without a session (and 401 with a forged cookie)", async ({}, info) => {
    const api = await apiContext(info, ORIGIN);
    const calls: [string, string, unknown?][] = [
      ["GET", "/api/admin/orders"],
      ["GET", "/api/admin/orders/summary"],
      ["GET", "/api/admin/orders/export"],
      ["GET", "/api/admin/orders/BS-222222"],
      ["PATCH", "/api/admin/orders/BS-222222", { status: "delivered" }],
      ["POST", "/api/admin/products", {}],
      ["PUT", "/api/admin/settings", {}],
      ["POST", "/api/admin/demo/remove", {}],
      ["POST", "/api/admin/uploads", {}],
    ];
    for (const [method, url, data] of calls) {
      const res = await api.fetch(url, { method, data });
      expect(res.status(), `${method} ${url}`).toBe(401);
    }
    const forged = await apiContext(info, { ...ORIGIN, Cookie: "basman_admin=forged-session-token-value" });
    expect((await forged.get("/api/admin/orders")).status()).toBe(401);
    await api.dispose();
    await forged.dispose();
  });

  test("cross-site requests are rejected (CSRF)", async ({}, info) => {
    const api = await adminApi(info);
    const evil = await apiContext(info, { Origin: "https://evil.example" });
    // Reuse the authenticated cookies from the real session but from a foreign origin.
    const state = await api.storageState();
    await evil.dispose();
    const ctx = await (await import("@playwright/test")).request.newContext({ baseURL: BASE, storageState: state, extraHTTPHeaders: { Origin: "https://evil.example" } });
    expect((await ctx.post("/api/admin/demo/remove", { data: {} })).status()).toBe(403);
    expect((await ctx.post("/api/orders", { data: {}, headers: { "Idempotency-Key": crypto.randomUUID() } })).status()).toBe(403);
    // A request with no Origin and no Fetch Metadata (e.g. a script) is rejected too.
    const bare = await (await import("@playwright/test")).request.newContext({ baseURL: BASE, storageState: state });
    expect((await bare.post("/api/admin/demo/remove", { data: {} })).status()).toBe(403);
    await ctx.dispose();
    await bare.dispose();
    await api.dispose();
  });

  test("staff accounts cannot perform owner-only actions", async ({}, info) => {
    const staff = await adminApi(info, "e2e-staff");
    expect((await staff.get("/api/admin/orders/summary")).status()).toBe(200);
    expect((await staff.post("/api/admin/demo/remove", { data: {} })).status()).toBe(403);
    expect((await staff.put("/api/admin/settings", { data: {} })).status()).toBe(403);
    await staff.dispose();
  });

  test("logout invalidates the session server-side", async ({}, info) => {
    const api = await adminApi(info);
    const state = await api.storageState();
    expect((await api.post("/api/admin/logout", { data: {} })).status()).toBe(200);
    const replay = await (await import("@playwright/test")).request.newContext({ baseURL: BASE, storageState: state, extraHTTPHeaders: ORIGIN });
    expect((await replay.get("/api/admin/orders")).status()).toBe(401);
    await replay.dispose();
    await api.dispose();
  });

  test("session cookie is HttpOnly and SameSite=Strict", async ({}, info) => {
    const api = await adminApi(info);
    const cookie = (await api.storageState()).cookies.find((c) => c.name.includes("basman_admin"))!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Strict");
    await api.dispose();
  });
});

test.describe("malformed uploads", () => {
  test("rejects non-images, fake extensions and wrong content types", async ({}, info) => {
    const api = await adminApi(info);
    const up = (name: string, mimeType: string, buffer: Buffer) => api.post("/api/admin/uploads", { multipart: { file: { name, mimeType, buffer } } });
    expect((await up("evil.svg", "image/svg+xml", Buffer.from("<svg onload=alert(1)>"))).status()).toBe(415);
    expect((await up("shell.php.jpg", "image/jpeg", Buffer.from("<?php echo 1; ?>"))).status()).toBe(415);
    expect((await up("broken.jpg", "image/jpeg", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 7)]))).status()).toBe(422);
    expect((await api.post("/api/admin/uploads", { data: { file: "x" } })).status()).toBe(415);
    expect((await api.post("/api/admin/uploads", { multipart: { other: "x" } })).status()).toBe(400);
    await api.dispose();
  });
});

test.describe("API abuse", () => {
  test("order endpoint is rate limited per client", async ({}, info) => {
    const api = await apiContext(info, ORIGIN);
    const body = { customer: { name: "Rate Limit", phone: "0599 555 666", areaId: "ramallah", address: "Somewhere 1", notes: null, email: null }, items: [{ productId: "nope", variantId: "nope", quantity: 1 }], locale: "ar" };
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await api.post("/api/orders", { data: body, headers: { "Idempotency-Key": crypto.randomUUID() } })).status());
    expect(statuses.slice(0, 5).every((s) => s === 409)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
    await api.dispose();
  });

  test("client-supplied prices and extra fields are refused", async ({}, info) => {
    const api = await apiContext(info, ORIGIN);
    const base = { customer: { name: "Tamper", phone: "0599 555 777", areaId: "ramallah", address: "Somewhere 1", notes: null, email: null }, locale: "ar" };
    const r = await api.post("/api/orders", { data: { ...base, items: [{ productId: "a", variantId: "b", quantity: 1, price: 1 }], total: 1 }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    expect(r.status()).toBe(422);
    const big = await api.post("/api/orders", { data: { ...base, items: [], padding: "x".repeat(40_000) }, headers: { "Idempotency-Key": crypto.randomUUID() } });
    expect(big.status()).toBe(413);
    const notJson = await api.post("/api/orders", { data: "a=b", headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": crypto.randomUUID() } });
    expect(notJson.status()).toBe(415);
    await api.dispose();
  });

  test("login is protected against brute force", async ({}, info) => {
    const api = await apiContext(info, ORIGIN);
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await api.post("/api/admin/login", { data: { username: "e2e-staff-typo", password: `guess-${i}` } })).status());
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429]);
    await api.dispose();
  });

  test("path traversal on media is not possible", async ({ request }) => {
    for (const p of ["/media/..%2F..%2Fpackage.json", "/media/products/..%2F..%2F.env.local", "/media/products/x.webp", "/media/%2e%2e/%2e%2e/etc/passwd"]) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(404);
      expect(await res.text()).not.toContain("DYNAMODB");
    }
  });
});

test.describe("HTTP security headers", () => {
  test("pages send CSP with a nonce and anti-clickjacking headers", async ({ request }) => {
    const res = await request.get("/ar");
    const h = res.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    const html = await res.text();
    expect(html).not.toMatch(/AKIA[0-9A-Z]{16}/); // no AWS keys in pages
  });

  test("admin responses are not cacheable or indexable", async ({ request }) => {
    const res = await request.get("/ar/admin/login");
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("API errors never leak stack traces", async ({}, info) => {
    const api = await apiContext(info, ORIGIN);
    const res = await api.post("/api/cart/quote", { data: Buffer.from("{bad json"), headers: { "Content-Type": "application/json" } });
    expect(res.status()).toBe(400);
    expect(await res.text()).not.toMatch(/at .*\.(ts|js):\d+/);
    await api.dispose();
  });
});
