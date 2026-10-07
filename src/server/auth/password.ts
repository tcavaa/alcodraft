import "server-only";

import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Users imported from the old app have `legacy_md5_bcrypt` hashes:
 * bcrypt(md5(password)), because the old app only stored md5(password).
 * `needsUpgrade` tells the caller to re-hash with plain bcrypt after login.
 */
export async function verifyPassword(
  user: { passwordHash: string; passwordScheme: "bcrypt" | "legacy_md5_bcrypt" },
  password: string,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (user.passwordScheme === "legacy_md5_bcrypt") {
    const md5 = createHash("md5").update(password, "utf8").digest("hex");
    const ok = await bcrypt.compare(md5, user.passwordHash);
    return { ok, needsUpgrade: ok };
  }
  return { ok: await bcrypt.compare(password, user.passwordHash), needsUpgrade: false };
}

/** Same work as a real check, so unknown e-mails can't be told apart by timing. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("alcodraft-timing-equalizer", BCRYPT_ROUNDS);
  await bcrypt.compare(password, await dummyHash);
}

export const PASSWORD_MIN_LENGTH = 8;
