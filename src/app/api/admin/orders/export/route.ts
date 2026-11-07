import { adminRoute } from "@/server/admin-route";
import { HttpError } from "@/server/http";
import { exportOrdersCsv } from "@/server/services/admin-orders";
import { storeDateKey } from "@/lib/dates";
import { orderListQuerySchema } from "@/lib/validation";

export const GET = adminRoute(async (req) => {
  const params = new URL(req.url).searchParams;
  const q = orderListQuerySchema.safeParse(Object.fromEntries(params));
  if (!q.success) throw new HttpError(422, "validation");
  const locale = params.get("locale") === "en" ? "en" : "ar";
  const csv = await exportOrdersCsv(q.data, locale);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="basman-orders-${storeDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
