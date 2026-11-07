import "server-only";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys, stripKeys } from "../db/schema";
import type { AdminRole, AdminUser } from "@/lib/types";

export async function getAdmin(username: string): Promise<AdminUser | null> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.admin(username), ConsistentRead: true }));
  return stripKeys<AdminUser>(res.Item);
}

export async function putAdmin(u: AdminUser, opts: { mustNotExist?: boolean } = {}): Promise<void> {
  await db().send(
    new PutCommand({
      TableName: tableName(),
      Item: { ...keys.admin(u.username), entity: "admin", ...u },
      ...(opts.mustNotExist ? { ConditionExpression: "attribute_not_exists(PK)" } : {}),
    }),
  );
}

export async function setAdminPassword(username: string, passwordHash: string): Promise<void> {
  await db().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.admin(username),
      UpdateExpression: "SET passwordHash = :h, passwordChangedAt = :t",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":h": passwordHash, ":t": new Date().toISOString() },
    }),
  );
}

// ─── Sessions ────────────────────────────────────────────────────────────
export interface SessionRecord {
  tokenHash: string;
  username: string;
  role: AdminRole;
  createdAt: number; // epoch ms
  lastSeenAt: number; // epoch ms
  expiresAt: number; // epoch ms (absolute)
}

export async function putSession(s: SessionRecord): Promise<void> {
  await db().send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...keys.session(s.tokenHash),
        entity: "session",
        GSI1PK: `USERSESS#${s.username}`,
        GSI1SK: String(s.createdAt),
        ttl: Math.ceil(s.expiresAt / 1000),
        ...s,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

export async function getSession(tokenHash: string): Promise<SessionRecord | null> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.session(tokenHash), ConsistentRead: true }));
  return stripKeys<SessionRecord>(res.Item);
}

export async function touchSession(tokenHash: string, now: number): Promise<void> {
  await db().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.session(tokenHash),
      UpdateExpression: "SET lastSeenAt = :now",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":now": now },
    }),
  );
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await db().send(new DeleteCommand({ TableName: tableName(), Key: keys.session(tokenHash) }));
}

export async function deleteUserSessions(username: string, exceptHash?: string): Promise<void> {
  const res = await db().send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `USERSESS#${username}` },
    }),
  );
  await Promise.all(
    (res.Items ?? [])
      .map((i) => i.tokenHash as string)
      .filter((h) => h !== exceptHash)
      .map((h) => deleteSession(h)),
  );
}

// ─── Rate limiting (fixed window counters, shared across server instances) ──
export async function hitRateLimit(scope: string, id: string, windowMs: number, now = Date.now()): Promise<number> {
  const window = Math.floor(now / windowMs);
  const res = await db().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.rateLimit(scope, id, window),
      UpdateExpression: "ADD hits :one SET #ttl = if_not_exists(#ttl, :ttl)",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: { ":one": 1, ":ttl": Math.ceil(((window + 2) * windowMs) / 1000) },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  return (res.Attributes?.hits as number | undefined) ?? 1;
}

export async function peekRateLimit(scope: string, id: string, windowMs: number, now = Date.now()): Promise<number> {
  const window = Math.floor(now / windowMs);
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.rateLimit(scope, id, window) }));
  return (res.Item?.hits as number | undefined) ?? 0;
}

export async function clearRateLimit(scope: string, id: string, windowMs: number, now = Date.now()): Promise<void> {
  const window = Math.floor(now / windowMs);
  await db().send(new DeleteCommand({ TableName: tableName(), Key: keys.rateLimit(scope, id, window) }));
}
