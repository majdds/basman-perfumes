import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { createTable } from "../../scripts/create-table";
import config, { E2E_TABLE } from "../../playwright.config";

/**
 * Fresh table, demo catalogue and a randomly generated admin password for
 * every run. Test data only — no real customer information is ever used.
 */
export default async function globalSetup() {
  const env = config.metadata!.env as Record<string, string>;
  const endpoint = env.DYNAMODB_ENDPOINT!;
  const client = new DynamoDBClient({ region: "eu-central-1", endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } });
  await client.send(new DeleteTableCommand({ TableName: E2E_TABLE })).catch(() => undefined);
  await createTable(E2E_TABLE, endpoint);

  const password = randomBytes(18).toString("base64url");
  const childEnv = { ...process.env, ...env, ADMIN_PASSWORD: password };
  const tsx = ["tsx", "--conditions=react-server"];
  execFileSync("npx", [...tsx, "scripts/seed-demo.ts"], { env: childEnv, stdio: "inherit" });
  execFileSync("npx", [...tsx, "scripts/create-admin.ts", "--username", "e2e-owner", "--name", "E2E Owner", "--role", "owner"], { env: childEnv, stdio: "inherit" });
  execFileSync("npx", [...tsx, "scripts/create-admin.ts", "--username", "e2e-staff", "--name", "E2E Staff", "--role", "staff"], { env: childEnv, stdio: "inherit" });
  process.env.E2E_ADMIN_PASSWORD = password;
}
