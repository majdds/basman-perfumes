import { expect, test } from "@playwright/test";
import { addOudToCart, apiContext, asClient, fillCheckout, ordersForPhone, ORIGIN } from "./helpers";

test.beforeEach(async ({ page }, info) => asClient(page, info));

test("empty cart shows a helpful empty state on cart and checkout", async ({ page }) => {
  await page.goto("/ar/cart");
  await expect(page.getByText("سلتك فارغة")).toBeVisible();
  await page.goto("/ar/checkout");
  await expect(page.getByText("سلتك فارغة، أضف منتجات أولاً.")).toBeVisible();
});

test("out-of-stock products cannot be added", async ({ page }) => {
  await page.goto("/ar/products/golden-amber-demo");
  await expect(page.getByTestId("availability")).toHaveText(/غير متوفر حالياً/);
  await expect(page.getByTestId("add-to-cart")).toBeDisabled();
});

test("checkout validates inputs in Arabic and keeps the customer on the form", async ({ page }) => {
  await addOudToCart(page);
  await page.goto("/ar/checkout");
  await page.getByTestId("to-review").click();
  await expect(page.getByText("يرجى تصحيح الحقول المشار إليها")).toBeVisible();
  await expect(page.locator("#co-name")).toHaveAttribute("aria-invalid", "true");
  await fillCheckout(page, { phone: "12345" });
  await page.getByTestId("to-review").click();
  await expect(page.locator("#co-phone-error")).toContainText("رقم الهاتف غير صحيح");
  await page.locator("#co-phone").fill("+970 599 000 111");
  await page.getByTestId("to-review").click();
  await expect(page.getByTestId("place-order")).toBeVisible();
});

test("double-clicking 'place order' creates exactly one order", async ({ page }, info) => {
  await addOudToCart(page);
  await page.goto("/ar/checkout");
  await fillCheckout(page, { name: "Double Click", phone: "0599 222 333" });
  await page.getByTestId("to-review").click();
  await page.getByTestId("place-order").dblclick();
  await expect(page.getByTestId("order-number")).toBeVisible();
  const orders = await ordersForPhone(info, "0599222333");
  expect(orders).toHaveLength(1);
  expect(orders[0]!.number).toBe((await page.getByTestId("order-number").textContent())!.trim());
});

test("replaying an order request with the same Idempotency-Key returns the same order", async ({ page }, info) => {
  await page.goto("/ar/products/white-musk-demo");
  await page.getByTestId("add-to-cart").click();
  const item = await page.evaluate(() => JSON.parse(localStorage.getItem("basman_cart_v1")!)[0]);
  const api = await apiContext(info, ORIGIN);
  const body = { customer: { name: "Replay", phone: "0599 222 444", areaId: "ramallah", address: "Test address 12", notes: null, email: null }, items: [item], locale: "ar" };
  const k = crypto.randomUUID();
  const r1 = await api.post("/api/orders", { data: body, headers: { "Idempotency-Key": k } });
  const r2 = await api.post("/api/orders", { data: body, headers: { "Idempotency-Key": k } });
  expect(r1.status()).toBe(201);
  expect(r2.status()).toBe(200);
  expect((await r2.json()).replayed).toBe(true);
  expect((await r1.json()).orderNumber).toBe((await r2.json()).orderNumber);
  // Same key, different content → rejected rather than silently merged.
  const r3 = await api.post("/api/orders", { data: { ...body, items: [{ ...item, quantity: 2 }] }, headers: { "Idempotency-Key": k } });
  expect(r3.status()).toBe(409);
  // No key → rejected.
  expect((await api.post("/api/orders", { data: body })).status()).toBe(400);
  await api.dispose();
  expect(await ordersForPhone(info, "0599222444")).toHaveLength(1);
});

test("a network failure while submitting is recoverable without duplicates", async ({ page }, info) => {
  await addOudToCart(page);
  await page.goto("/ar/checkout");
  await fillCheckout(page, { name: "Flaky Network", phone: "0599 333 444" });
  await page.getByTestId("to-review").click();
  let calls = 0;
  await page.route("**/api/orders", async (route) => {
    calls++;
    if (calls === 1) {
      // Let the server commit the order, then drop the response (worst case).
      await route.fetch();
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page.getByTestId("place-order").click();
  await expect(page.locator(".alert-error")).toContainText("تعذّر الاتصال");
  await page.getByTestId("place-order").click();
  await expect(page.getByTestId("order-number")).toBeVisible();
  expect(calls).toBe(2);
  // The retry replayed the order the server had already committed: still exactly one.
  expect(await ordersForPhone(info, "0599333444")).toHaveLength(1);
});

test("server errors show a friendly message", async ({ page }) => {
  await addOudToCart(page);
  await page.goto("/ar/checkout");
  await fillCheckout(page);
  await page.getByTestId("to-review").click();
  await page.route("**/api/orders", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "generic" }) }));
  await page.getByTestId("place-order").click();
  await expect(page.locator(".alert-error")).toContainText("حدث خطأ غير متوقع");
  await expect(page.getByTestId("place-order")).toBeEnabled();
});

test("stock changes between cart and checkout are explained", async ({ page }) => {
  // Cedar Wood (demo) has only 2 in stock; put 5 in the cart directly.
  await page.goto("/ar/products/cedar-wood-demo");
  await page.getByTestId("add-to-cart").click();
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem("basman_cart_v1")!);
    items[0].quantity = 5;
    localStorage.setItem("basman_cart_v1", JSON.stringify(items));
  });
  await page.goto("/ar/cart");
  await expect(page.getByText("عدّلنا بعض الكميات")).toBeVisible();
  await expect(page.getByTestId("qty-value")).toHaveText("2");
});
