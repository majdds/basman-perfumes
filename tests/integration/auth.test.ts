import { beforeAll, describe, expect, it } from "vitest";
import { createAdmin } from "../../scripts/create-admin";
import { changePassword, login, logout } from "@/server/services/auth";
import { readSession, validateToken, SESSION_COOKIE, SESSION_IDLE_MS, SESSION_ABSOLUTE_MS, hashToken } from "@/server/auth/session";
import { getSession } from "@/server/repos/admins";
import { requireAdminApi } from "@/server/auth/guard";
import { hitRateLimit } from "@/server/repos/admins";

const jar = (globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar;
const PASSWORD = "integration-test-passphrase-1";
let ipCounter = 0;
const req = () => new Request("http://localhost/api/admin/login", { method: "POST", headers: { "x-forwarded-for": `203.0.113.${++ipCounter}` } });

beforeAll(async () => {
  await createAdmin("owner1", "Owner", "owner", PASSWORD);
  await createAdmin("staff1", "Staff", "staff", PASSWORD);
});

describe("admin authentication", () => {
  it("stores only an Argon2id hash", async () => {
    const { getAdmin } = await import("@/server/repos/admins");
    const u = await getAdmin("owner1");
    expect(u!.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(u!.passwordHash).not.toContain(PASSWORD);
  });

  it("rejects weak passwords and duplicate accounts at creation", async () => {
    await expect(createAdmin("weak", "W", "owner", "short")).rejects.toThrow();
    await expect(createAdmin("owner1", "Owner", "owner", PASSWORD)).rejects.toThrow(/already exists/);
  });

  it("logs in, creates a server-side session, and logs out", async () => {
    jar.clear();
    await login(req(), "owner1", PASSWORD);
    const token = jar.get(SESSION_COOKIE)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The DB only has the hash of the token.
    expect(await getSession(token)).toBeNull();
    expect(await getSession(hashToken(token))).not.toBeNull();
    expect(await readSession()).toMatchObject({ username: "owner1", role: "owner" });
    await logout();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await validateToken(token)).toBeNull();
  });

  it("gives the same error for unknown users and wrong passwords", async () => {
    await expect(login(req(), "nobody", PASSWORD)).rejects.toMatchObject({ status: 401, code: "invalid" });
    await expect(login(req(), "staff1", "wrong-password-123")).rejects.toMatchObject({ status: 401, code: "invalid" });
  });

  it("locks an account after 5 failed attempts, even from different IPs", async () => {
    await createAdmin("victim", "V", "staff", PASSWORD);
    for (let i = 0; i < 5; i++) await expect(login(req(), "victim", "bad-guess-" + i)).rejects.toMatchObject({ code: "invalid" });
    await expect(login(req(), "victim", PASSWORD)).rejects.toMatchObject({ status: 429, code: "locked" });
  });

  it("rate-limits a single IP", async () => {
    const r = () => new Request("http://localhost/", { headers: { "x-forwarded-for": "198.51.100.77" } });
    for (let i = 0; i < 20; i++) await login(r(), "nobody", "x").catch(() => undefined);
    await expect(login(r(), "owner1", PASSWORD)).rejects.toMatchObject({ status: 429 });
  });

  it("expires idle and old sessions", async () => {
    jar.clear();
    await login(req(), "owner1", PASSWORD);
    const token = jar.get(SESSION_COOKIE)!;
    expect(await validateToken(token, Date.now() + SESSION_IDLE_MS + 1000)).toBeNull();
    await login(req(), "owner1", PASSWORD);
    const t2 = jar.get(SESSION_COOKIE)!;
    expect(await validateToken(t2, Date.now() + SESSION_ABSOLUTE_MS + 1000)).toBeNull();
  });

  it("changing the password signs out other devices", async () => {
    jar.clear();
    await login(req(), "staff1", PASSWORD);
    const other = jar.get(SESSION_COOKIE)!;
    jar.clear();
    await login(req(), "staff1", PASSWORD);
    const current = (await readSession())!;
    await expect(changePassword(current, "wrong", "a-brand-new-passphrase")).rejects.toMatchObject({ code: "wrongPassword" });
    await changePassword(current, PASSWORD, "a-brand-new-passphrase");
    expect(await validateToken(other)).toBeNull();
    expect(await readSession()).not.toBeNull();
    await expect(login(req(), "staff1", PASSWORD)).rejects.toMatchObject({ code: "invalid" });
    await login(req(), "staff1", "a-brand-new-passphrase");
  });
});

describe("admin authorisation", () => {
  it("requires a session", async () => {
    jar.clear();
    await expect(requireAdminApi()).rejects.toMatchObject({ status: 401 });
    jar.set(SESSION_COOKIE, "forged-token");
    await expect(requireAdminApi()).rejects.toMatchObject({ status: 401 });
  });
  it("enforces owner-only operations", async () => {
    jar.clear();
    await login(req(), "staff1", "a-brand-new-passphrase");
    await expect(requireAdminApi()).resolves.toMatchObject({ role: "staff" });
    await expect(requireAdminApi("owner")).rejects.toMatchObject({ status: 403 });
    jar.clear();
    await login(req(), "owner1", PASSWORD);
    await expect(requireAdminApi("owner")).resolves.toMatchObject({ role: "owner" });
  });
});

describe("rate limiter", () => {
  it("counts atomically per window", async () => {
    const hits = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit("test", "abc", 60_000)));
    expect(hits.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
