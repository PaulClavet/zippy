import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Small authenticated-encryption helper (AES-256-GCM) for stashing secrets like
 * Tripwire credentials in an httpOnly cookie. The ciphertext lives in the
 * browser but can only be decrypted server-side with SESSION_SECRET.
 */
function key(): Buffer {
  const secret = process.env.SESSION_SECRET || "zippy-insecure-dev-secret-change-me";
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decrypt(token: string): string {
  const buf = Buffer.from(token, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
