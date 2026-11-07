import type { OrderStatus } from "@/lib/order-status";

const STYLES: Record<OrderStatus, string> = {
  new: "bg-burgundy text-ivory",
  confirmed: "bg-info-soft text-info",
  preparing: "bg-warning-soft text-warning",
  out_for_delivery: "bg-[#efe4cf] text-gold",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-sand text-muted line-through decoration-1",
};

export function StatusBadge({ status, label, large }: { status: OrderStatus; label: string; large?: boolean }) {
  return <span className={`badge ${STYLES[status]} ${large ? "px-4 py-1.5 text-sm" : ""}`} data-status={status}>{label}</span>;
}
