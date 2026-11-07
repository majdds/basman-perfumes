"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { Spinner } from "../ui/Spinner";
import { IconAlert, IconEye, IconEyeOff } from "../ui/icons";

export function LoginForm({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", { body: { username, password } });
      window.location.href = `/${locale}/admin`;
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : "generic";
      setError(code === "locked" || code === "rateLimited" ? dict.admin.login.locked : code === "invalid" ? dict.admin.login.invalid : code === "network" ? dict.errors.network : dict.errors.generic);
      setPassword("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? <p className="alert alert-error" role="alert" data-testid="login-error"><IconAlert className="shrink-0" /> {error}</p> : null}
      <div>
        <label htmlFor="username" className="field-label">{dict.admin.login.username}</label>
        <input id="username" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={40} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">{dict.admin.login.password}</label>
        <div className="relative">
          <input id="password" className="input pe-14" type={show ? "text" : "password"} autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={200} />
          <button type="button" className="absolute end-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-cream" onClick={() => setShow((s) => !s)} aria-label={show ? dict.admin.login.hidePassword : dict.admin.login.showPassword} aria-pressed={show}>
            {show ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={busy || !username || !password} data-testid="login-submit">
        {busy ? <><Spinner /> {dict.admin.login.submitting}</> : dict.admin.login.submit}
      </button>
    </form>
  );
}
