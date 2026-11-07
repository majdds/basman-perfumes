import { assertSameOrigin, errorResponse, HttpError, json, readJson } from "@/server/http";
import { login } from "@/server/services/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const parsed = loginSchema.safeParse(await readJson(req, 4096));
    if (!parsed.success) throw new HttpError(401, "invalid");
    await login(req, parsed.data.username, parsed.data.password);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
