import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { BatchGetCommand, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys, stripKeys } from "../db/schema";
import { HttpError } from "../http";
import { log } from "../log";
import { cancellationCodes, getProduct } from "../repos/products";
import { getOrder, orderItem } from "../repos/orders";
import { getSettings } from "../repos/settings";
import { invalidateCatalog } from "./catalog";
import { notifyNewOrder } from "./notify";
import { generateOrderNumber } from "@/lib/order-number";
import { priceCart, type RequestedItem } from "@/lib/order-pricing";
import { canTransition, isTerminal, type OrderStatus } from "@/lib/order-status";
import { parsePalestinianPhone } from "@/lib/phone";
import type { PlaceOrderInput } from "@/lib/validation";
import type { Order, Product } from "@/lib/types";

const IDEMPOTENCY_TTL_S = 24 * 60 * 60;
type TxItems = NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]>;

export async function loadProducts(ids: string[]): Promise<Map<string, Product>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, Product>();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    let request: Record<string, { Keys: Record<string, unknown>[]; ConsistentRead: boolean }> | undefined = {
      [tableName()]: { Keys: chunk.map((id) => keys.product(id)), ConsistentRead: true },
    };
    let attempts = 0;
    while (request && Object.keys(request).length && attempts++ < 5) {
      const res = await db().send(new BatchGetCommand({ RequestItems: request }));
      for (const item of res.Responses?.[tableName()] ?? []) {
        const p = stripKeys<Product>(item)!;
        map.set(p.id, p);
      }
      request = res.UnprocessedKeys as typeof request;
    }
  }
  return map;
}

export async function quoteCart(items: RequestedItem[], areaId: string | null | undefined) {
  const [products, settings] = await Promise.all([loadProducts(items.map((i) => i.productId)), getSettings()]);
  const area = areaId ? (settings.deliveryAreas.find((a) => a.id === areaId && a.active) ?? null) : null;
  return { ...priceCart(items, products, area), lowStockThreshold: settings.lowStockThreshold, products };
}

function fingerprint(input: PlaceOrderInput): string {
  return createHash("sha256").update(JSON.stringify({ c: input.customer, i: input.items })).digest("hex");
}

export interface PlaceOrderResult {
  order: Order;
  viewToken: string;
  replayed: boolean;
}

/**
 * Places a cash-on-delivery order.
 *
 * In ONE DynamoDB transaction it:
 *   - writes the order (number must be unique),
 *   - writes the idempotency record (a retried submission returns the original order),
 *   - decrements stock for tracked variants, conditional on enough stock AND on
 *     the product version read while pricing (so a price change in between aborts),
 *   - increments the total-orders counter.
 * Either everything happens or nothing does.
 */
export async function placeOrder(input: PlaceOrderInput, idempotencyKey: string): Promise<PlaceOrderResult> {
  const fp = fingerprint(input);
  const existing = await readIdempotency(idempotencyKey);
  if (existing) return replay(existing, fp);

  const settings = await getSettings();
  if (!settings.orderingEnabled) throw new HttpError(503, "ordering_disabled");
  const area = settings.deliveryAreas.find((a) => a.id === input.customer.areaId);
  if (!area?.active) {
    throw new HttpError(422, "invalid_area", { fields: { "customer.areaId": area ? "area_unavailable" : "invalid_area" } });
  }
  const phone = parsePalestinianPhone(input.customer.phone);
  if (!phone) throw new HttpError(422, "validation", { fields: { "customer.phone": "invalidPhone" } });

  for (let attempt = 0; attempt < 4; attempt++) {
    const products = await loadProducts(input.items.map((i) => i.productId));
    const priced = priceCart(input.items, products, area);
    if (priced.problems.length) throw new HttpError(409, "cart_problems", { problems: priced.problems });

    const now = new Date().toISOString();
    const viewToken = randomBytes(24).toString("base64url");
    const order: Order = {
      number: generateOrderNumber((max) => randomInt(max)),
      status: "new",
      locale: input.locale,
      customer: { name: input.customer.name, phone: phone.e164, phoneNational: phone.national, email: input.customer.email },
      delivery: { areaId: area.id, areaName: area.name, address: input.customer.address, notes: input.customer.notes },
      lines: priced.lines,
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      paymentMethod: "cod",
      createdAt: now,
      updatedAt: now,
      history: [{ status: "new", at: now, by: "customer" }],
      viewTokenHash: createHash("sha256").update(viewToken).digest("hex"),
      anonymized: false,
      seenByAdmin: false,
    };

    const tx: TxItems = [
      { Put: { TableName: tableName(), Item: orderItem(order), ConditionExpression: "attribute_not_exists(PK)" } },
      {
        Put: {
          TableName: tableName(),
          Item: {
            ...keys.idempotency(idempotencyKey),
            orderNumber: order.number,
            fingerprint: fp,
            viewToken,
            ttl: Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_S,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
    ];
    // One operation per product (DynamoDB forbids two operations on one item in a transaction).
    const byProduct = new Map<string, { qty: Map<string, number> }>();
    for (const l of priced.lines) {
      const entry = byProduct.get(l.productId) ?? { qty: new Map() };
      if (l.stockTracked) entry.qty.set(l.variantId, (entry.qty.get(l.variantId) ?? 0) + l.quantity);
      byProduct.set(l.productId, entry);
    }
    for (const [productId, { qty }] of byProduct) {
      const p = products.get(productId)!;
      if (qty.size === 0) {
        tx.push({
          ConditionCheck: {
            TableName: tableName(),
            Key: keys.product(productId),
            ConditionExpression: "version = :v",
            ExpressionAttributeValues: { ":v": p.version },
          },
        });
        continue;
      }
      // Variants are stored as a list; address them by index after verifying ids.
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = { ":v": p.version, ":one": 1 };
      const sets: string[] = ["version = version + :one", "updatedAt = :now"];
      const conds: string[] = ["version = :v"];
      values[":now"] = now;
      let n = 0;
      for (const [variantId, q] of qty) {
        const idx = p.variants.findIndex((v) => v.id === variantId);
        names[`#i${n}`] = "id";
        values[`:id${n}`] = variantId;
        values[`:q${n}`] = q;
        conds.push(`variants[${idx}].#i${n} = :id${n}`, `variants[${idx}].stock >= :q${n}`);
        sets.push(`variants[${idx}].stock = variants[${idx}].stock - :q${n}`);
        n++;
      }
      tx.push({
        Update: {
          TableName: tableName(),
          Key: keys.product(productId),
          UpdateExpression: "SET " + sets.join(", "),
          ConditionExpression: conds.join(" AND "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        },
      });
    }
    tx.push({
      Update: {
        TableName: tableName(),
        Key: keys.orderStats(),
        UpdateExpression: "ADD #total :one",
        ExpressionAttributeNames: { "#total": "total" },
        ExpressionAttributeValues: { ":one": 1 },
      },
    });

    try {
      await db().send(new TransactWriteCommand({ TransactItems: tx }));
    } catch (e) {
      const reasons = cancellationCodes(e);
      if (!reasons) throw e;
      // A concurrent request with the same key (double click, network retry)
      // may have committed first: if so, return that order instead.
      const rec = await readIdempotency(idempotencyKey);
      if (rec) return replay(rec, fp);
      if (reasons[0] === "ConditionalCheckFailed") continue; // order-number collision → new number
      if (reasons.slice(2).includes("ConditionalCheckFailed")) continue; // stock/price changed → re-price
      if (reasons.includes("TransactionConflict")) {
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
        continue;
      }
      throw e;
    }

    if (byProduct.size) invalidateCatalog();
    log.info("order.placed", { orderNumber: order.number, lines: order.lines.length, total: order.total });
    await notifyNewOrder(order).catch((err) => log.warn("order.notify_failed", { orderNumber: order.number, error: err }));
    return { order, viewToken, replayed: false };
  }
  // Repeated conflicts: re-price once more to report precise problems to the customer.
  const products = await loadProducts(input.items.map((i) => i.productId));
  const priced = priceCart(input.items, products, area);
  throw new HttpError(409, priced.problems.length ? "cart_problems" : "stock_changed", { problems: priced.problems });
}

interface IdempotencyRecord {
  orderNumber: string;
  fingerprint: string;
  viewToken: string;
}

async function readIdempotency(key: string): Promise<IdempotencyRecord | null> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.idempotency(key), ConsistentRead: true }));
  return (res.Item as IdempotencyRecord | undefined) ?? null;
}

async function replay(rec: IdempotencyRecord, fp: string): Promise<PlaceOrderResult> {
  if (rec.fingerprint !== fp) throw new HttpError(409, "idempotency_mismatch");
  const order = await getOrder(rec.orderNumber);
  if (!order) throw new HttpError(409, "idempotency_mismatch");
  return { order, viewToken: rec.viewToken, replayed: true };
}

export function verifyViewToken(order: Order, token: string | undefined): boolean {
  if (!token || token.length > 100) return false;
  const a = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const b = Buffer.from(order.viewTokenHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Changes an order's status. Optimistic concurrency: the update only applies
 * if the status is still what the admin saw. Cancelling returns tracked stock.
 */
export async function updateOrderStatus(number: string, to: OrderStatus, actor: string, note: string | null): Promise<Order> {
  const order = await getOrder(number);
  if (!order) throw new HttpError(404, "not_found");
  if (!canTransition(order.status, to)) throw new HttpError(409, "invalid_transition", { from: order.status, to });

  const now = new Date().toISOString();
  const updated: Order = {
    ...order,
    status: to,
    updatedAt: now,
    seenByAdmin: true,
    history: [...order.history, { status: to, at: now, by: actor, ...(note ? { note } : {}) }],
  };
  const item = orderItem(updated);
  const tx: TxItems = [
    {
      Put: {
        TableName: tableName(),
        Item: item,
        ConditionExpression: "#st = :from",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":from": order.status },
      },
    },
  ];

  let restocked = false;
  if (to === "cancelled") {
    const qtyByProduct = new Map<string, Map<string, number>>();
    for (const l of order.lines.filter((l) => l.stockTracked)) {
      const m = qtyByProduct.get(l.productId) ?? new Map<string, number>();
      m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.quantity);
      qtyByProduct.set(l.productId, m);
    }
    for (const [productId, m] of qtyByProduct) {
      const p = await getProduct(productId);
      if (!p) continue; // product deleted since — nothing to return stock to
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = { ":v": p.version, ":one": 1 };
      const sets = ["version = version + :one"];
      const conds = ["version = :v"];
      let n = 0;
      for (const [variantId, q] of m) {
        const idx = p.variants.findIndex((v) => v.id === variantId);
        if (idx < 0 || !p.variants[idx]!.trackStock) continue;
        names[`#i${n}`] = "id";
        values[`:id${n}`] = variantId;
        values[`:q${n}`] = q;
        conds.push(`variants[${idx}].#i${n} = :id${n}`);
        sets.push(`variants[${idx}].stock = variants[${idx}].stock + :q${n}`);
        n++;
      }
      if (n === 0) continue;
      restocked = true;
      tx.push({
        Update: {
          TableName: tableName(),
          Key: keys.product(productId),
          UpdateExpression: "SET " + sets.join(", "),
          ConditionExpression: conds.join(" AND "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        },
      });
    }
  }

  try {
    await db().send(new TransactWriteCommand({ TransactItems: tx }));
  } catch (e) {
    const reasons = cancellationCodes(e);
    if (reasons?.[0] === "ConditionalCheckFailed") throw new HttpError(409, "status_changed");
    if (reasons) throw new HttpError(409, "conflict_retry");
    throw e;
  }
  if (restocked) invalidateCatalog();
  // orderItem() omits OPENPK for terminal statuses and Put replaces the whole
  // item, so closed orders leave the open-orders index automatically.
  if (isTerminal(to)) log.info("order.closed", { orderNumber: number, status: to });
  return updated;
}
