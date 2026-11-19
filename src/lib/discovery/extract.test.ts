import { describe, expect, it } from "vitest";
import { classifyEmail, decodeCfEmail, extractEmails, extractPhones, mentionsBengaluru, relevanceSignals, siteName } from "@/lib/discovery/extract";
import { robotsAllowed } from "@/lib/discovery/crawl";

const html = `<html><head><title>Example Weddings | Planners</title></head><body>
<a href="mailto:hello@example-weddings.in?subject=Hi">Mail</a>
<a href="tel:+91 98450 12345">Call</a>
<p>Office: 080 4123 4567. Studio in Indiranagar, Bengaluru. We coordinate the groom's sherwani and wedding vendors.</p>
<img src="logo@2x.png"/> <span>ravi.k@example-weddings.in</span>
<a href="https://wa.me/919845012345">WhatsApp</a></body></html>`;

describe("first-party contact extraction", () => {
  it("extracts emails from mailto and text, ignoring assets", () => {
    const e = extractEmails(html).map(x => x.value);
    expect(e).toContain("hello@example-weddings.in"); expect(e).toContain("ravi.k@example-weddings.in"); expect(e.some(x => x.includes("png"))).toBe(false);
  });
  it("normalizes and deduplicates Indian mobile and landline numbers", () => {
    const p = extractPhones(html);
    expect(p.map(x => x.e164).sort()).toEqual(["+918041234567", "+919845012345"]);
    expect(p.find(x => x.e164 === "+918041234567")?.type).toBe("FIXED_LINE");
  });
  it("rejects invalid numbers", () => expect(extractPhones("<p>Call 12345 67890 or 000-000-0000</p>")).toHaveLength(0));
  it("decodes Cloudflare-obfuscated email", () => {
    const key = 0x2a; const enc = key.toString(16) + [..."a@b.in"].map(c => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
    expect(decodeCfEmail(enc)).toBe("a@b.in");
  });
  it("classifies role versus named emails", () => { expect(classifyEmail("info@x.in")).toBe("role_email"); expect(classifyEmail("ravi.k@x.in")).toBe("named_email"); });
  it("finds commercial relevance and location with excerpts", () => {
    const text = "We coordinate the groom's sherwani and wedding vendors in Bengaluru";
    const s = relevanceSignals(text); expect(s[0].term).toBe("sherwani"); expect(s.map(x => x.term)).toContain("groom");
    expect(mentionsBengaluru(text)).toContain("Bengaluru");
  });
  it("derives a site name from the title", () => expect(siteName(html, "example-weddings.in")).toBe("Example Weddings"));
  it("prefers the domain brand over an SEO title", () => expect(siteName(`<title>An Award Winning Venue - Bangalore</title><script>{"@type":"Organization","name":"The Tamarind Tree"}</script>`, "thetamarindtree.in")).toBe("The Tamarind Tree"));
  it("honours robots.txt disallow and allow precedence", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/contact";
    expect(robotsAllowed(robots, "/private/x")).toBe(false); expect(robotsAllowed(robots, "/private/contact")).toBe(true); expect(robotsAllowed(robots, "/contact")).toBe(true);
    expect(robotsAllowed("User-agent: *\nDisallow: /", "/contact")).toBe(false);
    expect(robotsAllowed("User-agent: *\nDisallow: /*?\nDisallow: /wp-admin/", "/")).toBe(true);
    expect(robotsAllowed("User-agent: *\nDisallow: /*?", "/page?x=1")).toBe(false);
  });
});
