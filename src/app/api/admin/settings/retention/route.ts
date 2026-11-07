import { adminRoute } from "@/server/admin-route";
import { json } from "@/server/http";
import { runRetention } from "@/server/services/admin-orders";

export const POST = adminRoute(async () => json({ anonymized: await runRetention() }), { role: "owner" });
