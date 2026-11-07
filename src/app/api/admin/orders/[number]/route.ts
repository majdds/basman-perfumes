import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { getOrder } from "@/server/repos/orders";
import { updateOrderStatus } from "@/server/services/orders";
import { ORDER_NUMBER_PATTERN } from "@/lib/order-number";
import { statusUpdateSchema } from "@/lib/validation";

export const GET = adminRoute<{ number: string }>(async (_req, _s, { number }) => {
  if (!ORDER_NUMBER_PATTERN.test(number)) throw new HttpError(404, "not_found");
  const order = await getOrder(number);
  if (!order) throw new HttpError(404, "not_found");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { viewTokenHash, ...safe } = order;
  return json(safe);
});

export const PATCH = adminRoute<{ number: string }>(async (req, session, { number }) => {
  if (!ORDER_NUMBER_PATTERN.test(number)) throw new HttpError(404, "not_found");
  const parsed = statusUpdateSchema.safeParse(await readJson(req, 4096));
  if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
  const order = await updateOrderStatus(number, parsed.data.status, session.username, parsed.data.note);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { viewTokenHash, ...safe } = order;
  return json(safe);
});
