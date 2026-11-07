import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { adminDeleteCategory, adminSaveCategory } from "@/server/services/admin-catalog";
import { categoryInputSchema } from "@/lib/validation";

const ID = /^[A-Za-z0-9-]{1,64}$/;

export const PUT = adminRoute<{ id: string }>(async (req, _s, { id }) => {
  if (!ID.test(id)) throw new HttpError(404, "not_found");
  const parsed = categoryInputSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
  return json(await adminSaveCategory(parsed.data, id));
});

export const DELETE = adminRoute<{ id: string }>(
  async (_req, _s, { id }) => {
    if (!ID.test(id)) throw new HttpError(404, "not_found");
    await adminDeleteCategory(id);
    return json({ ok: true });
  },
  { role: "owner" },
);
