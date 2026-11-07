import { Amiri, Aref_Ruqaa, Cormorant_Garamond, IBM_Plex_Sans_Arabic } from "next/font/google";

// Self-hosted at build time by next/font — no requests to Google from visitors.
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});
// Display faces are not preloaded: they would compete with the hero/product image for
// bandwidth on slow mobile connections. They swap in as soon as they arrive.
export const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-display-ar", display: "swap", preload: false });
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-en",
  display: "swap",
  preload: false,
});
export const ruqaa = Aref_Ruqaa({ subsets: ["arabic"], weight: ["700"], variable: "--font-ruqaa", display: "swap", preload: false });

export const fontVariables = [plexArabic.variable, amiri.variable, cormorant.variable, ruqaa.variable].join(" ");
