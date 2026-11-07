#!/usr/bin/env node
// Starts everything needed to use the store locally: DynamoDB Local (unless it
// is already running), then the Next.js dev server. Stopping this process
// stops both.
//   npm run start:local
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const DB_URL = "http://localhost:8000";
const children = [];

// DynamoDB answers unsigned requests with HTTP 400, which still means it is up.
const dbIsUp = () => fetch(DB_URL, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);

function run(args, env = {}) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  children.push(child);
  child.on("exit", (code) => stop(code ?? 0));
  return child;
}

function stop(code = 0) {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

if (!(await dbIsUp())) {
  // Pinned: hosts such as the preview pane set PORT for the web server.
  run(["scripts/dynamodb-local.mjs"], { PORT: "8000" });
  for (let i = 0; i < 60 && !(await dbIsUp()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await dbIsUp())) {
    console.error("DynamoDB Local did not start. Is Java 17+ installed?");
    stop(1);
  }
}
run(["node_modules/next/dist/bin/next", "dev", "-p", "3000"]);
