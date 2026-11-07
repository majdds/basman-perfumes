import { expect, test } from "@playwright/test";
import { adminLogin, asClient, fillCheckout } from "./helpers";

/**
 * The complete customer + owner journey required by the brief (16 steps).
 */
test("customer orders with cash on delivery, owner confirms and delivers", async ({ page, browser }, info) => {
  await asClient(page, info);

  // 1. Open the homepage (Arabic, RTL by default)
  await page.goto("/");
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("عطرٌ يليق بك");

  // 2. Change language → English (LTR), choice persists across navigation
  await page.getByTestId("lang-switch").click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);

  // 3. Browse products
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/en\/shop/);
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  expect(await page.getByTestId("product-card").count()).toBeGreaterThanOrEqual(6);

  // 4. Search (Arabic query works on the English site too)
  await page.getByTestId("shop-search").fill("ياسمين");
  await page.getByTestId("shop-search").press("Enter");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.getByTestId("shop-search").fill("oud");
  await page.getByTestId("shop-search").press("Enter");
  await expect(page.getByTestId("product-card")).toHaveCount(1);

  // 5. Open product details
  await page.getByTestId("product-card").first().getByRole("link").click();
  await expect(page.getByTestId("product-title")).toHaveText("Oud Al Layl (Demo)");
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();

  // 6. Add to cart (choose the 100 ml size)
  await page.getByText("100 ml", { exact: true }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-alert")).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("1");

  // 7. Change quantity in the cart
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(page.getByTestId("subtotal")).toHaveText("₪290");
  await page.getByTestId("qty-increase").click();
  await expect(page.getByTestId("qty-value")).toHaveText("2");
  await expect(page.getByTestId("subtotal")).toHaveText("₪580");
  // cart survives a refresh
  await page.reload();
  await expect(page.getByTestId("subtotal")).toHaveText("₪580");

  // 8. Proceed to checkout
  await page.getByTestId("go-checkout").click();
  await expect(page).toHaveURL(/\/en\/checkout/);

  // 9. Enter customer details (delivery fee appears once the area is chosen)
  await fillCheckout(page, { name: "E2E Customer", phone: "0599 123 456" });
  await expect(page.getByTestId("delivery-fee")).toHaveText("₪20");
  await expect(page.getByTestId("total")).toHaveText("₪600");
  await page.getByTestId("to-review").click();

  // 10. Review then submit the COD order
  await expect(page.getByText("Review your order before sending")).toBeVisible();
  await expect(page.getByText("Cash on delivery").first()).toBeVisible();
  await page.getByTestId("place-order").click();

  // 11. Confirmation with order number and WhatsApp contact
  await expect(page.getByTestId("confirmation-title")).toBeVisible();
  const orderNumber = (await page.getByTestId("order-number").textContent())!.trim();
  expect(orderNumber).toMatch(/^BS-[A-Z0-9]{6}$/);
  await expect(page.getByRole("link", { name: "Contact us on WhatsApp" })).toHaveAttribute("href", /wa\.me\/970569398080\?text=/);
  await expect(page.getByTestId("cart-count")).toBeHidden(); // cart cleared

  // The confirmation page is private: another browser cannot see it.
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  await sp.goto(`/en/order/${orderNumber}`);
  await expect(sp.getByText("This order cannot be shown")).toBeVisible();
  await expect(sp.getByText("E2E Customer")).toHaveCount(0);
  await stranger.close();

  // 12. Owner logs in (Arabic dashboard)
  const admin = await browser.newContext();
  const ap = await admin.newPage();
  await adminLogin(ap);
  await expect(ap.getByTestId("stat-new")).toBeVisible();

  // 13. Locate the new order by searching its number
  await ap.goto("/ar/admin/orders");
  await ap.getByTestId("order-search").fill(orderNumber);
  await ap.getByTestId("order-search").press("Enter");
  await expect(ap.getByTestId("order-row")).toHaveCount(1);
  await ap.getByTestId("order-row").click();
  await expect(ap.getByTestId("order-title")).toHaveText(orderNumber);
  await expect(ap.getByText("E2E Customer")).toBeVisible();
  await expect(ap.getByTestId("order-total")).toHaveText("600 ₪");

  // 14. Confirm the order
  await expect(ap.getByTestId("advance-status")).toHaveAttribute("data-next", "confirmed");
  await ap.getByTestId("advance-status").click();
  await expect(ap.locator('[data-status="confirmed"]').first()).toBeVisible();

  // 15. Move it through preparing → out for delivery → delivered
  for (const next of ["preparing", "out_for_delivery"]) {
    await expect(ap.getByTestId("advance-status")).toHaveAttribute("data-next", next);
    await ap.getByTestId("advance-status").click();
    await expect(ap.locator(`[data-status="${next}"]`).first()).toBeVisible();
  }
  await ap.getByTestId("advance-status").click();
  await ap.getByTestId("confirm-yes").click(); // "was it delivered and paid?"

  // 16. Verify the updated order (status, history, and it is now final)
  await expect(ap.locator('[data-status="delivered"]').first()).toBeVisible();
  await expect(ap.getByTestId("advance-status")).toHaveCount(0);
  await ap.reload();
  await expect(ap.locator('[data-status="delivered"]').first()).toBeVisible();
  await ap.goto(`/ar/admin/orders?status=delivered&q=${orderNumber}`);
  await expect(ap.getByTestId("order-row")).toHaveCount(1);

  // Printable receipt and CSV export work
  const print = await ap.request.get(`/ar/admin/print/${orderNumber}`);
  expect(print.status()).toBe(200);
  const csv = await ap.request.get("/api/admin/orders/export?status=all&locale=en");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(orderNumber);
  await admin.close();
});
