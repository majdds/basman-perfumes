import "server-only";
import { createHash } from "node:crypto";
import { HttpError, ipKey } from "../http";
import { log } from "../log";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, type AdminSession } from "../auth/session";
import { clearRateLimit, deleteUserSessions, getAdmin, hitRateLimit, peekRateLimit, setAdminPassword } from "../repos/admins";
import { LIMITS } from "./rate-limit";

const userKey = (u: string) => createHash("sha256").update(u).digest("hex").slice(0, 32);

/**
 * Login with brute-force protection:
 *  - max 20 attempts / 15 min per IP,
 *  - max 5 FAILED attempts / 15 min per account (locks the account for the window),
 *  - identical error and similar timing whether or not the user exists.
 */
export async function login(req: Request, username: string, password: string): Promise<void> {
  const ip = await ipKey(req);
  const ipHits = await hitRateLimit("loginIp", ip, LIMITS.loginIp.windowMs);
  if (ipHits > LIMITS.loginIp.max) throw new HttpError(429, "locked");

  const uk = userKey(username);
  const failures = await peekRateLimit("loginUser", uk, LIMITS.loginUser.windowMs);
  if (failures >= LIMITS.loginUser.max) throw new HttpError(429, "locked");

  const user = await getAdmin(username);
  const ok = await verifyPassword(user?.passwordHash ?? null, password);
  if (!user || user.disabled || !ok) {
    await hitRateLimit("loginUser", uk, LIMITS.loginUser.windowMs);
    log.warn("auth.login_failed", { userKey: uk });
    throw new HttpError(401, "invalid");
  }
  await clearRateLimit("loginUser", uk, LIMITS.loginUser.windowMs);
  await createSession(user.username, user.role);
  log.info("auth.login", { user: user.username });
}

export async function logout(): Promise<void> {
  await destroySession();
}

export async function changePassword(session: AdminSession, current: string, next: string): Promise<void> {
  const user = await getAdmin(session.username);
  if (!user || !(await verifyPassword(user.passwordHash, current))) throw new HttpError(400, "wrongPassword");
  await setAdminPassword(user.username, await hashPassword(next));
  // Sign out every other device; keep the current session.
  await deleteUserSessions(user.username, session.tokenHash);
  log.info("auth.password_changed", { user: user.username });
}
