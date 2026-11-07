import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { getCatalog } from "@/server/services/catalog";
import { resolveLocale } from "@/server/page-helpers";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { settings } = await getCatalog();
  return (
    <>
      <Header locale={locale} dict={dict} settings={settings} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer locale={locale} dict={dict} settings={settings} />
    </>
  );
}
