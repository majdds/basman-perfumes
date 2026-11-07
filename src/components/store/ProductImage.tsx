import { imageSrcSet, imageUrl } from "@/lib/media";
import type { ProductImage as Img } from "@/lib/types";
import { IconImage } from "../ui/icons";

/** Responsive, lazy-loaded product image with fixed aspect ratio (no layout shift). */
export function ProductImage({
  image,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  image: Img | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div className={`grid aspect-[4/5] w-full place-items-center bg-cream text-line ${className}`} role="img" aria-label={alt}>
        <IconImage size={48} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images are pre-sized WebP renditions; next/image optimiser not needed
    <img
      src={imageUrl(image.key, 800)}
      srcSet={imageSrcSet(image.key)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={`aspect-[4/5] w-full bg-cream object-cover ${className}`}
    />
  );
}
