// PostgreSQL клиент с Drizzle ORM для SMS аутентификации
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, gt, lt, desc } from "drizzle-orm";
import { users, otpCodes, loginAttempts } from "./schema";
import type {
  User,
  InsertUser,
  OTPCode,
  InsertOTPCode,
  InsertLoginAttempt,
} from "./schema";

// Singleton PostgreSQL клиент
class PostgresDBClient {
  private static instance: PostgresDBClient;
  private queryClient: ReturnType<typeof postgres>;
  private db: ReturnType<
    typeof drizzle<{
      users: typeof users;
      otpCodes: typeof otpCodes;
      loginAttempts: typeof loginAttempts;
    }>
  >;
  private connected = false;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Инициализируем клиент postgres.js
    this.queryClient = postgres({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || "5433"),
      database: process.env.DB_NAME || "myapp",
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      max: 10, // Максимум соединений в пуле
      idle_timeout: 20, // Закрывать неактивные соединения через 20 сек
      connect_timeout: 30, // Таймаут подключения 30 сек
      // SSL для production (для самоподписанных сертификатов managed БД)
      // Для production с валидным сертификатом используйте: ssl: true
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });

    // Инициализируем Drizzle ORM с schema для relational queries
    this.db = drizzle(this.queryClient, {
      schema: { users, otpCodes, loginAttempts },
    });
  }

  static getInstance(): PostgresDBClient {
    if (!PostgresDBClient.instance) {
      PostgresDBClient.instance = new PostgresDBClient();
    }
    return PostgresDBClient.instance;
  }

  async connect() {
    if (this.connected) return;

    try {
      // Проверяем подключение
      await this.queryClient`SELECT 1`;
      this.connected = true;
      console.log("[PostgreSQL] Connected successfully");

      // Запускаем автоматическую очистку истёкших OTP каждые 5 минут
      this.startCleanupTimer();
    } catch (error) {
      console.error("[PostgreSQL] Connection failed:", error);
      throw error;
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredOTP().catch((err) => {
          console.error("[PostgreSQL] Cleanup error:", err);
        });
      },
      5 * 60 * 1000,
    ); // 5 минут

    // Не блокируем выход из процесса
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async ensureConnection() {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        console.error("[PostgreSQL] Failed to ensure connection:", error);
        throw new Error(
          "Database connection failed. Please check your configuration.",
        );
      }
    }
  }

  // ============================================================================
  // Users
  // ============================================================================

  async getUserByPhone(phone: string): Promise<User | null> {
    await this.ensureConnection();

    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async createUser(
    data: Omit<InsertUser, "id" | "created_at" | "last_login_at">,
  ): Promise<User> {
    await this.ensureConnection();

    try {
      const result = await this.db
        .insert(users)
        .values({
          phone: data.phone,
          pin_hash: data.pin_hash || null,
        })
        .returning();

      return result[0];
    } catch (error) {
      // Если пользователь уже существует (race condition), получаем его
      if (
        error instanceof Error &&
        error.message.includes("unique constraint")
      ) {
        const existingUser = await this.getUserByPhone(data.phone);
        if (existingUser) {
          return existingUser;
        }
      }
      throw error;
    }
  }

  async updateUserPin(userId: number, pinHash: string): Promise<void> {
    await this.ensureConnection();

    await this.db
      .update(users)
      .set({ pin_hash: pinHash })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.ensureConnection();

    await this.db
      .update(users)
      .set({ last_login_at: new Date() })
      .where(eq(users.id, userId));
  }

  // ============================================================================
  // OTP Codes
  // ============================================================================

  async createOTPCode(
    data: Omit<InsertOTPCode, "id" | "created_at">,
  ): Promise<OTPCode> {
    await this.ensureConnection();

    // Удаляем старые коды для этого телефона
    await this.db
      .delete(otpCodes)
      .where(eq(otpCodes.user_phone, data.user_phone));

    // Создаём новый OTP
    const result = await this.db
      .insert(otpCodes)
      .values({
        user_phone: data.user_phone,
        code: data.code,
        expires_at: data.expires_at,
        attempts: data.attempts || 0,
        verified: data.verified || false,
      })
      .returning();

    return result[0];
  }

  async getOTPByPhone(phone: string): Promise<OTPCode | null> {
    await this.ensureConnection();

    const now = new Date();

    // Получаем валидные (не истёкшие) OTP коды для телефона
    const result = await this.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.user_phone, phone), gt(otpCodes.expires_at, now)))
      .orderBy(desc(otpCodes.created_at))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  async incrementOTPAttempts(otpId: number): Promise<void> {
    await this.ensureConnection();

    // Получаем текущий код
    const current = await this.db
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.id, otpId))
      .limit(1);

    if (current.length > 0) {
      const newAttempts = current[0].attempts + 1;
      await this.db
        .update(otpCodes)
        .set({ attempts: newAttempts })
        .where(eq(otpCodes.id, otpId));
    }
  }

  async deleteOTPCode(otpId: number): Promise<void> {
    await this.ensureConnection();

    await this.db.delete(otpCodes).where(eq(otpCodes.id, otpId));
  }

  // ============================================================================
  // Login Attempts (аудит)
  // ============================================================================

  async logLoginAttempt(
    data: Omit<InsertLoginAttempt, "id" | "timestamp">,
  ): Promise<void> {
    await this.ensureConnection();

    await this.db.insert(loginAttempts).values({
      phone: data.phone,
      attempt_type: data.attempt_type,
      success: data.success,
      ip_address: data.ip_address,
    });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async cleanupExpiredOTP(): Promise<void> {
    await this.ensureConnection();

    const now = new Date();
    // Удаляем коды где expires_at < now (истекшие)
    await this.db.delete(otpCodes).where(lt(otpCodes.expires_at, now));
  }

  // ============================================================================
  // Shutdown
  // ============================================================================

  async end(): Promise<void> {
    if (this.connected) {
      // Останавливаем cleanup timer
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      await this.queryClient.end();
      this.connected = false;
      console.log("[PostgreSQL] Connection closed");
    }
  }
}

// Экспортируем единственный экземпляр
export const postgresDB = PostgresDBClient.getInstance();

// Для обратной совместимости
export const db = postgresDB;

// Экспортируем типы
export type { User, InsertUser, OTPCode, InsertOTPCode, InsertLoginAttempt };
