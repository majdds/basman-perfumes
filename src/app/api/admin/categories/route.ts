import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { adminSaveCategory } from "@/server/services/admin-catalog";
import { categoryInputSchema } from "@/lib/validation";

export const POST = adminRoute(async (req) => {
  const parsed = categoryInputSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
  return json(await adminSaveCategory(parsed.data), { status: 201 });
});
