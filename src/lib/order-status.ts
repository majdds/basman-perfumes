export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"];

/** The normal forward path an order takes. Used for the big "next step" button. */
export const STATUS_FLOW: readonly OrderStatus[] = ["new", "confirmed", "preparing", "out_for_delivery", "delivered"];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Rules (kept deliberately simple for the owners):
 *  - Delivered and cancelled orders are final.
 *  - Any open order can move to any other status, so a mis-click
 *    (e.g. "out for delivery" too early) can be corrected.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false;
  return true;
}

export function nextStatus(current: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(current);
  if (i < 0 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1]!;
}
