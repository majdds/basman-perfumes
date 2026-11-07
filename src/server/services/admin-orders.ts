import "server-only";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys } from "../db/schema";
import { getOrder, listOrders, ordersBefore, ordersByPhone, openOrders, countOrdersSince, totalOrderCount } from "../repos/orders";
import { listAllProducts } from "../repos/products";
import { getSettings } from "../repos/settings";
import { normalizeOrderNumberInput, ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { parsePalestinianPhone } from "@/lib/phone";
import { startOfStoreDayUtc, storeDateKey, formatDateTime } from "@/lib/dates";
import { isTerminal, type OrderStatus } from "@/lib/order-status";
import { agorotToShekels } from "@/lib/money";
import type { Order } from "@/lib/types";
import type { z } from "zod";
import type { orderListQuerySchema } from "@/lib/validation";

type ListQuery = z.infer<typeof orderListQuerySchema>;

function dayRange(from?: string, to?: string) {
  const fromIso = from ? startOfStoreDayUtc(from).toISOString() : undefined;
  let toIso: string | undefined;
  if (to) {
    const end = startOfStoreDayUtc(to);
    end.setUTCDate(end.getUTCDate() + 1);
    toIso = new Date(end.getTime() - 1).toISOString();
  }
  return { fromIso, toIso };
}

/** Search box accepts either an order number ("BS-7K3M9Q", "7k3m9q") or a phone number. */
export async function searchOrders(q: string): Promise<Order[]> {
  const trimmed = q.trim();
  const asNumber = normalizeOrderNumberInput(trimmed);
  if (ORDER_NUMBER_PATTERN.test(asNumber)) {
    const o = await getOrder(asNumber);
    if (o) return [o];
  }
  const phone = parsePalestinianPhone(trimmed);
  if (phone) return ordersByPhone(phone.national);
  return [];
}

export async function adminListOrders(query: ListQuery) {
  if (query.q?.trim()) {
    let orders = await searchOrders(query.q);
    if (query.status !== "all") {
      orders = orders.filter((o) => (query.status === "open" ? !isTerminal(o.status) : o.status === query.status));
    }
    return { orders, cursor: null };
  }
  const { fromIso, toIso } = dayRange(query.from, query.to);
  return listOrders({ status: query.status as OrderStatus | "open" | "all", fromIso, toIso, cursor: query.cursor });
}

export async function dashboardStats() {
  const [open, total, today, products, settings] = await Promise.all([
    openOrders(),
    totalOrderCount(),
    countOrdersSince(startOfStoreDayUtc(storeDateKey(new Date())).toISOString()),
    listAllProducts(),
    getSettings(),
  ]);
  const active = products.filter((p) => p.status === "active");
  const lowStock = active.flatMap((p) =>
    p.variants
      .filter((v) => v.trackStock && (v.stock ?? 0) <= settings.lowStockThreshold)
      .map((v) => ({ product: p, variant: v })),
  );
  return {
    newCount: open.filter((o) => o.status === "new").length,
    openCount: open.length,
    totalCount: total,
    todayCount: today,
    productCount: active.length,
    demoCount: products.filter((p) => p.isDemo).length,
    lowStock,
  };
}

/** Lightweight endpoint for the dashboard's new-order polling. */
export async function newOrdersSummary() {
  const open = await openOrders();
  const fresh = open.filter((o) => o.status === "new");
  return { newCount: fresh.length, latest: fresh[0]?.createdAt ?? null, unseen: fresh.filter((o) => !o.seenByAdmin).length };
}

// ─── CSV export ──────────────────────────────────────────────────────────
/** Neutralises spreadsheet formula injection (=, +, -, @, tab, CR) and quotes the cell. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function exportOrdersCsv(query: ListQuery, locale: "ar" | "en"): Promise<string> {
  const { fromIso, toIso } = dayRange(query.from, query.to);
  const rows: Order[] = [];
  let cursor: string | undefined;
  do {
    const page = await listOrders({ status: query.status as OrderStatus | "open" | "all", fromIso, toIso, cursor, limit: 100 });
    rows.push(...page.orders);
    cursor = page.cursor ?? undefined;
  } while (cursor && rows.length < 20_000);

  const header =
    locale === "ar"
      ? ["رقم الطلب", "التاريخ", "الحالة", "الاسم", "الهاتف", "المنطقة", "العنوان", "ملاحظات", "المنتجات", "المجموع", "التوصيل", "الإجمالي"]
      : ["Order", "Date", "Status", "Name", "Phone", "Area", "Address", "Notes", "Items", "Subtotal", "Delivery", "Total"];
  const lines = rows.map((o) =>
    [
      o.number,
      formatDateTime(o.createdAt, locale),
      o.status,
      o.customer.name,
      o.customer.phoneNational,
      locale === "ar" ? o.delivery.areaName.ar : o.delivery.areaName.en,
      o.delivery.address,
      o.delivery.notes ?? "",
      o.lines.map((l) => `${l.quantity}× ${locale === "ar" ? l.name.ar : l.name.en || l.name.ar} ${locale === "ar" ? l.variantLabel.ar : l.variantLabel.en}`.trim()).join(" | "),
      agorotToShekels(o.subtotal),
      agorotToShekels(o.deliveryFee),
      agorotToShekels(o.total),
    ]
      .map(csvCell)
      .join(","),
  );
  // UTF-8 BOM so Excel shows Arabic correctly.
  return "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
}

// ─── Data retention ──────────────────────────────────────────────────────
/**
 * Removes customer personal data (name, phone, email, address, notes) from
 * delivered/cancelled orders older than `retentionDays`. Order totals and
 * items are kept for the store's sales records.
 */
export async function runRetention(now = new Date()): Promise<number> {
  const settings = await getSettings();
  if (!settings.retentionDays) return 0;
  const cutoff = new Date(now.getTime() - settings.retentionDays * 86_400_000).toISOString();
  const old = (await ordersBefore(cutoff)).filter((o) => isTerminal(o.status));
  for (const o of old) {
    await db().send(
      new UpdateCommand({
        TableName: tableName(),
        Key: keys.order(o.number),
        UpdateExpression:
          "SET customer = :c, delivery.address = :x, delivery.notes = :n, anonymized = :t REMOVE GSI2PK, GSI2SK",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: {
          ":c": { name: "—", phone: "", phoneNational: "", email: null },
          ":x": "—",
          ":n": null,
          ":t": true,
        },
      }),
    );
  }
  return old.length;
}
