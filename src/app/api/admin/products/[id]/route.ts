import { z } from "zod";
import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { adminDeleteProduct, adminSetProductStatus, adminUpdateProduct } from "@/server/services/admin-catalog";
import { productInputSchema } from "@/lib/validation";

const ID = /^[a-f0-9-]{36}$/;
const updateSchema = z.object({ version: z.number().int().min(1), product: productInputSchema }).strict();
const statusSchema = z.object({ status: z.enum(["active", "archived"]) }).strict();

export const PUT = adminRoute<{ id: string }>(async (req, _s, { id }) => {
  if (!ID.test(id)) throw new HttpError(404, "not_found");
  const parsed = updateSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
  return json(await adminUpdateProduct(id, parsed.data.product, parsed.data.version));
});

export const PATCH = adminRoute<{ id: string }>(async (req, _s, { id }) => {
  if (!ID.test(id)) throw new HttpError(404, "not_found");
  const parsed = statusSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(422, "validation");
  return json(await adminSetProductStatus(id, parsed.data.status));
});

export const DELETE = adminRoute<{ id: string }>(
  async (_req, _s, { id }) => {
    if (!ID.test(id)) throw new HttpError(404, "not_found");
    await adminDeleteProduct(id);
    return json({ ok: true });
  },
  { role: "owner" },
);
