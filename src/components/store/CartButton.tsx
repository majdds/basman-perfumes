"use client";

import Link from "next/link";
import { useCartCount } from "../cart/cart-store";
import { IconBag } from "../ui/icons";
import type { Locale } from "@/lib/types";

export function CartButton({ locale, labelFor }: { locale: Locale; labelFor: { zero: string; one: string; many: string } }) {
  const count = useCartCount();
  const label = count === 0 ? labelFor.zero : (count === 1 ? labelFor.one : labelFor.many).replace("{n}", String(count));
  return (
    <Link href={`/${locale}/cart`} className="btn btn-ghost btn-sm relative px-3" aria-label={label} data-testid="cart-button">
      <IconBag size={22} />
      <span
        className={`absolute -top-0.5 end-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-burgundy px-1 text-[0.7rem] font-bold text-ivory ltr-nums ${count ? "" : "hidden"}`}
        aria-hidden="true"
        data-testid="cart-count"
      >
        {count}
      </span>
    </Link>
  );
}
