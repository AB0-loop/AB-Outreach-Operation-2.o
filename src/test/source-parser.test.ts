import { describe, expect, it } from "vitest";
import { safeSourceFetch } from "@/lib/safe-fetch";
describe("source access safety",()=>{it("rejects host changes before network access",async()=>{await expect(safeSourceFetch('https://example.net/path','https://example.com/')).rejects.toThrow(/approved host/)});it("rejects localhost",async()=>{await expect(safeSourceFetch('https://localhost/path','https://localhost/')).rejects.toThrow(/prohibited/)});});
