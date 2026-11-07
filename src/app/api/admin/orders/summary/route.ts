import { adminRoute } from "@/server/admin-route";
import { json } from "@/server/http";
import { newOrdersSummary } from "@/server/services/admin-orders";

/** Polled by the dashboard every ~20 s to announce new orders. */
export const GET = adminRoute(async () => json(await newOrdersSummary()));
