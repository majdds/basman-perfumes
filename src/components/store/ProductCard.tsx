import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { pick } from "@/lib/i18n";
import { fromPrice, productAvailability } from "@/lib/catalog";
import type { Locale, Product } from "@/lib/types";
import { Price } from "../ui/Price";
import { ProductImage } from "./ProductImage";

export function ProductCard({
  product,
  locale,
  dict,
  lowStockThreshold,
  priority = false,
}: {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  lowStockThreshold: number;
  priority?: boolean;
}) {
  const name = pick(product.name, locale);
  const price = fromPrice(product);
  const availability = productAvailability(product, lowStockThreshold);
  const onSale = price.salePrice !== null;
  return (
    <article className="group relative flex flex-col" data-testid="product-card">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-cream">
        <ProductImage
          image={product.images[0]}
          alt={name}
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {onSale ? <span className="badge bg-burgundy text-ivory">{dict.product.sale}</span> : null}
          {product.isDemo ? <span className="badge bg-white/90 text-muted">{dict.common.demo}</span> : null}
        </div>
        {availability === "out_of_stock" || availability === "unavailable" ? (
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-ivory/90 py-1.5 text-center text-sm font-semibold text-muted">
            {availability === "out_of_stock" ? dict.product.outOfStock : dict.product.unavailable}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="eyebrow">{product.brand}</p>
        <h3 className="mt-1 text-lg leading-snug">
          <Link href={`/${locale}/products/${encodeURIComponent(product.slug)}`} className="after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
        </h3>
        <div className="mt-2">
          <Price price={price.price} salePrice={price.salePrice} locale={locale} wasLabel={dict.product.priceWas} />
        </div>
      </div>
    </article>
  );
}
