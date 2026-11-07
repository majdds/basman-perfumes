/**
 * Single-table DynamoDB design. This file is the source of truth for the
 * table definition used by scripts/create-table.ts and infra/ (CDK).
 *
 * Entity              PK                     SK              GSI1PK / GSI1SK                GSI2PK / GSI2SK
 * ─────────────────── ────────────────────── ─────────────── ────────────────────────────── ────────────────────────────
 * Product             PRODUCT#<id>           META            CATALOG / <createdAt>#<id>
 * Product slug lock   SLUG#<slug>            SLUG
 * Category            CATEGORY#<id>          META            CATEGORIES / <sortOrder>#<id>
 * Settings            SETTINGS               STORE
 * Order               ORDER#<number>         META            ORDERS / <createdAt>          PHONE#<national> / <createdAt>
 *                     (open orders also carry OPENPK="OPEN" → sparse GSI3 for cheap new-order polling)
 * Order counter       STATS                  ORDERS          (atomic total, updated in the order transaction)
 * Idempotency record  IDEMP#<key>            IDEMP           (TTL 24h)
 * Admin user          ADMIN#<username>       META
 * Session             SESSION#<sha256>       SESSION         USERSESS#<username> / <created>  (TTL = absolute expiry)
 * Rate-limit bucket   RL#<scope>#<id>#<win>  RL              (TTL)
 * Install salt        SETTINGS               SALT
 *
 * The product catalogue for a single store is small (hundreds of items), so
 * the storefront reads the whole catalogue via GSI1 (cached briefly in memory)
 * and filters/sorts in the application. Orders are paged by date via GSI1 and
 * looked up by phone via GSI2.
 */
export const TABLE_KEYS = {
  partitionKey: "PK",
  sortKey: "SK",
  ttlAttribute: "ttl",
  gsis: [
    { name: "GSI1", partitionKey: "GSI1PK", sortKey: "GSI1SK" },
    { name: "GSI2", partitionKey: "GSI2PK", sortKey: "GSI2SK" },
    { name: "GSI3", partitionKey: "OPENPK", sortKey: "GSI1SK" },
  ],
} as const;

export const keys = {
  product: (id: string) => ({ PK: `PRODUCT#${id}`, SK: "META" }),
  slug: (slug: string) => ({ PK: `SLUG#${slug}`, SK: "SLUG" }),
  category: (id: string) => ({ PK: `CATEGORY#${id}`, SK: "META" }),
  settings: () => ({ PK: "SETTINGS", SK: "STORE" }),
  salt: () => ({ PK: "SETTINGS", SK: "SALT" }),
  order: (n: string) => ({ PK: `ORDER#${n}`, SK: "META" }),
  idempotency: (k: string) => ({ PK: `IDEMP#${k}`, SK: "IDEMP" }),
  admin: (u: string) => ({ PK: `ADMIN#${u}`, SK: "META" }),
  session: (hash: string) => ({ PK: `SESSION#${hash}`, SK: "SESSION" }),
  orderStats: () => ({ PK: "STATS", SK: "ORDERS" }),
  rateLimit: (scope: string, id: string, window: number) => ({ PK: `RL#${scope}#${id}#${window}`, SK: "RL" }),
};

/** Strip DynamoDB key attributes before returning an entity to callers. */
export function stripKeys<T>(item: Record<string, unknown> | undefined): T | null {
  if (!item) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, OPENPK, ttl, entity, ...rest } = item;
  return rest as T;
}
