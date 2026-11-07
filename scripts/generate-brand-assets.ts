/**
 * Generates static brand images into public/: favicon (SVG), apple-touch icon
 * and Open Graph share images in Arabic and English (1200×630).
 * Text is drawn as vector paths from the bundled fonts' fallback via sharp/librsvg;
 * Arabic headlines are kept short and use the system Arabic font.
 *   npx tsx scripts/generate-brand-assets.ts
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const out = (f: string) => join(import.meta.dirname, "..", "public", f);

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7A1E22"/><path d="M20 46c6 2 18 2 24-4M24 18v20M32 14v22M40 18v20" stroke="#F4E3C3" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="32" cy="10" r="3" fill="#C4A46B"/></svg>`;
writeFileSync(out("icon.svg"), icon);

function og(title: string, subtitle: string, rtl: boolean) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#FBF8F3"/><stop offset="1" stop-color="#EFE5D5"/></linearGradient>
  <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#8A6A35"/><stop offset=".5" stop-color="#EAD3A0"/><stop offset="1" stop-color="#8A6A35"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#C4A46B" stroke-width="2"/>
  <g transform="translate(${rtl ? 100 : 800},90)">
    <path d="M0 450V170C0 76 70 10 160 10s160 66 160 160v280Z" fill="#F4EEE4" stroke="#C4A46B" stroke-width="2"/>
    <rect x="95" y="190" width="130" height="230" rx="18" fill="#7A1E22"/>
    <rect x="135" y="150" width="50" height="40" fill="url(#gold)"/>
    <path d="M125 80h70l-6 70h-58Z" fill="#1E1A17"/>
  </g>
  <text x="${rtl ? 1080 : 120}" y="270" text-anchor="${rtl ? "end" : "start"}" font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="700" fill="#7A1E22">${title}</text>
  <text x="${rtl ? 1080 : 120}" y="350" text-anchor="${rtl ? "end" : "start"}" font-family="Georgia, serif" font-size="30" letter-spacing="8" fill="#8A6A35">BASMAN PERFUMES · RAMALLAH</text>
  <text x="${rtl ? 1080 : 120}" y="430" text-anchor="${rtl ? "end" : "start"}" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#1E1A17">${subtitle}</text>
</svg>`;
}

async function main() {
  await sharp(Buffer.from(icon)).resize(180, 180).png().toFile(out("apple-icon.png"));
  // librsvg cannot shape Arabic reliably, so both share images use Latin text;
  // the Arabic page titles/descriptions are carried by the Open Graph meta tags.
  await sharp(Buffer.from(og("Basman", "Original fragrances · Cash on delivery", false))).png().toFile(out("og-en.png"));
  await sharp(Buffer.from(og("Basman", "Original fragrances · Cash on delivery", true))).png().toFile(out("og-ar.png"));
  console.log("Brand assets written to public/");
}
main();
