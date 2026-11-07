import { adminRoute } from "@/server/admin-route";
import { HttpError, json } from "@/server/http";
import { adminListOrders } from "@/server/services/admin-orders";
import { orderListQuerySchema } from "@/lib/validation";

export const GET = adminRoute(async (req) => {
  const q = orderListQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) throw new HttpError(422, "validation");
  return json(await adminListOrders(q.data));
});
