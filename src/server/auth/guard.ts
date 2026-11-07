import "server-only";
import { redirect } from "next/navigation";
import { HttpError } from "../http";
import { readSession, type AdminSession } from "./session";
import type { AdminRole } from "@/lib/types";
import type { Locale } from "@/lib/types";

/** For API route handlers: throws 401/403. Every admin endpoint must call this. */
export async function requireAdminApi(role?: AdminRole): Promise<AdminSession> {
  const s = await readSession();
  if (!s) throw new HttpError(401, "unauthorized");
  if (role === "owner" && s.role !== "owner") throw new HttpError(403, "forbidden");
  return s;
}

/** For server-rendered admin pages: redirects to the login page. */
export async function requireAdminPage(locale: Locale, role?: AdminRole): Promise<AdminSession> {
  const s = await readSession();
  if (!s) redirect(`/${locale}/admin/login`);
  if (role === "owner" && s.role !== "owner") redirect(`/${locale}/admin`);
  return s;
}
