import { describe, expect, it } from "vitest";
import { canTransition, isOrderStatus, nextStatus, ORDER_STATUSES } from "@/lib/order-status";

describe("order status transitions", () => {
  it("follows the normal flow", () => {
    expect(nextStatus("new")).toBe("confirmed");
    expect(nextStatus("confirmed")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("out_for_delivery");
    expect(nextStatus("out_for_delivery")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
  it("allows correcting open orders, including cancelling", () => {
    expect(canTransition("out_for_delivery", "preparing")).toBe(true);
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("new", "delivered")).toBe(true);
  });
  it("treats delivered and cancelled as final", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("delivered", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });
  it("rejects no-op transitions and unknown values", () => {
    expect(canTransition("new", "new")).toBe(false);
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus("new")).toBe(true);
  });
});
