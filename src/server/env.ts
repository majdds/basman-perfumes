import "server-only";
import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  AWS_REGION: z.string().min(1).default("eu-central-1"),
  DYNAMODB_TABLE: z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/).default("basman-dev"),
  DYNAMODB_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  MEDIA_BASE_URL: z.string().optional(),
  SES_FROM_ADDRESS: z.string().optional(),
  ORDER_NOTIFY_EMAIL: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Never print values — only which variables are wrong.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${names}`);
  }
  const e = parsed.data;
  if (e.APP_ENV === "production") {
    if (e.DYNAMODB_ENDPOINT) throw new Error("DYNAMODB_ENDPOINT must not be set in production");
    if (e.STORAGE_DRIVER !== "s3") throw new Error("STORAGE_DRIVER must be s3 in production");
    if (!e.S3_BUCKET || !e.MEDIA_BASE_URL) throw new Error("S3_BUCKET and MEDIA_BASE_URL are required in production");
    if (!e.SITE_URL.startsWith("https://")) throw new Error("SITE_URL must use https in production");
  }
  cached = e;
  return e;
}

export const isProduction = () => env().APP_ENV === "production";

/** Test helper: forget cached env after changing process.env. */
export function resetEnvCache() {
  cached = null;
}
