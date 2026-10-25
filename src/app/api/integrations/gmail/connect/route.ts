import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents, oauthStates } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { encryptSecret, randomToken, sha256 } from "@/lib/crypto";
import { appOrigin } from "@/lib/env";
import { gmailRedirectUri } from "@/lib/gmail";
export async function GET() { try { const user = await requirePermission("owner"); const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID; if (!clientId) throw new Error("Google OAuth client is not configured"); const state = randomToken(), verifier = randomToken(48), redirectUri = gmailRedirectUri(); await db.insert(oauthStates).values({ stateHash: sha256(state), userId: user.id, encryptedVerifier: encryptSecret(verifier), redirectUri, expiresAt: new Date(Date.now() + 600_000) }); await db.insert(auditEvents).values({ actorId: user.id, action: "gmail.connect.started", entityType: "mailbox", summary: "Send-only OAuth started" }); const u = new URL("https://accounts.google.com/o/oauth2/v2/auth"); u.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email https://www.googleapis.com/auth/gmail.send", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", access_type: "offline", prompt: "consent" }).toString(); return NextResponse.redirect(u); } catch (error) { return NextResponse.redirect(`${appOrigin()}/settings?gmail=${encodeURIComponent(error instanceof Error ? error.message : "failed")}`); } }
