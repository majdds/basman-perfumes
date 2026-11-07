import { pathToFileURL } from "node:url";
/**
 * Creates (or resets the password of) a dashboard account. This is the ONLY
 * way to create accounts — there is no public registration.
 *
 *   npm run admin:create -- --username owner --name "Abu Basman" --role owner
 *   npm run admin:create -- --username owner --reset
 *
 * The password is read from the terminal without echo (or from the
 * ADMIN_PASSWORD environment variable for automated test setups).
 */
import { parseArgs } from "node:util";
import { hashPassword } from "../src/server/auth/password";
import { getAdmin, putAdmin, setAdminPassword, deleteUserSessions } from "../src/server/repos/admins";
import { newPasswordSchema } from "../src/lib/validation";

async function readHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error("No terminal available. Set ADMIN_PASSWORD instead.");
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") process.exit(130);
      else if (ch === "\u007f") value = value.slice(0, -1);
      else value += ch;
    };
    stdin.on("data", onData);
  });
}

export async function createAdmin(username: string, displayName: string, role: "owner" | "staff", password: string, reset = false) {
  const check = newPasswordSchema.safeParse(password);
  if (!check.success) throw new Error("Password must be at least 12 characters and not trivially weak.");
  const existing = await getAdmin(username);
  if (existing && !reset) throw new Error(`User "${username}" already exists. Use --reset to change the password.`);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await setAdminPassword(username, passwordHash);
    await deleteUserSessions(username);
    return "reset";
  }
  const now = new Date().toISOString();
  await putAdmin({ username, displayName, role, passwordHash, createdAt: now, passwordChangedAt: now, disabled: false }, { mustNotExist: true });
  return "created";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "owner" },
      reset: { type: "boolean", default: false },
    },
  });
  const username = (values.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    console.error("Usage: npm run admin:create -- --username <name> [--name \"Display Name\"] [--role owner|staff] [--reset]");
    process.exit(1);
  }
  const role = values.role === "staff" ? "staff" : "owner";
  (async () => {
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await readHidden("New password (min 12 characters): ");
      const again = await readHidden("Repeat password: ");
      // eslint-disable-next-line security/detect-possible-timing-attacks -- local interactive confirmation, no remote observer
      if (password !== again) throw new Error("Passwords do not match.");
    }
    const result = await createAdmin(username, values.name ?? username, role, password, values.reset);
    console.log(result === "created" ? `Account "${username}" created (${role}).` : `Password reset for "${username}". All sessions signed out.`);
  })().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
