import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
process.env.TOKEN_ENCRYPTION_KEY=`base64:${Buffer.alloc(32,7).toString('base64')}`;process.env.SESSION_PEPPER='s'.repeat(40);process.env.RATE_LIMIT_PEPPER='r'.repeat(40);process.env.CONTACT_FINGERPRINT_PEPPER='c'.repeat(40);process.env.APP_ENV='development';
describe("credential primitives",()=>{
 it("round-trips authenticated encryption and detects tampering",async()=>{const{encryptSecret,decryptSecret}=await import('@/lib/crypto');const p=encryptSecret('refresh-token');expect(decryptSecret(p)).toBe('refresh-token');expect(()=>decryptSecret(p.slice(0,-1)+'A')).toThrow()});
 it("hashes passwords with Argon2id",async()=>{const{hashPassword,verifyPassword}=await import('@/lib/auth');const h=await hashPassword('correct horse battery staple');expect(h).toContain('$argon2id$');expect(await verifyPassword(h,'correct horse battery staple')).toBe(true);expect(await verifyPassword(h,'wrong')).toBe(false)});
});
