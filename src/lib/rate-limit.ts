/**
 * 进程内限流。够用，但要清楚它的边界：
 * - 多实例部署时各进程独立计数，等于把额度乘以实例数
 * - 重启即清零
 * 阶段二只有单实例，等真正需要时换 Redis。
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** 定期清理，避免长期运行后 Map 无限增长 */
if (typeof globalThis !== "undefined") {
  const g = globalThis as unknown as { __coflowRateLimitTimer?: NodeJS.Timeout };
  if (!g.__coflowRateLimitTimer) {
    g.__coflowRateLimitTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }, 5 * 60 * 1000);
    g.__coflowRateLimitTimer.unref?.();
  }
}
