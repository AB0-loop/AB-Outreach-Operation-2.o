import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { requiredSecret } from "@/lib/env";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const hmac = (value: string, secretName: string) => createHmac("sha256", requiredSecret(secretName)).update(value).digest("hex");

function tokenKey(): Buffer {
  const encoded = requiredSecret("TOKEN_ENCRYPTION_KEY", 20);
  const key = encoded.startsWith("hex:") ? Buffer.from(encoded.slice(4), "hex") : Buffer.from(encoded.replace(/^base64:/, ""), "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}
export function encryptSecret(value: string, version = "v1") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  cipher.setAAD(Buffer.from(version));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [version, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function decryptSecret(payload: string) {
  const [version, iv, tag, data] = payload.split(".");
  if (!version || !iv || !tag || !data) throw new Error("Encrypted payload is malformed");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(version));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
