// CA9: officer passcodes are stored with bcrypt (cost 12). Older rows hold an unsalted SHA-256 hash; those still
// work once, and are upgraded to bcrypt the moment the officer logs in successfully.
import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "node:crypto";

export const BCRYPT_COST = 12;

export const hashPasscode = (passcode: string): Promise<string> => bcrypt.hash(passcode, BCRYPT_COST);

const isBcrypt = (stored: string) => /^\$2[aby]\$/.test(stored);
const legacyHash = (passcode: string) => createHash("sha256").update(passcode).digest("hex");

export async function verifyPasscode(stored: string, passcode: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (isBcrypt(stored)) return { ok: await bcrypt.compare(passcode, stored), needsRehash: false };
  const a = Buffer.from(legacyHash(passcode));
  const b = Buffer.from(stored);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
}

// A real bcrypt hash to compare against when no officer matches, so a wrong id costs the same time as a wrong passcode.
let dummy: Promise<string> | null = null;
export const burnTime = async (passcode: string): Promise<void> => {
  dummy ??= hashPasscode("not-a-real-passcode");
  await bcrypt.compare(passcode, await dummy);
};
