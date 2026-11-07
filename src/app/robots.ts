import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/page-helpers";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ar/admin", "/en/admin", "/ar/cart", "/en/cart", "/ar/checkout", "/en/checkout", "/ar/order/", "/en/order/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
