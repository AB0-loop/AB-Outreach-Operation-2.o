import "server-only";
import { randomUUID } from "node:crypto";

export type LogFields = Record<string, unknown>;
export function requestId(request?: Request): string {
  return request?.headers.get("x-cloud-trace-context")?.split("/")[0] || request?.headers.get("x-request-id") || randomUUID();
}
export function log(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const entry = { severity: level.toUpperCase(), event, at: new Date().toISOString(), ...fields };
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify(entry));
}
