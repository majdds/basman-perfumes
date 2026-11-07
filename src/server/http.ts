import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { env } from "./env";
import { getInstallSalt } from "./repos/settings";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return json({ error: e.code, details: e.details ?? null }, { status: e.status });
  }
  // Never leak internals: log server-side, return a generic error.
  console.error(JSON.stringify({ level: "error", msg: "unhandled", error: e instanceof Error ? e.message : String(e) }));
  return json({ error: "generic" }, { status: 500 });
}

/** Maps zod issues to { field.path: messageKey } for the UI to translate. */
export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (!out[path]) out[path] = issue.message && /^[a-zA-Z_]+$/.test(issue.message) ? issue.message : "invalid";
  }
  return out;
}

/**
 * CSRF defence for state-changing requests: the browser-provided Origin (or
 * Sec-Fetch-Site) must show the request came from this site. Combined with
 * SameSite=Strict session cookies.
 */
export function assertSameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "forbidden");
  const origin = req.headers.get("origin");
  if (!origin) {
    if (!site) throw new HttpError(403, "forbidden");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "forbidden");
  }
  const allowed = new Set([new URL(env().SITE_URL).host, host].filter(Boolean));
  if (!allowed.has(originHost)) throw new HttpError(403, "forbidden");
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "unsupported_media_type");
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, "payload_too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/**
 * Client IP for rate limiting. Behind CloudFront/Amplify the real client
 * address is appended to X-Forwarded-For by the trusted proxy; the left-most
 * entries can be forged by the client, so we count PROXY_HOPS from the right.
 */
export function clientIp(req: Request): string {
  if (env().TRUST_PROXY !== "true") return "local";
  const viewer = req.headers.get("cloudfront-viewer-address");
  if (viewer) return viewer.replace(/:\d+$/, "");
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hops = Math.max(1, Number(process.env.PROXY_HOPS ?? "1") || 1);
  return xff[xff.length - hops] ?? xff[0] ?? "unknown";
}

/** Pseudonymous identifier for an IP (salted SHA-256) — raw IPs are never stored. */
export async function ipKey(req: Request): Promise<string> {
  const salt = await getInstallSalt();
  return createHash("sha256").update(salt).update(clientIp(req)).digest("hex").slice(0, 32);
}
