import "server-only";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata as SharpMetadata, type OutputInfo } from "sharp";
import { storage } from "../storage";
import { HttpError } from "../http";
import { IMAGE_WIDTHS } from "@/lib/media";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // ~ 8000×5000; blocks decompression bombs
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Detects the real file type from its first bytes (never trust the file name or Content-Type). */
export function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export interface ProcessedImage {
  key: string;
  width: number;
  height: number;
}

/**
 * Validates and re-encodes an uploaded image:
 *  1. size limit, 2. magic-byte sniffing, 3. sharp decodes it with a pixel
 *  limit (rejects corrupt files and decompression bombs), 4. re-encodes to
 *  WebP at 400/800/1200 px. Re-encoding strips EXIF/GPS metadata and any
 *  payload appended to the file. Originals are never stored.
 */
export async function processProductImage(buf: Buffer): Promise<ProcessedImage> {
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "file_too_large");
  const sniffed = sniffImageType(buf);
  if (!sniffed) throw new HttpError(415, "unsupported_file_type");

  let meta: SharpMetadata;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new HttpError(422, "corrupt_image");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format) || meta.format !== sniffed) {
    throw new HttpError(415, "unsupported_file_type");
  }
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) throw new HttpError(422, "image_too_small");

  const id = randomUUID();
  const key = `products/${id}`;
  let outW = 0;
  let outH = 0;
  const s = storage();
  for (const width of IMAGE_WIDTHS) {
    let out: { data: Buffer; info: OutputInfo };
    try {
      out = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" })
        .rotate() // respect EXIF orientation before metadata is stripped
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new HttpError(422, "corrupt_image");
    }
    if (width === 1200) {
      outW = out.info.width;
      outH = out.info.height;
    }
    await s.put(`${key}-${width}.webp`, out.data, "image/webp");
  }
  return { key, width: outW, height: outH };
}

export async function deleteImages(keys: string[]): Promise<void> {
  await storage().remove(keys.flatMap((k) => IMAGE_WIDTHS.map((w) => `${k}-${w}.webp`)));
}
