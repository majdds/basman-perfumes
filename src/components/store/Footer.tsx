import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { pick } from "@/lib/i18n";
import { formatPhoneForDisplay, parsePalestinianPhone, whatsappLink } from "@/lib/phone";
import type { Locale, StoreSettings } from "@/lib/types";
import { IconCash, IconFacebook, IconInstagram, IconPhone, IconPin, IconWhatsapp } from "../ui/icons";

export function Footer({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: StoreSettings }) {
  const phone = parsePalestinianPhone(settings.phone);
  return (
    <footer className="mt-24 bg-charcoal text-[#d9d0c3]">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="font-[family-name:var(--font-wordmark)] text-4xl text-[#e8c9c6]" lang="ar">بسمان</p>
          <p className="mt-1 text-xs tracking-[0.35em] text-champagne" lang="en" dir="ltr">BASMAN PERFUMES</p>
          <p className="mt-5 max-w-md text-[#bfb5a8]">{dict.meta.tagline}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-champagne/40 px-4 py-1.5 text-sm text-champagne">
            <IconCash size={18} /> {dict.footer.cod}
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-base text-ivory">{dict.footer.explore}</h2>
          <ul className="space-y-2.5">
            <li><Link className="hover:text-ivory" href={`/${locale}/shop`}>{dict.shop.allProducts}</Link></li>
            <li><Link className="hover:text-ivory" href={`/${locale}/cart`}>{dict.nav.cart}</Link></li>
            <li><Link className="hover:text-ivory" href={`/${locale}/contact`}>{dict.nav.contact}</Link></li>
            <li><Link className="hover:text-ivory" href={`/${locale}/privacy`}>{dict.footer.privacy}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-base text-ivory">{dict.nav.contact}</h2>
          <ul className="space-y-3">
            <li className="flex gap-2.5"><IconPin size={20} className="mt-1 shrink-0 text-champagne" /><span>{pick(settings.addressText, locale)}</span></li>
            {phone ? (
              <li className="flex gap-2.5">
                <IconPhone size={20} className="mt-0.5 shrink-0 text-champagne" />
                <a href={`tel:${phone.e164}`} className="ltr-nums hover:text-ivory">{formatPhoneForDisplay(phone.national)}</a>
              </li>
            ) : null}
            <li className="flex gap-2.5">
              <IconWhatsapp size={20} className="mt-0.5 shrink-0 text-champagne" />
              <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-ivory">{dict.common.whatsapp}</a>
            </li>
          </ul>
          <div className="mt-5 flex gap-2">
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={dict.common.instagram} className="grid h-11 w-11 place-items-center rounded-full border border-[#4a423b] hover:border-champagne hover:text-ivory"><IconInstagram /></a>
            <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={dict.common.facebook} className="grid h-11 w-11 place-items-center rounded-full border border-[#4a423b] hover:border-champagne hover:text-ivory"><IconFacebook /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-[#3a332d]">
        <div className="container-page py-6 text-sm text-[#9d9387]">{dict.footer.rights(new Date().getFullYear())}</div>
      </div>
    </footer>
  );
}
