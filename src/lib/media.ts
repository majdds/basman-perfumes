/** Image URL helpers shared by server and client components. */
export const IMAGE_WIDTHS = [400, 800, 1200] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const base = () => (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "/media").replace(/\/$/, "");

export function imageUrl(key: string, width: ImageWidth = 800): string {
  return `${base()}/${key}-${width}.webp`;
}

export function imageSrcSet(key: string): string {
  return IMAGE_WIDTHS.map((w) => `${imageUrl(key, w)} ${w}w`).join(", ");
}
