#!/usr/bin/env node
// Starts DynamoDB Local (official AWS build, requires Java 17+) for development
// and tests. Downloads it once into .data/dynamodb-local and verifies the
// SHA-256 checksum published by AWS before extracting.
//
//   node scripts/dynamodb-local.mjs            # persistent, data in .data/ddb
//   node scripts/dynamodb-local.mjs --memory   # in-memory (tests)
//   PORT=8001 node scripts/dynamodb-local.mjs --memory
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dir = join(root, ".data", "dynamodb-local");
const url = "https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz";

async function ensureInstalled() {
  if (existsSync(join(dir, "DynamoDBLocal.jar"))) return;
  mkdirSync(dir, { recursive: true });
  console.log("Downloading DynamoDB Local from AWS…");
  const [tar, sum] = await Promise.all([fetch(url), fetch(url + ".sha256")]);
  if (!tar.ok || !sum.ok) throw new Error(`Download failed: ${tar.status}/${sum.status}`);
  const buf = Buffer.from(await tar.arrayBuffer());
  const expected = (await sum.text()).trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(buf).digest("hex");
  if (expected !== actual) throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  const archive = join(dir, "ddb.tar.gz");
  writeFileSync(archive, buf);
  execFileSync("tar", ["-xzf", archive, "-C", dir]);
  console.log("DynamoDB Local installed (checksum verified).");
}

await ensureInstalled();
const port = process.env.PORT ?? "8000";
const memory = process.argv.includes("--memory");
const args = ["-Djava.library.path=" + join(dir, "DynamoDBLocal_lib"), "-jar", join(dir, "DynamoDBLocal.jar"), "-port", port, "-disableTelemetry"];
if (memory) args.push("-inMemory");
else {
  const dbPath = join(root, ".data", "ddb");
  mkdirSync(dbPath, { recursive: true });
  args.push("-sharedDb", "-dbPath", dbPath);
}
console.log(`DynamoDB Local on http://localhost:${port} (${memory ? "in-memory" : "persistent"})`);
const child = spawn("java", args, { stdio: "inherit", cwd: dir });
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
// Keep a marker so tooling can tell the jar version that was verified.
if (!existsSync(join(dir, "VERIFIED"))) writeFileSync(join(dir, "VERIFIED"), readFileSync(join(dir, "DynamoDBLocal.jar")).length + "\n");
