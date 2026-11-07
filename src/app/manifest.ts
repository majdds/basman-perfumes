import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "بسمان للعطور — Basman Perfumes",
    short_name: "بسمان",
    start_url: "/ar",
    display: "browser",
    background_color: "#FBF8F3",
    theme_color: "#7A1E22",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
