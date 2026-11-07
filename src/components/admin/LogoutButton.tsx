"use client";

import { IconLogout } from "../ui/icons";

export function LogoutButton({ locale, label }: { locale: string; label: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      data-testid="logout"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } }).catch(() => undefined);
        window.location.href = `/${locale}/admin/login`;
      }}
    >
      <IconLogout size={20} /> <span>{label}</span>
    </button>
  );
}
