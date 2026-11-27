import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * 密码哈希：scrypt + 每账号独立盐。
 * 格式：scrypt:<salt-hex>:<hash-hex>
 * 不引第三方依赖，node 内置足够。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export const PASSWORD_MIN_LENGTH = 8;

export function passwordIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位`;
  if (password.length > 128) return "密码太长了";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "密码需要同时包含字母和数字";
  }
  return null;
}
