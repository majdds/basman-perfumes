import { beforeAll, describe, expect, it } from "vitest";
import { placeOrder, quoteCart, updateOrderStatus, verifyViewToken } from "@/server/services/orders";
import { adminUpdateProduct } from "@/server/services/admin-catalog";
import { getOrder, listOrders, openOrders, ordersByPhone, totalOrderCount } from "@/server/repos/orders";
import { getProduct } from "@/server/repos/products";
import { getSettings, putSettings } from "@/server/repos/settings";
import { searchOrders, runRetention, dashboardStats } from "@/server/services/admin-orders";
import { createProduct, key, orderInput, productInput, seedSettings } from "../helpers/fixtures";

beforeAll(() => seedSettings());

describe("order placement (cash on delivery)", () => {
  it("persists an order with server-calculated totals and decrements stock", async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    const before = await totalOrderCount();
    const { order, viewToken, replayed } = await placeOrder(orderInput(p.id, v.id, 2, { phone: "+970 599 111 222" }), key());
    expect(replayed).toBe(false);
    expect(order.number).toMatch(/^BS-[A-Z0-9]{6}$/);
    expect(order).toMatchObject({ status: "new", paymentMethod: "cod", subtotal: 30000, deliveryFee: 2000, total: 32000 });
    expect(order.customer.phone).toBe("+970599111222");
    expect(order.lines[0]).toMatchObject({ unitPrice: 15000, listPrice: 18000, quantity: 2 });
    const stored = await getOrder(order.number);
    expect(stored).toMatchObject({ number: order.number, total: 32000 });
    expect(verifyViewToken(stored!, viewToken)).toBe(true);
    expect(verifyViewToken(stored!, "wrong")).toBe(false);
    expect((await getProduct(p.id))!.variants[0]!.stock).toBe(3);
    expect(await totalOrderCount()).toBe(before + 1);
    expect((await openOrders()).some((o) => o.number === order.number)).toBe(true);
  });

  it("applies free delivery above the area threshold", async () => {
    const p = await createProduct({ variants: [{ label: { ar: "", en: "" }, sizeMl: null, sku: null, price: 60000, salePrice: null, trackStock: false, stock: null }] });
    const { order } = await placeOrder(orderInput(p.id, p.variants[0]!.id, 1), key());
    expect(order).toMatchObject({ subtotal: 60000, deliveryFee: 0, total: 60000 });
  });

  it("is idempotent: the same key returns the same order (no duplicates, no double stock)", async () => {
    const p = await createProduct();
    const k = key();
    const input = orderInput(p.id, p.variants[0]!.id, 1);
    const [a, b] = await Promise.all([placeOrder(input, k), placeOrder(input, k)]);
    expect(a.order.number).toBe(b.order.number);
    const c = await placeOrder(input, k);
    expect(c.replayed).toBe(true);
    expect(c.order.number).toBe(a.order.number);
    expect((await getProduct(p.id))!.variants[0]!.stock).toBe(4);
  });

  it("rejects reusing a key for a different order", async () => {
    const p = await createProduct();
    const k = key();
    await placeOrder(orderInput(p.id, p.variants[0]!.id, 1), k);
    await expect(placeOrder(orderInput(p.id, p.variants[0]!.id, 2), k)).rejects.toMatchObject({ code: "idempotency_mismatch" });
  });

  it("never oversells: concurrent orders for the last items", async () => {
    const p = await createProduct({ variants: [{ label: { ar: "", en: "" }, sizeMl: null, sku: null, price: 10000, salePrice: null, trackStock: true, stock: 2 }] });
    const v = p.variants[0]!.id;
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => placeOrder(orderInput(p.id, v, 1), key())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((await getProduct(p.id))!.variants[0]!.stock).toBe(0);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  });

  it("rejects out-of-stock, over-stock, unavailable and archived products", async () => {
    const p = await createProduct({ variants: [{ label: { ar: "", en: "" }, sizeMl: null, sku: null, price: 10000, salePrice: null, trackStock: true, stock: 1 }] });
    await expect(placeOrder(orderInput(p.id, p.variants[0]!.id, 2), key())).rejects.toMatchObject({ code: "cart_problems" });
    const off = await createProduct({ available: false });
    await expect(placeOrder(orderInput(off.id, off.variants[0]!.id, 1), key())).rejects.toMatchObject({ code: "cart_problems" });
    await expect(placeOrder(orderInput("does-not-exist", "v", 1), key())).rejects.toMatchObject({ code: "cart_problems" });
  });

  it("uses the price at order time even if the browser saw an older price", async () => {
    const p = await createProduct();
    const v = p.variants[0]!;
    await adminUpdateProduct(p.id, productInput({ name: p.name as never, variants: [{ id: v.id, label: v.label, sizeMl: 50, sku: null, price: 99000, salePrice: null, trackStock: true, stock: 5 }] }), p.version);
    const { order } = await placeOrder(orderInput(p.id, v.id, 1), key());
    expect(order.subtotal).toBe(99000);
  });

  it("rejects inactive delivery areas and paused ordering", async () => {
    const p = await createProduct();
    await expect(placeOrder(orderInput(p.id, p.variants[0]!.id, 1, { areaId: "closed" }), key())).rejects.toMatchObject({ code: "invalid_area", details: { fields: { "customer.areaId": "area_unavailable" } } });
    await expect(placeOrder(orderInput(p.id, p.variants[0]!.id, 1, { areaId: "nowhere" }), key())).rejects.toMatchObject({ details: { fields: { "customer.areaId": "invalid_area" } } });
    const s = await getSettings();
    await putSettings({ ...s, orderingEnabled: false });
    await expect(placeOrder(orderInput(p.id, p.variants[0]!.id, 1), key())).rejects.toMatchObject({ status: 503, code: "ordering_disabled" });
    await putSettings({ ...s, orderingEnabled: true });
  });

  it("quotes carts with server prices and limits", async () => {
    const p = await createProduct();
    const q = await quoteCart([{ productId: p.id, variantId: p.variants[0]!.id, quantity: 2 }], "ramallah");
    expect(q).toMatchObject({ subtotal: 30000, deliveryFee: 2000, total: 32000, problems: [] });
  });
});

describe("order status management", () => {
  it("moves through the workflow and records history", async () => {
    const p = await createProduct();
    const { order } = await placeOrder(orderInput(p.id, p.variants[0]!.id, 1), key());
    for (const s of ["confirmed", "preparing", "out_for_delivery", "delivered"] as const) {
      const u = await updateOrderStatus(order.number, s, "owner", s === "confirmed" ? "called customer" : null);
      expect(u.status).toBe(s);
    }
    const final = await getOrder(order.number);
    expect(final!.history.map((h) => h.status)).toEqual(["new", "confirmed", "preparing", "out_for_delivery", "delivered"]);
    expect(final!.history[1]).toMatchObject({ by: "owner", note: "called customer" });
    expect((await openOrders()).some((o) => o.number === order.number)).toBe(false);
    await expect(updateOrderStatus(order.number, "cancelled", "owner", null)).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("returns stock to inventory when an order is cancelled", async () => {
    const p = await createProduct();
    const { order } = await placeOrder(orderInput(p.id, p.variants[0]!.id, 3), key());
    expect((await getProduct(p.id))!.variants[0]!.stock).toBe(2);
    await updateOrderStatus(order.number, "cancelled", "owner", null);
    expect((await getProduct(p.id))!.variants[0]!.stock).toBe(5);
  });

  it("returns 404 for unknown orders", async () => {
    await expect(updateOrderStatus("BS-ZZZZZZ", "confirmed", "owner", null)).rejects.toMatchObject({ status: 404 });
  });

  it("filters, searches by number/phone and pages", async () => {
    const p = await createProduct({ variants: [{ label: { ar: "", en: "" }, sizeMl: null, sku: null, price: 1000, salePrice: null, trackStock: false, stock: null }] });
    const { order } = await placeOrder(orderInput(p.id, p.variants[0]!.id, 1, { phone: "0569 777 888" }), key());
    expect((await searchOrders(order.number.toLowerCase().replace("bs-", "")))[0]!.number).toBe(order.number);
    expect((await searchOrders("+970569777888")).map((o) => o.number)).toContain(order.number);
    expect((await ordersByPhone("0569777888")).length).toBeGreaterThanOrEqual(1);
    const newOnly = await listOrders({ status: "new", limit: 100 });
    expect(newOnly.orders.every((o) => o.status === "new")).toBe(true);
    const page1 = await listOrders({ status: "all", limit: 2 });
    expect(page1.orders).toHaveLength(2);
    const page2 = await listOrders({ status: "all", limit: 2, cursor: page1.cursor! });
    expect(page2.orders[0]!.number).not.toBe(page1.orders[0]!.number);
    expect(page2.orders[0]!.createdAt <= page1.orders[1]!.createdAt).toBe(true);
    const stats = await dashboardStats();
    expect(stats.newCount).toBeGreaterThan(0);
  });

  it("anonymises personal data on old completed orders (retention)", async () => {
    const p = await createProduct();
    const { order } = await placeOrder(orderInput(p.id, p.variants[0]!.id, 1, { phone: "0599 444 555" }), key());
    await updateOrderStatus(order.number, "delivered", "owner", null);
    const s = await getSettings();
    await putSettings({ ...s, retentionDays: 1 });
    const n = await runRetention(new Date(Date.now() + 2 * 86_400_000));
    expect(n).toBeGreaterThanOrEqual(1);
    const anon = await getOrder(order.number);
    expect(anon).toMatchObject({ anonymized: true, customer: { name: "—", phone: "" }, delivery: { address: "—" }, total: order.total });
    expect(await ordersByPhone("0599444555")).toHaveLength(0);
    await putSettings({ ...s, retentionDays: 730 });
  });
});
