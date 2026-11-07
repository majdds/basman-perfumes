/**
 * Business information for Basman Perfumes.
 *
 * VERIFIED values were read from the store's public social-media pages on
 * 2026-11-02 and should still be confirmed with the owners before launch.
 * PLACEHOLDER values are deliberately empty; the site hides the related UI
 * until the owner fills them in from the dashboard (Settings).
 *
 * Owners can override everything below from the dashboard → Settings.
 */
export const BUSINESS = {
  nameAr: "بسمان للعطور",
  nameEn: "Basman Perfumes",

  // VERIFIED — Facebook page "Basman بسمان" intro: "0569 398 080".
  phoneE164: "+970569398080",
  // ASSUMPTION — WhatsApp on the same mobile number. Confirm with owners.
  whatsappE164: "+970569398080",

  // VERIFIED — Instagram bio and Facebook: "رام الله شارع ركب مقابل الوردة الحمراء".
  address: {
    ar: "شارع ركب، مقابل الوردة الحمراء، رام الله، فلسطين",
    en: "Rukab Street, opposite Al-Warda Al-Hamra, Ramallah, Palestine",
  },
  city: { ar: "رام الله", en: "Ramallah" },
  country: "PS",

  // PLACEHOLDER — exact map pin not yet verified. Owners paste their Google Maps link in Settings.
  mapsUrl: null as string | null,
  // PLACEHOLDER — opening hours are not published on the public pages.
  hours: null as { ar: string; en: string } | null,

  // VERIFIED — official accounts supplied in the project brief.
  instagramUrl: "https://www.instagram.com/basman_perfumes/",
  facebookUrl: "https://www.facebook.com/BasmanRamallah/",

  // VERIFIED (self-declared) — both pages state the store was established in 1965.
  foundedYear: 1965,
} as const;
