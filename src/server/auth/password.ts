import "server-only";
import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// OWASP Password Storage Cheat Sheet (2024+): Argon2id, m=19 MiB, t=2, p=1.
const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// A real Argon2id hash of a random secret, used to equalise timing when the
// username does not exist (prevents user enumeration via response time).
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  dummyHash ??= hash(randomBytes(32).toString("hex"), OPTIONS);
  try {
    return await verify(passwordHash ?? (await dummyHash), password);
  } catch {
    return false;
  }
}
