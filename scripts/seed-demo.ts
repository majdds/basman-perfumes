/**
 * Seeds CLEARLY MARKED DEMO content so the store can be presented before the
 * owners add their real inventory:
 *   - demo categories and products (isDemo = true, brand "DEMO", names end with "(تجريبي) / (Demo)")
 *   - generated bottle images with a visible "DEMO" mark
 *   - delivery areas with PLACEHOLDER fees (only if none are configured)
 *
 * Everything demo can be removed in one click from the dashboard.
 *
 *   npm run db:seed-demo
 */
import sharp from "sharp";
import { adminCreateProduct, adminSaveCategory } from "../src/server/services/admin-catalog";
import { processProductImage } from "../src/server/services/images";
import { listAllProducts, listCategories } from "../src/server/repos/products";
import { getSettings, putSettings } from "../src/server/repos/settings";
import { shekelsToAgorot } from "../src/lib/money";
import type { ProductInput } from "../src/lib/validation";

function bottleSvg(liquid: string, accent: string, shape: "tall" | "round" | "square"): string {
  const body =
    shape === "round"
      ? `<ellipse cx="600" cy="930" rx="300" ry="330" fill="url(#glass)"/><ellipse cx="600" cy="980" rx="250" ry="250" fill="url(#liquid)" opacity=".92"/>`
      : shape === "square"
        ? `<rect x="330" y="560" width="540" height="680" rx="46" fill="url(#glass)"/><rect x="372" y="700" width="456" height="500" rx="28" fill="url(#liquid)" opacity=".92"/>`
        : `<rect x="390" y="520" width="420" height="760" rx="80" fill="url(#glass)"/><rect x="425" y="660" width="350" height="580" rx="56" fill="url(#liquid)" opacity=".92"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#FBF7F0"/><stop offset="1" stop-color="#EADFCB"/></radialGradient>
    <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity=".5"/></linearGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${liquid}" stop-opacity=".75"/><stop offset="1" stop-color="${liquid}"/></linearGradient>
    <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#8A6A35"/><stop offset=".45" stop-color="#E3C88F"/><stop offset="1" stop-color="#8A6A35"/></linearGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#bg)"/>
  <ellipse cx="600" cy="1300" rx="360" ry="40" fill="#000" opacity=".08"/>
  ${body}
  <rect x="530" y="430" width="140" height="110" rx="10" fill="url(#cap)"/>
  <rect x="505" y="300" width="190" height="150" rx="22" fill="${accent}"/>
  <rect x="470" y="${shape === "round" ? 900 : 860}" width="260" height="120" rx="8" fill="#FBF7F0" opacity=".9"/>
  <text x="600" y="${shape === "round" ? 975 : 935}" font-family="Georgia, serif" font-size="56" letter-spacing="10" text-anchor="middle" fill="#5C1519">DEMO</text>
  <text x="600" y="1430" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="6" text-anchor="middle" fill="#8A7D6E">DEMO IMAGE</text>
</svg>`;
}

async function demoImage(liquid: string, accent: string, shape: "tall" | "round" | "square") {
  const png = await sharp(Buffer.from(bottleSvg(liquid, accent, shape))).png().toBuffer();
  return processProductImage(png);
}

type Demo = Omit<ProductInput, "images" | "categoryId" | "slug"> & {
  category: string;
  look: [string, string, "tall" | "round" | "square"];
  daysAgo: number;
};

const v = (ar: string, en: string, ml: number, price: number, opts: { sale?: number; stock?: number | null } = {}) => ({
  label: { ar, en },
  sizeMl: ml,
  sku: null,
  price: shekelsToAgorot(price),
  salePrice: opts.sale ? shekelsToAgorot(opts.sale) : null,
  trackStock: opts.stock !== null && opts.stock !== undefined,
  stock: opts.stock ?? null,
});

const DEMOS: Demo[] = [
  {
    name: { ar: "عود الليل (تجريبي)", en: "Oud Al Layl (Demo)" },
    brand: "DEMO",
    description: {
      ar: "منتج تجريبي لعرض شكل الموقع. عطر شرقي دافئ بلمسات العود والعنبر.",
      en: "Demo product to showcase the website. A warm oriental scent with oud and amber accords.",
    },
    category: "oriental",
    gender: "unisex",
    fragranceFamily: { ar: "شرقي", en: "Oriental" },
    variants: [v("50 مل", "50 ml", 50, 180, { stock: 12 }), v("100 مل", "100 ml", 100, 290, { stock: 6 })],
    featured: true,
    available: true,
    look: ["#4A1A12", "#2B1A14", "tall"],
    daysAgo: 30,
  },
  {
    name: { ar: "زهر الياسمين (تجريبي)", en: "Jasmine Bloom (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. عطر زهري ناعم بنفحات الياسمين.", en: "Demo product. A soft floral scent with jasmine notes." },
    category: "perfumes",
    gender: "women",
    fragranceFamily: { ar: "زهري", en: "Floral" },
    variants: [v("90 مل", "90 ml", 90, 320, { sale: 270, stock: 8 })],
    featured: true,
    available: true,
    look: ["#E8B4B8", "#F4E4E1", "round"],
    daysAgo: 20,
  },
  {
    name: { ar: "خشب الأرز (تجريبي)", en: "Cedar Wood (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. عطر خشبي منعش.", en: "Demo product. A fresh woody fragrance." },
    category: "perfumes",
    gender: "men",
    fragranceFamily: { ar: "خشبي", en: "Woody" },
    variants: [v("100 مل", "100 ml", 100, 250, { stock: 2 })],
    featured: true,
    available: true,
    look: ["#5B6B4A", "#1F1B18", "square"],
    daysAgo: 12,
  },
  {
    name: { ar: "مسك أبيض (تجريبي)", en: "White Musk (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. مسك نظيف وناعم للاستخدام اليومي.", en: "Demo product. A clean, soft musk for everyday wear." },
    category: "oriental",
    gender: "unisex",
    fragranceFamily: { ar: "مسكي", en: "Musk" },
    variants: [v("30 مل", "30 ml", 30, 60), v("50 مل", "50 ml", 50, 90)],
    featured: false,
    available: true,
    look: ["#EFE6D8", "#C9B48A", "tall"],
    daysAgo: 8,
  },
  {
    name: { ar: "عنبر ذهبي (تجريبي)", en: "Golden Amber (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. عنبر دافئ بلمسة فانيلا.", en: "Demo product. Warm amber with a touch of vanilla." },
    category: "oriental",
    gender: "women",
    fragranceFamily: { ar: "عنبري", en: "Amber" },
    variants: [v("75 مل", "75 ml", 75, 210, { sale: 175, stock: 0 })],
    featured: false,
    available: true,
    look: ["#C08A2E", "#7A1E22", "round"],
    daysAgo: 5,
  },
  {
    name: { ar: "نسيم البحر (تجريبي)", en: "Sea Breeze (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. عطر منعش بنفحات بحرية.", en: "Demo product. A fresh fragrance with marine notes." },
    category: "perfumes",
    gender: "men",
    fragranceFamily: { ar: "منعش", en: "Fresh" },
    variants: [v("100 مل", "100 ml", 100, 230, { stock: 15 }), v("200 مل", "200 ml", 200, 360, { stock: 4 })],
    featured: false,
    available: true,
    look: ["#4F7A94", "#E6DCCB", "tall"],
    daysAgo: 3,
  },
  {
    name: { ar: "ورد طائفي (تجريبي)", en: "Taif Rose (Demo)" },
    brand: "DEMO",
    description: { ar: "منتج تجريبي. ورد شرقي غني.", en: "Demo product. A rich oriental rose." },
    category: "oriental",
    gender: "women",
    fragranceFamily: { ar: "وردي", en: "Rose" },
    variants: [v("50 مل", "50 ml", 50, 150)],
    featured: true,
    available: true,
    look: ["#8E2A3A", "#B8955A", "square"],
    daysAgo: 1,
  },
  {
    name: { ar: "علبة هدايا كلاسيك (تجريبي)", en: "Classic Gift Set (Demo)" },
    brand: "DEMO",
    description: {
      ar: "منتج تجريبي. مثال على منتج بدون حجم بالمل لإظهار مرونة النظام.",
      en: "Demo product. An example of a product without a size in ml, showing the catalogue's flexibility.",
    },
    category: "gifts",
    gender: null,
    fragranceFamily: { ar: null, en: null },
    variants: [{ label: { ar: null, en: null }, sizeMl: null, sku: null, price: shekelsToAgorot(340), salePrice: null, trackStock: true, stock: 5 }],
    featured: false,
    available: true,
    look: ["#7A1E22", "#1F1B18", "square"],
    daysAgo: 0,
  },
];

async function main() {
  const existing = await listAllProducts();
  if (existing.some((p) => p.isDemo)) {
    console.log("Demo products already present — nothing to do.");
    return;
  }
  const cats = await listCategories();
  const catDefs: Record<string, { ar: string; en: string; order: number }> = {
    perfumes: { ar: "عطور عالمية", en: "International perfumes", order: 1 },
    oriental: { ar: "عطور شرقية", en: "Oriental perfumes", order: 2 },
    gifts: { ar: "هدايا", en: "Gifts", order: 3 },
  };
  const catIds: Record<string, string> = {};
  for (const [key, def] of Object.entries(catDefs)) {
    const found = cats.find((c) => c.name.en === def.en);
    catIds[key] = found ? found.id : (await adminSaveCategory({ name: { ar: def.ar, en: def.en }, sortOrder: def.order }, undefined, true)).id;
  }

  for (const d of DEMOS) {
    const img = await demoImage(...d.look);
    const { look: _look, category, daysAgo, ...rest } = d;
    void _look;
    await adminCreateProduct(
      { ...rest, slug: null, categoryId: catIds[category]!, images: [img] },
      { isDemo: true, createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() },
    );
    console.log(`  + ${d.name.en}`);
  }

  const settings = await getSettings();
  if (settings.deliveryAreas.length === 0) {
    // PLACEHOLDER FEES — the owners must set their real delivery fees in Settings.
    settings.deliveryAreas = [
      { id: "ramallah", name: { ar: "رام الله والبيرة", en: "Ramallah & Al-Bireh" }, fee: shekelsToAgorot(20), freeOver: null, active: true },
      { id: "westbank", name: { ar: "باقي مدن الضفة الغربية", en: "Other West Bank cities" }, fee: shekelsToAgorot(30), freeOver: null, active: true },
      { id: "jerusalem", name: { ar: "القدس", en: "Jerusalem" }, fee: shekelsToAgorot(40), freeOver: null, active: true },
      { id: "inside48", name: { ar: "الداخل المحتل", en: "1948 areas" }, fee: shekelsToAgorot(70), freeOver: null, active: true },
    ];
    settings.updatedAt = new Date().toISOString();
    await putSettings(settings);
    console.log("  + delivery areas with PLACEHOLDER fees (owners must confirm in Settings)");
  }
  console.log(`Seeded ${DEMOS.length} demo products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
