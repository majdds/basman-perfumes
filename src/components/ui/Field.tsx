import type { ReactNode } from "react";

export function Field({
  id,
  label,
  hint,
  error,
  optionalLabel,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  optionalLabel?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optionalLabel ? <span className="ms-2 text-sm font-normal text-muted">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="field-hint">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string | null) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
