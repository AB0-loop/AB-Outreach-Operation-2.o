import "server-only";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
export async function pageUser() { const user = await currentSession().catch(() => null); if (!user) redirect("/"); return user; }
