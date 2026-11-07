"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBox, IconHome, IconList, IconSettings, IconTag } from "../ui/icons";

const ICONS = { overview: IconHome, orders: IconList, products: IconBox, categories: IconTag, settings: IconSettings };

export function AdminNav({ items, variant }: { items: { key: keyof typeof ICONS; href: string; label: string; badge?: number }[]; variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string, key: string) => (key === "overview" ? pathname === href : pathname.startsWith(href));
  if (variant === "bottom") {
    return (
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-ivory/95 backdrop-blur lg:hidden" aria-label="admin">
        <ul className="grid grid-cols-5">
          {items.map((it) => {
            const Icon = ICONS[it.key];
            const active = isActive(it.href, it.key);
            return (
              <li key={it.key}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${active ? "text-burgundy" : "text-muted"}`}>
                  <Icon size={24} />
                  {it.label}
                  {it.badge ? <span className="ltr-nums absolute top-1 start-1/2 ms-2 rounded-full bg-burgundy px-1.5 text-[0.7rem] text-ivory">{it.badge}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label="admin">
      <ul className="space-y-1">
        {items.map((it) => {
          const Icon = ICONS[it.key];
          const active = isActive(it.href, it.key);
          return (
            <li key={it.key}>
              <Link href={it.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-lg font-semibold ${active ? "bg-burgundy text-ivory" : "text-ink hover:bg-cream"}`}>
                <Icon /> <span className="flex-1">{it.label}</span>
                {it.badge ? <span className={`ltr-nums rounded-full px-2 text-sm ${active ? "bg-ivory text-burgundy" : "bg-burgundy text-ivory"}`}>{it.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
