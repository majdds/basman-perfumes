"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconClose, IconMenu, IconSearch } from "../ui/icons";

interface Props {
  links: { href: string; label: string }[];
  searchAction: string;
  searchPlaceholder: string;
  searchLabel: string;
  menuLabel: string;
  closeLabel: string;
  dir: "rtl" | "ltr";
}

export function MobileNav({ links, searchAction, searchPlaceholder, searchLabel, menuLabel, closeLabel, dir }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm px-3 lg:hidden" aria-label={menuLabel} aria-expanded={open} onClick={() => setOpen(true)}>
        <IconMenu />
      </button>
      <dialog
        ref={dialog}
        dir={dir}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-0 ms-auto h-dvh max-h-dvh w-[86vw] max-w-sm bg-ivory p-0 backdrop:bg-charcoal/40"
        aria-label={menuLabel}
      >
        <div className="flex h-full flex-col p-5">
          <div className="flex justify-end">
            <button type="button" className="btn btn-ghost btn-sm px-3" onClick={() => setOpen(false)} aria-label={closeLabel}>
              <IconClose />
            </button>
          </div>
          <form action={searchAction} method="get" role="search" className="mt-2 flex gap-2">
            <label htmlFor="m-search" className="sr-only">{searchLabel}</label>
            <input id="m-search" name="q" type="search" className="input" placeholder={searchPlaceholder} enterKeyHint="search" />
            <button className="btn btn-dark px-4" aria-label={searchLabel}><IconSearch /></button>
          </form>
          <nav className="mt-6">
            <ul className="divide-y divide-sand">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block py-4 text-xl font-[family-name:var(--font-display)] text-charcoal">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
