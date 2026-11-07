import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isProduction } from "../env";
import { deleteSession, getAdmin, getSession, putSession, touchSession, type SessionRecord } from "../repos/admins";
import type { AdminRole } from "@/lib/types";

export const SESSION_COOKIE = process.env.APP_ENV === "production" ? "__Host-basman_admin" : "basman_admin";
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 hours
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export interface AdminSession {
  username: string;
  displayName: string;
  role: AdminRole;
  tokenHash: string;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(username: string, role: AdminRole): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const record: SessionRecord = {
    tokenHash: hashToken(token),
    username,
    role,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_ABSOLUTE_MS,
  };
  await putSession(record);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
  return token;
}

/** Validates the session cookie against the server-side store. */
export async function readSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return validateToken(token);
}

export async function validateToken(token: string, now = Date.now()): Promise<AdminSession | null> {
  const tokenHash = hashToken(token);
  const s = await getSession(tokenHash);
  if (!s) return null;
  if (now >= s.expiresAt || now - s.lastSeenAt >= SESSION_IDLE_MS) {
    await deleteSession(tokenHash);
    return null;
  }
  // Re-check the account on every request so disabling a user or changing
  // their password takes effect immediately.
  const user = await getAdmin(s.username);
  if (!user || user.disabled) {
    await deleteSession(tokenHash);
    return null;
  }
  if (now - s.lastSeenAt > TOUCH_EVERY_MS) await touchSession(tokenHash, now).catch(() => undefined);
  return { username: user.username, displayName: user.displayName, role: user.role, tokenHash };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashToken(token));
  jar.delete(SESSION_COOKIE);
}
