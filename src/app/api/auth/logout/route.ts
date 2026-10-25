import { assertCsrf, destroySession, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";
export async function POST(request: Request) { try { assertOrigin(request); const user = await requireUser(); assertCsrf(request, user); await destroySession(); return Response.json({ ok: true }); } catch (error) { return jsonError(error, "Logout failed"); } }
