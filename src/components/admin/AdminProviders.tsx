"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { IconAlert, IconCheck } from "../ui/icons";

type ToastKind = "success" | "error";
interface Toast { id: number; kind: ToastKind; text: string }
interface ConfirmOpts { danger?: boolean; confirmLabel?: string }

const Ctx = createContext<{
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (message: string, opts?: ConfirmOpts) => Promise<boolean>;
  locale: Locale;
} | null>(null);

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminProviders");
  return c;
}

/** Toasts (large, readable, auto-dismiss) and a clear confirmation dialog for destructive actions. */
export function AdminProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = getDictionary(locale);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<{ message: string; opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: ToastKind = "success") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const confirm = useCallback((message: string, opts: ConfirmOpts = {}) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, opts, resolve });
      requestAnimationFrame(() => dialogRef.current?.showModal());
    });
  }, []);

  const close = (v: boolean) => {
    pending?.resolve(v);
    dialogRef.current?.close();
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm, locale }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-[var(--radius-md)] px-5 py-4 text-base font-semibold shadow-[var(--shadow-lift)] ${t.kind === "error" ? "bg-danger text-white" : "bg-charcoal text-ivory"}`}>
            {t.kind === "error" ? <IconAlert /> : <IconCheck />} {t.text}
          </div>
        ))}
      </div>
      <dialog ref={dialogRef} onCancel={() => close(false)} className="m-auto w-[min(92vw,460px)] rounded-[var(--radius-lg)] bg-ivory p-0 backdrop:bg-charcoal/50" dir={locale === "ar" ? "rtl" : "ltr"}>
        <div className="p-6">
          <h2 className="text-xl">{dict.admin.common.areYouSure}</h2>
          <p className="mt-3 text-lg text-ink">{pending?.message}</p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => close(false)} autoFocus>{dict.common.cancel}</button>
            <button type="button" className={`btn btn-lg ${pending?.opts.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} data-testid="confirm-yes">
              {pending?.opts.confirmLabel ?? dict.admin.common.confirm}
            </button>
          </div>
        </div>
      </dialog>
    </Ctx.Provider>
  );
}
