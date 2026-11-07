import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["ar", "en"] as const;
const LOCALE_COOKIE = "basman_locale";

function pickLocale(req: NextRequest): "ar" | "en" {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie === "ar" || cookie === "en") return cookie;
  // Arabic is the default; only switch for browsers that clearly prefer English and not Arabic.
  const accept = req.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accept.startsWith("en") && !accept.includes("ar")) return "en";
  return "ar";
}

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const media = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ? new URL(process.env.NEXT_PUBLIC_MEDIA_BASE_URL).origin : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Next.js and React inject inline style attributes; styles cannot execute script.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${media}`.trim(),
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    ...(process.env.APP_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const segment = pathname.split("/")[1];

  if (!LOCALES.includes(segment as (typeof LOCALES)[number])) {
    const url = req.nextUrl.clone();
    url.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-locale", segment!);
  headers.set("x-pathname", pathname);
  headers.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  // Remember the visitor's language choice.
  if (req.cookies.get(LOCALE_COOKIE)?.value !== segment) {
    res.cookies.set(LOCALE_COOKIE, segment!, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.APP_ENV === "production" });
  }
  if (pathname.includes("/admin")) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  // Everything except API routes, media, Next internals and files with an extension.
  matcher: ["/((?!api|media|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
