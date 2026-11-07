import "server-only";
import { randomUUID } from "node:crypto";
import { getSettings, putSettings } from "../repos/settings";
import { invalidateCatalog } from "./catalog";
import { parsePalestinianPhone } from "@/lib/phone";
import type { StoreSettings } from "@/lib/types";
import type { SettingsInput } from "@/lib/validation";

export async function saveSettings(input: SettingsInput): Promise<StoreSettings> {
  const current = await getSettings();
  const next: StoreSettings = {
    ...current,
    phone: parsePalestinianPhone(input.phone)!.e164,
    whatsapp: parsePalestinianPhone(input.whatsapp)!.e164,
    addressText: input.addressText,
    mapsUrl: input.mapsUrl,
    hours: input.hours.ar || input.hours.en ? { ar: input.hours.ar ?? "", en: input.hours.en ?? "" } : null,
    instagramUrl: input.instagramUrl,
    facebookUrl: input.facebookUrl,
    deliveryAreas: input.deliveryAreas.map((a) => ({
      id: a.id && current.deliveryAreas.some((x) => x.id === a.id) ? a.id : randomUUID().slice(0, 8),
      name: a.name,
      fee: a.fee,
      freeOver: a.freeOver && a.freeOver > 0 ? a.freeOver : null,
      active: a.active,
    })),
    lowStockThreshold: input.lowStockThreshold,
    retentionDays: input.retentionDays,
    orderingEnabled: input.orderingEnabled,
    heroImageKey: input.heroImageKey,
    announcement:
      input.announcement.ar || input.announcement.en ? { ar: input.announcement.ar ?? "", en: input.announcement.en ?? "" } : null,
    updatedAt: new Date().toISOString(),
  };
  await putSettings(next);
  invalidateCatalog();
  return next;
}
