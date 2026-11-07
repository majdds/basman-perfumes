import { expect, test } from "@playwright/test";
import { addOudToCart, adminLogin, apiContext, asClient, ORIGIN } from "./helpers";

test("changing the password requires typing the new one twice", async ({ page }, info) => {
  await asClient(page, info);
  await adminLogin(page);
  await page.goto("/ar/admin/settings");
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/admin/password")) calls++;
  });
  await page.locator("#pw-c").fill("anything-at-all");
  await page.locator("#pw-n").fill("a-new-long-passphrase");
  await expect(page.getByTestId("change-password")).toBeDisabled();
  await page.locator("#pw-r").fill("a-new-long-passphrase-typo");
  await page.getByTestId("change-password").click();
  await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();
  expect(calls).toBe(0);
  // Matching passwords reach the server (which then rejects the wrong current password).
  await page.locator("#pw-r").fill("a-new-long-passphrase");
  await page.getByTestId("change-password").click();
  await expect(page.getByText("كلمة المرور الحالية غير صحيحة")).toBeVisible();
  expect(calls).toBe(1);
});

test("a delivery area that is turned off shows a note and cannot be ordered to", async ({ page, browser }, info) => {
  await asClient(page, info);
  const admin = await browser.newContext();
  const ap = await admin.newPage();
  await adminLogin(ap);
  await ap.goto("/ar/admin/settings");
  const toggle = ap.locator("#a3act"); // 4th area: "1948 areas"
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await ap.getByTestId("save-settings").click();
  await expect(ap.getByText("تم حفظ الإعدادات")).toBeVisible();

  try {
    await addOudToCart(page);
    await page.goto("/ar/checkout");
    await page.locator("#co-name").fill("عميل تجريبي");
    await page.locator("#co-phone").fill("0599 000 222");
    await page.locator("#co-address").fill("شارع تجريبي، بناية 1");
    await page.locator("#co-areaId").selectOption("inside48");
    await expect(page.getByTestId("area-closed-note")).toContainText("التوصيل إلى هذه المنطقة متوقف مؤقتاً");
    await expect(page.getByTestId("delivery-fee")).not.toContainText("₪");
    await page.getByTestId("to-review").click();
    await expect(page.getByTestId("place-order")).toHaveCount(0);

    // Choosing an open area removes the note and checkout continues.
    await page.locator("#co-areaId").selectOption("ramallah");
    await expect(page.getByTestId("area-closed-note")).toHaveCount(0);
    await page.getByTestId("to-review").click();
    await expect(page.getByTestId("place-order")).toBeVisible();

    // The server refuses it too, whatever the browser sends.
    const item = await page.evaluate(() => JSON.parse(localStorage.getItem("basman_cart_v1")!)[0]);
    const api = await apiContext(info, ORIGIN);
    const res = await api.post("/api/orders", {
      data: { customer: { name: "Closed Area", phone: "0599 000 333", areaId: "inside48", address: "Test address 12", notes: null, email: null }, items: [item], locale: "ar" },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).details.fields["customer.areaId"]).toBe("area_unavailable");
    await api.dispose();
  } finally {
    await toggle.click();
    await ap.getByTestId("save-settings").click();
    await expect(ap.getByText("تم حفظ الإعدادات").first()).toBeVisible();
    await admin.close();
  }
});
