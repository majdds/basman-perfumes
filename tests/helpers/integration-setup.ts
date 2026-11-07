/**
 * Integration tests run against DynamoDB Local (the official AWS emulator).
 * Each run uses a fresh, uniquely-named table which is deleted afterwards.
 * Start it with:  npm run db:local   (or set DYNAMODB_ENDPOINT to another instance)
 */
import { DeleteTableCommand, DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTable } from "../../scripts/create-table";

export default async function setup({ provide }: { provide: (k: string, v: string) => void }) {
  const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
  const table = `basman-it-${Date.now()}`;
  const client = new DynamoDBClient({ region: "eu-central-1", endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } });
  try {
    await client.send(new ListTablesCommand({}));
  } catch {
    throw new Error(`DynamoDB Local is not reachable at ${endpoint}. Run "npm run db:local" first.`);
  }
  await createTable(table, endpoint);
  const uploads = mkdtempSync(join(tmpdir(), "basman-uploads-"));
  provide("table", table);
  provide("endpoint", endpoint);
  provide("uploads", uploads);
  return async () => {
    await client.send(new DeleteTableCommand({ TableName: table })).catch(() => undefined);
    rmSync(uploads, { recursive: true, force: true });
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    table: string;
    endpoint: string;
    uploads: string;
  }
}
