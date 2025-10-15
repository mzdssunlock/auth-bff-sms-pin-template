// Адаптер rate limiter для SMS Auth Service
export interface RateLimiter {
  check(key: string): boolean;
}

export class SimpleRateLimiter implements RateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private maxAttempts: number,
    private windowMs: number,
  ) {
    // Очистка каждую минуту
    setInterval(() => this.cleanup(), 60000);
  }

  check(key: string): boolean {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (!record || record.resetTime < now) {
      record = { count: 0, resetTime: now + this.windowMs };
      this.attempts.set(key, record);
    }

    if (record.count >= this.maxAttempts) {
      return false; // Превышен лимит
    }

    record.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (record.resetTime < now) {
        this.attempts.delete(key);
      }
    }
  }
}
