// src/lib/server/auth/stores/redis.ts
import Redis from "ioredis";
import type { SessionStore, SessionData } from "../session-store.js";

/**
 * Redis Session Store для Production
 *
 * ✅ Преимущества:
 * - Персистентность (сессии сохраняются при перезапуске)
 * - Горизонтальное масштабирование
 * - Автоматическое истечение через TTL
 * - Высокая производительность
 */
export class RedisSessionStore implements SessionStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(options?: {
    host?: string;
    port?: number;
    password?: string;
    keyPrefix?: string;
  }) {
    this.redis = new Redis({
      host: options?.host || process.env.REDIS_HOST || "localhost",
      port: options?.port || parseInt(process.env.REDIS_PORT || "6379"),
      password: options?.password || process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.keyPrefix = options?.keyPrefix || "session:";

    this.redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    this.redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });
  }

  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  async createSession(sessionData: SessionData): Promise<void> {
    const key = this.getKey(sessionData.sessionId);
    const ttl = Math.ceil((sessionData.expiresAt - Date.now()) / 1000);

    if (ttl > 0) {
      await this.redis.setex(key, ttl, JSON.stringify(sessionData));
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey(sessionId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      const session = JSON.parse(data) as SessionData;

      // Проверяем истёк ли срок
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error("[Redis] Parse error:", error);
      return null;
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) return false;

    const updatedSession = { ...session, ...updates };
    await this.createSession(updatedSession);

    return true;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = this.getKey(sessionId);
    const result = await this.redis.del(key);

    return result > 0;
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Redis автоматически удаляет истёкшие ключи через TTL
    // Эта функция здесь для совместимости с интерфейсом
    console.log("[Redis] TTL handles expiration automatically");
  }

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }

  // Дополнительные методы для отладки
  async getSessionCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    return keys.length;
  }

  async getAllSessions(): Promise<SessionData[]> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    const sessions: SessionData[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          sessions.push(JSON.parse(data));
        } catch (error) {
          console.error("[Redis] Parse error for key:", key, error);
        }
      }
    }

    return sessions;
  }
}
