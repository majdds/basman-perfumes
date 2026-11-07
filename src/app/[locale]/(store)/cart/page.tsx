import type { Metadata } from "next";
import { resolveLocale } from "@/server/page-helpers";
import { CartView } from "@/components/cart/CartView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.cart.title, robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="mb-8 text-4xl">{dict.cart.title}</h1>
      <CartView locale={locale} />
    </div>
  );
}
