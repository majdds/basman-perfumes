import "server-only";
import { HttpError, ipKey } from "../http";
import { hitRateLimit } from "../repos/admins";

export const LIMITS = {
  order: { max: 5, windowMs: 10 * 60 * 1000 }, // 5 orders / 10 min / IP
  quote: { max: 120, windowMs: 60 * 1000 },
  loginIp: { max: 20, windowMs: 15 * 60 * 1000 },
  loginUser: { max: 5, windowMs: 15 * 60 * 1000 }, // failed attempts per account
  upload: { max: 60, windowMs: 10 * 60 * 1000 },
  adminWrite: { max: 300, windowMs: 10 * 60 * 1000 },
} as const;

export async function enforceIpLimit(req: Request, scope: keyof typeof LIMITS): Promise<void> {
  const { max, windowMs } = LIMITS[scope];
  const hits = await hitRateLimit(scope, await ipKey(req), windowMs);
  if (hits > max) {
    throw new HttpError(429, "rateLimited", { retryAfterSeconds: Math.ceil(windowMs / 1000) });
  }
}
