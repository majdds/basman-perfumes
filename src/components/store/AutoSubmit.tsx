"use client";

import type { ReactNode } from "react";

/** Submits the surrounding GET form when a select changes (the form also has a submit button for no-JS). */
export function AutoSubmitSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
