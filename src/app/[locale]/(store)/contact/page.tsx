import type { Metadata } from "next";
import { pageMetadata, resolveLocale } from "@/server/page-helpers";
import { getCatalog } from "@/server/services/catalog";
import { storeJsonLd } from "@/server/structured-data";
import { pick } from "@/lib/i18n";
import { formatPhoneForDisplay, parsePalestinianPhone, whatsappLink } from "@/lib/phone";
import { JsonLd } from "@/components/seo/JsonLd";
import { IconClock, IconFacebook, IconInstagram, IconPhone, IconPin, IconWhatsapp } from "@/components/ui/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return pageMetadata({ locale, path: "/contact", title: dict.contact.title, description: `${dict.contact.intro} ${pick({ ar: "رام الله، شارع ركب", en: "Rukab Street, Ramallah" }, locale)}` });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { settings } = await getCatalog();
  const phone = parsePalestinianPhone(settings.phone);
  const wa = parsePalestinianPhone(settings.whatsapp);
  return (
    <div className="container-page max-w-5xl py-12 md:py-16">
      <JsonLd data={storeJsonLd(settings, locale)} />
      <h1 className="text-4xl">{dict.contact.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted">{dict.contact.intro}</p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {phone ? (
          <a href={`tel:${phone.e164}`} className="card group flex items-center gap-5 p-6 hover:border-champagne">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cream text-burgundy"><IconPhone size={26} /></span>
            <span><span className="block text-sm text-muted">{dict.contact.phone}</span><span className="ltr-nums text-xl font-semibold text-charcoal">{formatPhoneForDisplay(phone.national)}</span></span>
          </a>
        ) : null}
        <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="card group flex items-center gap-5 p-6 hover:border-champagne">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-success-soft text-success"><IconWhatsapp size={26} /></span>
          <span><span className="block text-sm text-muted">{dict.contact.whatsapp}</span><span className="ltr-nums text-xl font-semibold text-charcoal">{wa ? formatPhoneForDisplay(wa.national) : dict.common.whatsapp}</span></span>
        </a>
        <div className="card flex items-start gap-5 p-6">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cream text-burgundy"><IconPin size={26} /></span>
          <span>
            <span className="block text-sm text-muted">{dict.contact.address}</span>
            <span className="text-lg font-semibold text-charcoal">{pick(settings.addressText, locale)}</span>
            {settings.mapsUrl ? (
              <a href={settings.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block link-underline text-burgundy">{dict.contact.directions}</a>
            ) : null}
          </span>
        </div>
        <div className="card flex items-start gap-5 p-6">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cream text-burgundy"><IconClock size={26} /></span>
          <span>
            <span className="block text-sm text-muted">{dict.contact.hours}</span>
            <span className="whitespace-pre-line text-lg text-charcoal">{pick(settings.hours, locale) || dict.contact.hoursPending}</span>
          </span>
        </div>
      </div>

      <h2 className="mt-14 text-2xl">{dict.contact.social}</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><IconInstagram /> Instagram</a>
        <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><IconFacebook /> Facebook</a>
      </div>
    </div>
  );
}
