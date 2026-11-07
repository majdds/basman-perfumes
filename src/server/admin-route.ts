import "server-only";
import { requireAdminApi } from "./auth/guard";
import type { AdminSession } from "./auth/session";
import { assertSameOrigin, errorResponse } from "./http";
import { enforceIpLimit } from "./services/rate-limit";
import type { AdminRole } from "@/lib/types";

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps every admin API handler. Authorisation is enforced HERE, on the
 * server, for every request — never only in the UI:
 *   1. same-origin check for state-changing methods (CSRF),
 *   2. valid server-side session (401 otherwise),
 *   3. role check where required (403),
 *   4. rate limit on writes.
 */
export function adminRoute<P = Record<string, never>>(
  handler: (req: Request, session: AdminSession, params: P) => Promise<Response>,
  opts: { role?: AdminRole } = {},
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const write = !["GET", "HEAD"].includes(req.method);
      if (write) assertSameOrigin(req);
      const session = await requireAdminApi(opts.role);
      if (write) await enforceIpLimit(req, "adminWrite");
      return await handler(req, session, (await ctx.params) ?? ({} as P));
    } catch (e) {
      return errorResponse(e);
    }
  };
}
