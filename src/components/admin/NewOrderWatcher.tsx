"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { IconBell } from "../ui/icons";

const POLL_MS = 20_000;

/**
 * Checks for new orders every 20 seconds while the dashboard is open.
 * When the number of new orders goes up it shows a banner, updates the tab
 * title and (if the owner turned it on) plays a short chime.
 */
export function NewOrderWatcher({ locale, initialNew }: { locale: Locale; initialNew: number }) {
  const dict = getDictionary(locale);
  const router = useRouter();
  const [count, setCount] = useState(initialNew);
  const [arrived, setArrived] = useState(0);
  const [sound, setSound] = useState(false);
  const baseline = useRef(initialNew);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    try {
      setSound(localStorage.getItem("basman_admin_sound") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/admin/orders/summary", { cache: "no-store", credentials: "same-origin" });
        if (res.status === 401) {
          window.location.href = `/${locale}/admin/login`;
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { newCount: number };
        if (stop) return;
        setCount(data.newCount);
        if (data.newCount > baseline.current) {
          setArrived(data.newCount - baseline.current);
          if (sound) chime();
          router.refresh();
        }
        baseline.current = data.newCount;
      } catch {
        /* offline: try again next tick */
      }
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [locale, router, sound]);

  useEffect(() => {
    document.title = count > 0 ? `(${count}) ${baseTitle.current || document.title}` : baseTitle.current || document.title;
  }, [count]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("basman_admin_sound", next ? "1" : "0");
    } catch {}
    if (next) chime();
  };

  return (
    <>
      {arrived > 0 ? (
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-burgundy px-4 py-3 text-ivory" role="alert">
          <IconBell /> <strong className="text-lg">{dict.admin.orders.newOrderAlert(arrived)}</strong>
          <Link href={`/${locale}/admin/orders?status=new`} className="btn btn-sm bg-ivory text-burgundy" onClick={() => setArrived(0)}>
            {dict.admin.overview.seeNewOrders}
          </Link>
          <button className="btn btn-sm btn-ghost text-ivory hover:bg-burgundy-deep" onClick={() => setArrived(0)} aria-label={dict.nav.close}>✕</button>
        </div>
      ) : null}
      <button type="button" onClick={toggleSound} className="no-print btn btn-ghost btn-sm" aria-pressed={sound} title={sound ? dict.admin.orders.soundOn : dict.admin.orders.enableSound}>
        <IconBell size={20} className={sound ? "text-burgundy" : "text-muted"} />
        <span className="hidden xl:inline">{sound ? dict.admin.orders.soundOn : dict.admin.orders.enableSound}</span>
      </button>
    </>
  );
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.55);
    });
  } catch {}
}
