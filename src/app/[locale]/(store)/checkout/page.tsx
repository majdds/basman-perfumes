import type { Metadata } from "next";
import { resolveLocale } from "@/server/page-helpers";
import { getCatalog } from "@/server/services/catalog";
import { CheckoutFlow } from "@/components/cart/CheckoutFlow";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { dict } = await resolveLocale(params);
  return { title: dict.checkout.title, robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { settings } = await getCatalog();
  const areas = settings.deliveryAreas.map(({ id, name, fee, freeOver, active }) => ({ id, name, fee, freeOver, active }));
  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="mb-8 text-4xl">{dict.checkout.title}</h1>
      <CheckoutFlow locale={locale} areas={areas} orderingEnabled={settings.orderingEnabled} />
    </div>
  );
}
