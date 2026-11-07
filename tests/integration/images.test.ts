import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processProductImage, deleteImages } from "@/server/services/images";

const solid = (w: number, h: number, format: "png" | "jpeg" | "webp") =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#7A1E22" } })[format]().toBuffer();

describe("image upload pipeline", () => {
  it("re-encodes a valid image to three WebP sizes and strips metadata", async () => {
    const input = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#C4A46B" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } })
      .toBuffer();
    const img = await processProductImage(input);
    expect(img.key).toMatch(/^products\/[a-f0-9-]{36}$/);
    expect(img.width).toBe(1200);
    expect(img.height).toBe(1500);
    for (const w of [400, 800, 1200]) {
      const file = join(process.cwd(), ".data", "uploads", `${img.key}-${w}.webp`);
      expect(existsSync(file)).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
    await deleteImages([img.key]);
    expect(existsSync(join(process.cwd(), ".data", "uploads", `${img.key}-400.webp`))).toBe(false);
  });

  it("accepts PNG and WebP", async () => {
    await expect(processProductImage(await solid(400, 400, "png"))).resolves.toHaveProperty("key");
    await expect(processProductImage(await solid(400, 400, "webp"))).resolves.toHaveProperty("key");
  });

  it("rejects non-images regardless of what they claim to be", async () => {
    await expect(processProductImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"))).rejects.toMatchObject({ status: 415 });
    await expect(processProductImage(Buffer.from("GIF89a" + "x".repeat(100)))).rejects.toMatchObject({ status: 415 });
    await expect(processProductImage(Buffer.from("<?php system($_GET['c']); ?>"))).rejects.toMatchObject({ status: 415 });
  });

  it("rejects a file with an image signature but corrupt body", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("not really a jpeg".repeat(20))]);
    await expect(processProductImage(fake)).rejects.toMatchObject({ status: 422 });
  });

  it("rejects decompression bombs and tiny images", async () => {
    const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processProductImage(bomb)).rejects.toMatchObject({ status: 422 });
    await expect(processProductImage(await solid(50, 50, "png"))).rejects.toMatchObject({ code: "image_too_small" });
  });

  it("rejects empty and oversized uploads", async () => {
    await expect(processProductImage(Buffer.alloc(0))).rejects.toMatchObject({ status: 413 });
    await expect(processProductImage(Buffer.alloc(9 * 1024 * 1024))).rejects.toMatchObject({ status: 413 });
  });
});
