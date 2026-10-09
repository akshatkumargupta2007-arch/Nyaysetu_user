// Build map #D9 & Bible §19 — Phone normalization, SHA-256 hashing, and AES-256-GCM encryption.
// Stored as salted hash + encrypted copy. Never returned by any API.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "../../env.js";

/**
 * Normalizes an Indian phone number to E.164 (+91XXXXXXXXXX).
 * Accepts 10 digits starting with 6-9, or with leading 0 or +91.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  let tenDigits = "";

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    tenDigits = digits;
  } else if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    tenDigits = digits.slice(1);
  } else {
    return null;
  }

  return `+91${tenDigits}`;
}

/**
 * Computes a deterministic keyed HMAC-SHA-256 of the normalized phone (the account lookup key).
 */
export function hashPhone(normalizedPhone: string): string {
  // Keyed (peppered) hash: a bare SHA-256 of a 10-digit number is brute-forceable in seconds.
  const pepper = env.PHONE_ENC_KEY || "nyaysetu-dev-phone-enc-key-32bytes!";
  return createHmac("sha256", pepper).update(normalizedPhone).digest("hex");
}

/**
 * Encrypts normalized phone using AES-256-GCM.
 * Output format: "iv:tag:ciphertext" (all in hex).
 */
export function encryptPhone(normalizedPhone: string): string {
  const secret = env.PHONE_ENC_KEY || "nyaysetu-dev-phone-enc-key-32bytes!";
  const key = createHash("sha256").update(secret).digest(); // exactly 32 bytes
  const iv = randomBytes(12); // 96 bits for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizedPhone, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Reverses encryptPhone. Used ONLY by the gov-sync job, which immediately re-seals the number to the
 * government portal's public key. PHONE_ENC_KEY itself never leaves this stack.
 */
export function decryptPhone(encrypted: string): string | null {
  const [ivHex, tagHex, dataHex] = encrypted.split(":");
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    const secret = env.PHONE_ENC_KEY || "nyaysetu-dev-phone-enc-key-32bytes!";
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
