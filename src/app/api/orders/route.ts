import { cookies } from "next/headers";
import { assertSameOrigin, errorResponse, HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { isProduction } from "@/server/env";
import { enforceIpLimit } from "@/server/services/rate-limit";
import { placeOrder } from "@/server/services/orders";
import { idempotencyKeySchema, placeOrderSchema } from "@/lib/validation";

/**
 * Places a cash-on-delivery order.
 * Requires an Idempotency-Key header (generated once per checkout by the
 * browser) so double clicks and network retries never create duplicates.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const key = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key"));
    if (!key.success) throw new HttpError(400, "missing_idempotency_key");
    await enforceIpLimit(req, "order");

    const body = await readJson(req, 32 * 1024);
    const parsed = placeOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      if (fields.website) throw new HttpError(400, "spam");
      throw new HttpError(422, "validation", { fields });
    }

    const { order, viewToken, replayed } = await placeOrder(parsed.data, key.data);
    // The confirmation page is only viewable from this browser: an HttpOnly
    // cookie holds a random token whose hash is stored on the order.
    const jar = await cookies();
    jar.set(`ord_${order.number}`, viewToken, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return json({ orderNumber: order.number, replayed }, { status: replayed ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
