"use client";

import { IconPrint } from "../ui/icons";

export function PrintButton({ label }: { label: string }) {
  return (
    <button className="btn btn-primary no-print" onClick={() => window.print()}>
      <IconPrint /> {label}
    </button>
  );
}
