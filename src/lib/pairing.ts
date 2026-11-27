import "server-only";
import crypto from "node:crypto";

/** 去掉容易看错的 0/O/1/I，剩 32 个字符 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PAIRING_TTL_MS = 15 * 60 * 1000;
export const PAIRING_INTERVAL_S = 3;

export function randomCode(len: number) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 人读码：ABCD-2345 */
export function newUserCode() {
  const raw = randomCode(8);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeUserCode(input: string) {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== 8) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

/** 连接器侧的密钥：高熵、只给连接器、轮询时出示 */
export function newDeviceCode() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashDeviceToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function newDeviceToken() {
  return crypto.randomBytes(32).toString("base64url");
}
