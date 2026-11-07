import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "../globals.css";
import { fontVariables } from "../fonts";
import { dir, getDictionary, isLocale } from "@/lib/i18n";
import { siteUrl } from "@/server/page-helpers";
import { notFound } from "next/navigation";

// Every page is rendered per request: it needs a fresh CSP nonce and live
// catalogue data (prices/stock), so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : "ar");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${dict.meta.siteName} — ${dict.meta.tagline}`, template: `%s | ${dict.meta.siteName}` },
    description: dict.meta.description,
    applicationName: dict.meta.siteName,
    formatDetection: { telephone: false },
    icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Reading headers opts into dynamic rendering so Next can apply the per-request CSP nonce.
  await headers();
  return (
    <html lang={locale} dir={dir(locale)} className={fontVariables}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
