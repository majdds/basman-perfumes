import { env } from "@/server/env";
import { OBJECT_KEY, readLocalObject } from "@/server/storage";

/**
 * Serves uploaded images in LOCAL development only. In production images are
 * served directly by CloudFront from the private S3 bucket.
 * The key is validated against a strict pattern (no "..", no other folders).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Not found", { status: 404 });
  const key = (await params).key.join("/");
  if (!OBJECT_KEY.test(key)) return new Response("Not found", { status: 404 });
  const data = await readLocalObject(key);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
