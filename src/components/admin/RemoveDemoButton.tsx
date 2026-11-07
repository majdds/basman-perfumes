"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { getDictionary } from "@/lib/i18n";
import { useAdmin } from "./AdminProviders";
import { IconTrash } from "../ui/icons";

export function RemoveDemoButton() {
  const { confirm, toast, locale } = useAdmin();
  const dict = getDictionary(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-outline-danger"
      disabled={busy}
      onClick={async () => {
        if (!(await confirm(dict.admin.overview.confirmRemoveDemo, { danger: true, confirmLabel: dict.admin.overview.removeDemo }))) return;
        setBusy(true);
        try {
          const r = await api<{ removed: number }>("/api/admin/demo/remove", { body: {} });
          toast(dict.admin.overview.demoRemoved(r.removed));
          router.refresh();
        } catch {
          toast(dict.admin.common.error, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <IconTrash size={20} /> {dict.admin.overview.removeDemo}
    </button>
  );
}
