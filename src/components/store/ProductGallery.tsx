"use client";

import { useState } from "react";
import { imageSrcSet, imageUrl } from "@/lib/media";
import type { ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./ProductImage";

export function ProductGallery({ images, name, labels }: { images: Img[]; name: string; labels: string[] }) {
  const imageLabel = (i: number) => labels[i - 1] ?? name;
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-xl)] bg-cream">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.key}
            src={imageUrl(current.key, 1200)}
            srcSet={imageSrcSet(current.key)}
            sizes="(min-width: 1024px) 560px, 100vw"
            width={current.width}
            height={current.height}
            alt={imageLabel(active + 1)}
            fetchPriority="high"
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          <ProductImage image={undefined} alt={name} sizes="100vw" />
        )}
      </div>
      {images.length > 1 ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.key}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={imageLabel(i + 1)}
                aria-current={i === active}
                className={`block w-20 overflow-hidden rounded-[var(--radius-md)] border-2 ${i === active ? "border-burgundy" : "border-transparent opacity-75 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(img.key, 400)} alt="" width={80} height={100} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
