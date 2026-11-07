import { adminRoute } from "@/server/admin-route";
import { HttpError, json, readJson, zodFieldErrors } from "@/server/http";
import { saveSettings } from "@/server/services/settings";
import { settingsInputSchema } from "@/lib/validation";

export const PUT = adminRoute(
  async (req) => {
    const parsed = settingsInputSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(422, "validation", { fields: zodFieldErrors(parsed.error) });
    return json(await saveSettings(parsed.data));
  },
  { role: "owner" },
);
