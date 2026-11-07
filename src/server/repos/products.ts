import "server-only";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys, stripKeys } from "../db/schema";
import type { Category, Product } from "@/lib/types";

export class ConflictError extends Error {
  constructor(public readonly code: "version" | "slug" | "exists") {
    super(code);
  }
}

function productItem(p: Product) {
  return { ...keys.product(p.id), entity: "product", GSI1PK: "CATALOG", GSI1SK: `${p.createdAt}#${p.id}`, ...p };
}

export async function queryAll(params: ConstructorParameters<typeof QueryCommand>[0]) {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res: QueryCommandOutput = await db().send(new QueryCommand({ ...params, ExclusiveStartKey }));
    items.push(...((res.Items ?? []) as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function listAllProducts(): Promise<Product[]> {
  const items = await queryAll({
    TableName: tableName(),
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: { ":pk": "CATALOG" },
    ScanIndexForward: false,
  });
  return items.map((i) => stripKeys<Product>(i)!);
}

export async function getProduct(id: string): Promise<Product | null> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.product(id), ConsistentRead: true }));
  return stripKeys<Product>(res.Item);
}

export async function createProduct(p: Product): Promise<void> {
  try {
    await db().send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: tableName(), Item: productItem(p), ConditionExpression: "attribute_not_exists(PK)" } },
          {
            Put: {
              TableName: tableName(),
              Item: { ...keys.slug(p.slug), entity: "slug", productId: p.id },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }),
    );
  } catch (e) {
    throw mapTxError(e, ["exists", "slug"]);
  }
}

/** Replaces a product if (and only if) its stored version equals expectedVersion. */
export async function updateProduct(p: Product, expectedVersion: number, previousSlug: string): Promise<void> {
  const tx: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]> = [
    {
      Put: {
        TableName: tableName(),
        Item: productItem(p),
        ConditionExpression: "attribute_exists(PK) AND version = :v",
        ExpressionAttributeValues: { ":v": expectedVersion },
      },
    },
  ];
  if (p.slug !== previousSlug) {
    tx.push(
      {
        Put: {
          TableName: tableName(),
          Item: { ...keys.slug(p.slug), entity: "slug", productId: p.id },
          ConditionExpression: "attribute_not_exists(PK)",
        },
      },
      {
        Delete: {
          TableName: tableName(),
          Key: keys.slug(previousSlug),
          ConditionExpression: "productId = :id",
          ExpressionAttributeValues: { ":id": p.id },
        },
      },
    );
  }
  try {
    await db().send(new TransactWriteCommand({ TransactItems: tx }));
  } catch (e) {
    throw mapTxError(e, ["version", "slug", "version"]);
  }
}

export async function deleteProduct(p: Product): Promise<void> {
  await db().send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: tableName(), Key: keys.product(p.id) } },
        {
          Delete: {
            TableName: tableName(),
            Key: keys.slug(p.slug),
            ConditionExpression: "attribute_not_exists(PK) OR productId = :id",
            ExpressionAttributeValues: { ":id": p.id },
          },
        },
      ],
    }),
  );
}

// ─── Categories ──────────────────────────────────────────────────────────
function categoryItem(c: Category) {
  return {
    ...keys.category(c.id),
    entity: "category",
    GSI1PK: "CATEGORIES",
    GSI1SK: `${String(c.sortOrder).padStart(4, "0")}#${c.id}`,
    ...c,
  };
}

export async function listCategories(): Promise<Category[]> {
  const items = await queryAll({
    TableName: tableName(),
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: { ":pk": "CATEGORIES" },
  });
  return items.map((i) => stripKeys<Category>(i)!);
}

export async function putCategory(c: Category): Promise<void> {
  await db().send(new PutCommand({ TableName: tableName(), Item: categoryItem(c) }));
}

export async function deleteCategory(id: string): Promise<void> {
  await db().send(new DeleteCommand({ TableName: tableName(), Key: keys.category(id) }));
}

// ─── helpers ─────────────────────────────────────────────────────────────
export function cancellationCodes(e: unknown): string[] | null {
  if (e && typeof e === "object" && (e as { name?: string }).name === "TransactionCanceledException") {
    const reasons = (e as { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
    return reasons.map((r) => r.Code ?? "None");
  }
  return null;
}

function mapTxError(e: unknown, codes: ConflictError["code"][]): unknown {
  const reasons = cancellationCodes(e);
  if (!reasons) return e;
  const idx = reasons.findIndex((r) => r === "ConditionalCheckFailed");
  if (idx >= 0 && codes[idx]) return new ConflictError(codes[idx]!);
  return e;
}
