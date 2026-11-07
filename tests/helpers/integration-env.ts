import { inject, vi } from "vitest";

process.env.APP_ENV = "test";
process.env.DYNAMODB_TABLE = inject("table");
process.env.DYNAMODB_ENDPOINT = inject("endpoint");
process.env.STORAGE_DRIVER = "local";
process.env.TRUST_PROXY = "true";
process.env.SITE_URL = "http://localhost:3000";

// Images are written under <cwd>/.data/uploads by the local driver; run each
// test file from a temporary working directory so tests never touch dev data.
process.chdir(inject("uploads"));

// Minimal in-memory stand-in for next/headers cookies() used by the session code.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
(globalThis as unknown as { __cookieJar: Map<string, string> }).__cookieJar = jar;
