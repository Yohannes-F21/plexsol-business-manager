type RateBucket = {
  count: number;
  resetAt: number;
};

/**
 * Simple in-memory login rate limiter (per process).
 * Keyed by IP + email. Suitable for single-instance deployments.
 */
export class LoginRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  private key(ip: string, email: string): string {
    return `${ip}::${email.trim().toLowerCase()}`;
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  check(
    ip: string,
    email: string,
  ): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    this.prune(now);

    const key = this.key(ip, email);
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      return { allowed: true, retryAfterMs: 0 };
    }

    if (bucket.count >= this.maxAttempts) {
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  recordFailure(ip: string, email: string): void {
    const now = Date.now();
    const key = this.key(ip, email);
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    existing.count += 1;
  }

  reset(ip: string, email: string): void {
    this.buckets.delete(this.key(ip, email));
  }
}
