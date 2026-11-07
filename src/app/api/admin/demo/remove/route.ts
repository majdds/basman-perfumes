import { adminRoute } from "@/server/admin-route";
import { json } from "@/server/http";
import { adminRemoveDemoContent } from "@/server/services/admin-catalog";

export const POST = adminRoute(async () => json({ removed: await adminRemoveDemoContent() }), { role: "owner" });
