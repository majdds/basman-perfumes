import { assertSameOrigin, errorResponse, HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { enforceIpLimit } from "@/server/services/rate-limit";
import { quoteCart } from "@/server/services/orders";
import { availableQuantity } from "@/lib/pricing";
import { cartQuoteSchema } from "@/lib/validation";

/** Returns current server-side prices, stock limits and totals for a cart. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await enforceIpLimit(req, "quote");
    const parsed = cartQuoteSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
    const q = await quoteCart(parsed.data.items, parsed.data.areaId);
    return json({
      lines: q.lines.map((l) => {
        const v = q.products.get(l.productId)?.variants.find((x) => x.id === l.variantId);
        return { ...l, maxQty: v ? availableQuantity(v) : 0 };
      }),
      problems: q.problems,
      subtotal: q.subtotal,
      deliveryFee: q.deliveryFee,
      total: q.total,
      areaId: q.area?.id ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
