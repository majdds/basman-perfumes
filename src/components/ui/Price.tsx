import { formatPrice } from "@/lib/money";
import type { Locale } from "@/lib/types";

export function Price({
  price,
  salePrice,
  locale,
  from,
  fromLabel,
  wasLabel,
  size = "md",
}: {
  price: number;
  salePrice?: number | null;
  locale: Locale;
  from?: boolean;
  fromLabel?: string;
  wasLabel?: string;
  size?: "md" | "lg";
}) {
  const onSale = typeof salePrice === "number" && salePrice > 0 && salePrice < price;
  const main = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {from && fromLabel ? <span className="text-sm text-muted">{fromLabel}</span> : null}
      <span className={`ltr-nums font-semibold ${main} ${onSale ? "text-burgundy" : "text-charcoal"}`}>
        {formatPrice(onSale ? salePrice! : price, locale)}
      </span>
      {onSale ? (
        <s className="ltr-nums text-sm text-muted" aria-label={wasLabel ? `${wasLabel} ${formatPrice(price, locale)}` : undefined}>
          {formatPrice(price, locale)}
        </s>
      ) : null}
    </span>
  );
}
