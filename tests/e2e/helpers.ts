import { expect, request as pwRequest, type Page, type TestInfo } from "@playwright/test";

export const BASE = "http://localhost:3100";
export const ORIGIN = { Origin: BASE };

/** Each test gets its own fake client IP so per-IP rate limits don't interfere between tests. */
let n = 0;
export function testIp(info: TestInfo) {
  n++;
  return `10.${(info.workerIndex % 200) + 1}.${Math.floor(n / 250)}.${(n % 250) + 1}`;
}

export async function asClient(page: Page, info: TestInfo) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp(info) });
}

export async function apiContext(info: TestInfo, extra: Record<string, string> = {}) {
  return pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": testIp(info), ...extra } });
}

export async function adminLogin(page: Page, username = "e2e-owner", locale: "ar" | "en" = "ar") {
  await page.goto(`/${locale}/admin/login`);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/admin$`));
}

export async function fillCheckout(page: Page, opts: { name?: string; phone?: string; area?: string; address?: string } = {}) {
  await page.locator("#co-name").fill(opts.name ?? "عميل تجريبي");
  await page.locator("#co-phone").fill(opts.phone ?? "0599 000 111");
  await page.locator("#co-areaId").selectOption(opts.area ?? "ramallah");
  await page.locator("#co-address").fill(opts.address ?? "شارع تجريبي، بناية 1، رام الله");
}

/** Adds the first in-stock demo product ("Oud Al Layl") to the cart via the UI. */
export async function addOudToCart(page: Page, locale: "ar" | "en" = "ar") {
  await page.goto(`/${locale}/products/oud-al-layl-demo`);
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-alert")).toBeVisible();
}

/** Authenticated admin API context (logs in through the real endpoint). */
export async function adminApi(info: TestInfo, username = "e2e-owner") {
  const api = await apiContext(info, ORIGIN);
  const res = await api.post("/api/admin/login", { data: { username, password: process.env.E2E_ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
  return api;
}

export async function ordersForPhone(info: TestInfo, phone: string) {
  const api = await adminApi(info);
  const res = await api.get(`/api/admin/orders?q=${encodeURIComponent(phone)}`);
  const data = (await res.json()) as { orders: { number: string }[] };
  await api.dispose();
  return data.orders;
}
