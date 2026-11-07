import { expect, test } from "@playwright/test";
import { adminLogin, asClient } from "./helpers";

test.beforeEach(async ({ page }, info) => asClient(page, info));

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  // Checks both directions: in RTL, overflow extends to the left (negative scrollLeft).
  const { overflow, leftmost } = await page.evaluate(() => {
    const doc = document.documentElement;
    let leftmost = 0;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).position === "fixed") continue;
      // Content inside an intentional horizontal scroller (e.g. tab strips) or a closed <details> is clipped, not page overflow.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX) || (p.tagName === "DETAILS" && !(p as HTMLDetailsElement).open)) clipped = true;
      }
      if (!clipped) leftmost = Math.min(leftmost, r.left);
    }
    return { overflow: doc.scrollWidth - doc.clientWidth, leftmost };
  });
  expect(overflow).toBeLessThanOrEqual(1);
  expect(leftmost).toBeGreaterThanOrEqual(-1);
}

test("key storefront pages fit a phone screen in RTL and LTR", async ({ page }) => {
  for (const path of ["/ar", "/ar/shop", "/ar/products/oud-al-layl-demo", "/ar/cart", "/ar/checkout", "/ar/contact", "/en", "/en/shop"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await noHorizontalOverflow(page);
  }
  // The filter sheet must open fully on screen in both directions.
  for (const path of ["/ar/shop", "/en/shop"]) {
    await page.goto(path);
    await page.locator("summary").filter({ hasText: /تصفية|Filters/ }).click();
    await noHorizontalOverflow(page);
  }
});

test("RTL layout: logo on the right, cart on the left in Arabic; mirrored in English", async ({ page }) => {
  await page.goto("/ar");
  const width = page.viewportSize()!.width;
  const logo = (await page.getByRole("link", { name: /بسمان للعطور — الصفحة الرئيسية/ }).boundingBox())!;
  const cart = (await page.getByTestId("cart-button").boundingBox())!;
  expect(logo.x).toBeGreaterThan(width / 2);
  expect(cart.x).toBeLessThan(width / 2);
  await page.goto("/en");
  const logoEn = (await page.getByRole("link", { name: /Basman Perfumes — home/ }).boundingBox())!;
  expect(logoEn.x).toBeLessThan(width / 2);
});

test("mobile menu opens, searches and navigates", async ({ page }) => {
  await page.goto("/ar");
  await page.getByRole("button", { name: "القائمة" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#m-search").fill("مسك");
  await dialog.locator("#m-search").press("Enter");
  await expect(page).toHaveURL(/\/ar\/shop\?q=/);
  await expect(page.getByTestId("product-card")).toHaveCount(1);
});

test("mobile purchase flow reaches the review step", async ({ page }) => {
  await page.goto("/ar/products/sea-breeze-demo");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/ar/checkout");
  await page.locator("#co-name").fill("عميل جوال");
  await page.locator("#co-phone").fill("0569000111");
  await page.locator("#co-areaId").selectOption("westbank");
  await page.locator("#co-address").fill("نابلس، شارع تجريبي");
  await page.getByTestId("to-review").click();
  await expect(page.getByTestId("place-order")).toBeVisible();
  await noHorizontalOverflow(page);
});

test("admin dashboard is usable on a phone (bottom navigation)", async ({ page }) => {
  await adminLogin(page);
  await noHorizontalOverflow(page);
  const bottomNav = page.locator("nav[aria-label=admin]").last();
  await expect(bottomNav).toBeVisible();
  await bottomNav.getByRole("link", { name: "الطلبات" }).click();
  await expect(page).toHaveURL(/\/ar\/admin\/orders/);
  await noHorizontalOverflow(page);
});
