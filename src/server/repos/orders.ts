import "server-only";
import { GetCommand, QueryCommand, UpdateCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys, stripKeys } from "../db/schema";
import type { Order } from "@/lib/types";
import { isTerminal, type OrderStatus } from "@/lib/order-status";
import { queryAll } from "./products";

export function orderItem(o: Order) {
  return {
    ...keys.order(o.number),
    entity: "order",
    GSI1PK: "ORDERS",
    GSI1SK: o.createdAt,
    ...(o.anonymized ? {} : { GSI2PK: `PHONE#${o.customer.phoneNational}`, GSI2SK: o.createdAt }),
    ...(isTerminal(o.status) ? {} : { OPENPK: "OPEN" }),
    ...o,
  };
}

export async function getOrder(number: string): Promise<Order | null> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.order(number), ConsistentRead: true }));
  return stripKeys<Order>(res.Item);
}

export interface OrderPage {
  orders: Order[];
  cursor: string | null;
}

/**
 * Cursors are opaque base64url JSON of DynamoDB's LastEvaluatedKey. They are
 * validated strictly on the way back in so a client cannot inject arbitrary
 * key structures.
 */
export function encodeCursor(key: Record<string, unknown> | undefined): string | null {
  return key ? Buffer.from(JSON.stringify(key)).toString("base64url") : null;
}
export function decodeCursor(cursor: string | undefined): Record<string, string> | undefined {
  if (!cursor) return undefined;
  try {
    const obj = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
    const allowed = new Set(["PK", "SK", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK", "OPENPK"]);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!allowed.has(k) || typeof v !== "string" || v.length > 200) return undefined;
      out[k] = v;
    }
    return out;
  } catch {
    return undefined;
  }
}

export async function listOrders(opts: {
  status?: OrderStatus | "open" | "all";
  fromIso?: string;
  toIso?: string;
  cursor?: string;
  limit?: number;
}): Promise<OrderPage> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const useOpenIndex = opts.status === "open" || opts.status === "new" || opts.status === "confirmed" || opts.status === "preparing" || opts.status === "out_for_delivery";
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  let keyCond: string;
  if (useOpenIndex) {
    keyCond = "OPENPK = :pk";
    values[":pk"] = "OPEN";
  } else {
    keyCond = "GSI1PK = :pk";
    values[":pk"] = "ORDERS";
  }
  if (opts.fromIso && opts.toIso) {
    keyCond += " AND GSI1SK BETWEEN :from AND :to";
    values[":from"] = opts.fromIso;
    values[":to"] = opts.toIso;
  } else if (opts.fromIso) {
    keyCond += " AND GSI1SK >= :from";
    values[":from"] = opts.fromIso;
  } else if (opts.toIso) {
    keyCond += " AND GSI1SK <= :to";
    values[":to"] = opts.toIso;
  }
  let filter: string | undefined;
  if (opts.status && opts.status !== "all" && opts.status !== "open") {
    filter = "#st = :st";
    names["#st"] = "status";
    values[":st"] = opts.status;
  }
  // With a filter, DynamoDB's Limit applies before filtering; read in chunks until we have enough.
  const orders: Order[] = [];
  let startKey = decodeCursor(opts.cursor) as QueryCommandInput["ExclusiveStartKey"];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await db().send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: useOpenIndex ? "GSI3" : "GSI1",
        KeyConditionExpression: keyCond,
        FilterExpression: filter,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ScanIndexForward: false,
        Limit: filter ? 100 : limit,
        ExclusiveStartKey: startKey,
      }),
    );
    for (const item of res.Items ?? []) {
      if (orders.length < limit) orders.push(stripKeys<Order>(item)!);
    }
    lastKey = res.LastEvaluatedKey;
    startKey = lastKey;
    if (orders.length >= limit) {
      const last = orders[orders.length - 1]!;
      lastKey = useOpenIndex
        ? { ...keys.order(last.number), OPENPK: "OPEN", GSI1SK: last.createdAt }
        : { ...keys.order(last.number), GSI1PK: "ORDERS", GSI1SK: last.createdAt };
      break;
    }
  } while (startKey);
  return { orders, cursor: encodeCursor(lastKey) };
}

export async function ordersByPhone(national: string): Promise<Order[]> {
  const items = await queryAll({
    TableName: tableName(),
    IndexName: "GSI2",
    KeyConditionExpression: "GSI2PK = :pk",
    ExpressionAttributeValues: { ":pk": `PHONE#${national}` },
    ScanIndexForward: false,
  });
  return items.map((i) => stripKeys<Order>(i)!);
}

/** Orders that are not yet delivered/cancelled (sparse index — stays small). */
export async function openOrders(): Promise<Order[]> {
  const items = await queryAll({
    TableName: tableName(),
    IndexName: "GSI3",
    KeyConditionExpression: "OPENPK = :pk",
    ExpressionAttributeValues: { ":pk": "OPEN" },
    ScanIndexForward: false,
  });
  return items.map((i) => stripKeys<Order>(i)!);
}

export async function countOrdersSince(iso: string): Promise<number> {
  let count = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await db().send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK >= :from",
        ExpressionAttributeValues: { ":pk": "ORDERS", ":from": iso },
        Select: "COUNT",
        ExclusiveStartKey,
      }),
    );
    count += res.Count ?? 0;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return count;
}

export async function totalOrderCount(): Promise<number> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.orderStats() }));
  return (res.Item?.total as number | undefined) ?? 0;
}

export async function markOrderSeen(number: string): Promise<void> {
  await db().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.order(number),
      UpdateExpression: "SET seenByAdmin = :t",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":t": true },
    }),
  );
}

/** Orders created before `beforeIso` (oldest first), for retention processing. */
export async function ordersBefore(beforeIso: string): Promise<Order[]> {
  const items = await queryAll({
    TableName: tableName(),
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk AND GSI1SK < :before",
    FilterExpression: "anonymized = :f",
    ExpressionAttributeValues: { ":pk": "ORDERS", ":before": beforeIso, ":f": false },
  });
  return items.map((i) => stripKeys<Order>(i)!);
}
