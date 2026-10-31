import "server-only";
import { resolveMx } from "node:dns/promises";
import { rootHost } from "@/lib/discovery/extract";

export async function checkEmailDomain(email: string, siteRoot: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  let mx = false;
  try { mx = (await Promise.race([resolveMx(domain), new Promise<never>((_, j) => setTimeout(() => j(new Error("timeout")), 8000))])).length > 0; } catch { mx = false; }
  const sameDomain = rootHost(domain) === siteRoot || rootHost(domain).endsWith(`.${siteRoot}`);
  return { domain, mx, sameDomain };
}
