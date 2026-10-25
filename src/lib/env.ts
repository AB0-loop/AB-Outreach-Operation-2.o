import "server-only";
import { z } from "zod";

const optionalUrl = z.string().url();

export function appOrigin(): string {
  const value = process.env.APP_BASE_URL;
  if (!value) throw new Error("APP_BASE_URL is not configured");
  return optionalUrl.parse(value).replace(/\/$/, "");
}

export function requiredSecret(name: string, min = 32): string {
  const value = process.env[name];
  if (!value || value.length < min) throw new Error(`${name} is not securely configured`);
  return value;
}

export function isLiveSendEnvironment(): boolean {
  return process.env.LIVE_SENDING_ENABLED === "true";
}

export function appEnvironment(): "development" | "staging" | "production" {
  const value = process.env.APP_ENV ?? "development";
  return z.enum(["development", "staging", "production"]).parse(value);
}
