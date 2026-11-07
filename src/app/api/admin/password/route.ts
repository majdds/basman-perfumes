import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { changePassword } from "@/server/services/auth";
import { changePasswordSchema } from "@/lib/validation";

export const POST = adminRoute(async (req, session) => {
  const parsed = changePasswordSchema.safeParse(await readJson(req, 4096));
  if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
  await changePassword(session, parsed.data.currentPassword, parsed.data.newPassword);
  return json({ ok: true });
});
