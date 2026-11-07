import { assertSameOrigin, errorResponse, json } from "@/server/http";
import { logout } from "@/server/services/auth";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await logout();
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
