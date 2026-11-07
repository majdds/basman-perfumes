import "server-only";
import { randomBytes } from "node:crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, tableName } from "../db/client";
import { keys, stripKeys } from "../db/schema";
import type { StoreSettings } from "@/lib/types";
import { BUSINESS } from "@/config/business";

/** Defaults come from verified public business information (see config/business.ts). */
export function defaultSettings(): StoreSettings {
  return {
    phone: BUSINESS.phoneE164,
    whatsapp: BUSINESS.whatsappE164,
    addressText: BUSINESS.address,
    mapsUrl: BUSINESS.mapsUrl,
    hours: BUSINESS.hours,
    instagramUrl: BUSINESS.instagramUrl,
    facebookUrl: BUSINESS.facebookUrl,
    deliveryAreas: [],
    lowStockThreshold: 3,
    retentionDays: 730,
    orderingEnabled: true,
    heroImageKey: null,
    announcement: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getSettings(): Promise<StoreSettings> {
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.settings() }));
  const stored = stripKeys<StoreSettings>(res.Item);
  return stored ? { ...defaultSettings(), ...stored } : defaultSettings();
}

export async function putSettings(s: StoreSettings): Promise<void> {
  await db().send(new PutCommand({ TableName: tableName(), Item: { ...keys.settings(), entity: "settings", ...s } }));
}

let saltCache: string | null = null;
/**
 * Per-installation random salt used to pseudonymise IP addresses in
 * rate-limit keys, so raw IPs are never stored. Created on first use.
 */
export async function getInstallSalt(): Promise<string> {
  if (saltCache) return saltCache;
  const res = await db().send(new GetCommand({ TableName: tableName(), Key: keys.salt(), ConsistentRead: true }));
  if (res.Item?.salt) return (saltCache = res.Item.salt as string);
  const salt = randomBytes(32).toString("hex");
  try {
    await db().send(
      new PutCommand({
        TableName: tableName(),
        Item: { ...keys.salt(), salt },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return (saltCache = salt);
  } catch {
    const again = await db().send(new GetCommand({ TableName: tableName(), Key: keys.salt(), ConsistentRead: true }));
    return (saltCache = again.Item!.salt as string);
  }
}
