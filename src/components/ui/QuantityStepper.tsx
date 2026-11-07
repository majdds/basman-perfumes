"use client";

import { IconMinus, IconPlus } from "./icons";

export function QuantityStepper({
  value,
  max,
  onChange,
  labels,
  id,
  size = "md",
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  labels: { decrease: string; increase: string; quantity: string };
  id?: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-10" : "h-12";
  const w = size === "sm" ? "w-10" : "w-12";
  return (
    <div className={`inline-flex ${h} items-stretch overflow-hidden rounded-[var(--radius-md)] border border-line bg-white`} role="group" aria-label={labels.quantity}>
      <button type="button" className={`${w} grid place-items-center text-ink hover:bg-cream disabled:opacity-35`} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={labels.decrease}>
        <IconMinus size={18} />
      </button>
      <output id={id} className={`ltr-nums grid ${w} place-items-center border-x border-line font-semibold`} aria-live="polite" data-testid="qty-value">
        {value}
      </output>
      <button type="button" className={`${w} grid place-items-center text-ink hover:bg-cream disabled:opacity-35`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={labels.increase} data-testid="qty-increase">
        <IconPlus size={18} />
      </button>
    </div>
  );
}
