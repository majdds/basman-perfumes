import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // sharp and argon2 ship native binaries; keep them out of the bundle.
  serverExternalPackages: ["sharp", "@node-rs/argon2"],
  images: { unoptimized: true },
  // Render <title>/<meta> in the document head for every client (not streamed),
  // so search engines and link-preview bots (WhatsApp, Facebook) always see them.
  htmlLimitedBots: /.*/,
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    // Static headers for every response. The Content-Security-Policy (which
    // needs a per-request nonce) is added in middleware.ts.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.APP_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
