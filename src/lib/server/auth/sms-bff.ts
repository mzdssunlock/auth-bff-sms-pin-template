// BFF для SMS + PIN авторизации на Hono
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SMSAuthService } from "./sms-auth";
import { SimpleRateLimiter } from "./sms-rate-limiter";
import { MemorySessionStore } from "./stores/memory";
import type { SessionStore, SessionData } from "./session-store";

// Расширенный SessionData для SMS auth
export interface SMSSessionData extends SessionData {
  phone: string;
  requiresPinSetup: boolean;
}

export class SMSBFFService {
  private smsAuth: SMSAuthService;
  public sessionStore: SessionStore;
  public app: Hono;

  constructor(sessionStore?: SessionStore) {
    // Rate limiters для разных операций
    const otpRateLimiter = new SimpleRateLimiter(
      parseInt(process.env.RATE_LIMIT_OTP_MAX || "3"),
      parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || "60000"),
    );

    // Используем один rate limiter для всех операций (можно разделить позже)
    this.smsAuth = new SMSAuthService(otpRateLimiter);
    this.sessionStore = sessionStore ?? new MemorySessionStore();
    this.app = new Hono();

    this.setupRoutes();
  }

  private setupRoutes() {
    // 1. Запрос OTP кода
    this.app.post("/auth/request-otp", async (c) => {
      try {
        const { phone } = await c.req.json();

        const result = await this.smsAuth.sendOTP(phone);

        if (!result.success) {
          return c.json({ error: result.error }, 400);
        }

        // Сохраняем временную метку в cookie для защиты
        setCookie(
          c,
          "otp_request",
          JSON.stringify({ phone, timestamp: Date.now() }),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 300, // 5 минут
            path: "/",
          },
        );

        return c.json({
          success: true,
          message: "Код отправлен на ваш телефон",
        });
      } catch (error) {
        console.error("[SMS BFF] Request OTP error:", error);
        return c.json({ error: "Внутренняя ошибка сервера" }, 500);
      }
    });

    // 2. Проверка OTP кода
    this.app.post("/auth/verify-otp", async (c) => {
      try {
        const { phone, code } = await c.req.json();
        const requestData = getCookie(c, "otp_request");

        if (!requestData) {
          return c.json({ error: "Сессия истекла. Запросите новый код" }, 400);
        }

        const { phone: storedPhone } = JSON.parse(requestData);

        if (phone !== storedPhone) {
          return c.json({ error: "Неверный телефон" }, 400);
        }

        const ipAddress =
          c.req.header("x-forwarded-for")?.split(",")[0] || "unknown";
        const result = await this.smsAuth.verifyOTP(phone, code, ipAddress);

        if (!result.success) {
          return c.json(
            { error: result.error, attemptsLeft: result.attemptsLeft },
            400,
          );
        }

        // Создаём сессию
        const sessionId = randomUUID();
        const sessionData: SMSSessionData = {
          sessionId,
          userId: result.userId!,
          phone,
          expiresAt:
            Date.now() +
            parseInt(process.env.SESSION_MAX_AGE || "86400") * 1000,
          requiresPinSetup: result.requiresPinSetup || false,
        };

        await this.sessionStore.createSession(sessionData);

        // Устанавливаем session cookie
        setCookie(c, "session_id", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Strict",
          maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400"),
          path: "/",
        });

        // Очищаем OTP cookie
        deleteCookie(c, "otp_request");

        return c.json({
          success: true,
          requiresPinSetup: sessionData.requiresPinSetup,
          userId: result.userId,
        });
      } catch (error) {
        console.error("[SMS BFF] Verify OTP error:", error);
        return c.json({ error: "Внутренняя ошибка сервера" }, 500);
      }
    });

    // 3. Установка PIN кода
    this.app.post("/auth/setup-pin", async (c) => {
      try {
        const sessionId = getCookie(c, "session_id");

        if (!sessionId) {
          return c.json({ error: "Не авторизован" }, 401);
        }

        const session = await this.getSession(sessionId);

        if (!session || session.expiresAt < Date.now()) {
          return c.json({ error: "Сессия истекла" }, 401);
        }

        const { pin } = await c.req.json();

        const result = await this.smsAuth.setupPIN(session.userId, pin);

        if (!result.success) {
          return c.json({ error: result.error }, 400);
        }

        // Обновляем сессию
        await this.sessionStore.updateSession(sessionId, {
          ...session,
          requiresPinSetup: false,
        } as SMSSessionData);

        return c.json({
          success: true,
          message: "PIN код установлен",
        });
      } catch (error) {
        console.error("[SMS BFF] Setup PIN error:", error);
        return c.json({ error: "Внутренняя ошибка сервера" }, 500);
      }
    });

    // 4. Вход по PIN коду
    this.app.post("/auth/login-pin", async (c) => {
      try {
        const { phone, pin } = await c.req.json();
        const ipAddress =
          c.req.header("x-forwarded-for")?.split(",")[0] || "unknown";

        const result = await this.smsAuth.loginWithPIN(phone, pin, ipAddress);

        if (!result.success) {
          return c.json({ error: result.error }, 401);
        }

        // Создаём сессию
        const sessionId = randomUUID();
        const sessionData: SMSSessionData = {
          sessionId,
          userId: result.userId!,
          phone,
          expiresAt:
            Date.now() +
            parseInt(process.env.SESSION_MAX_AGE || "86400") * 1000,
          requiresPinSetup: false,
        };

        await this.sessionStore.createSession(sessionData);

        // Устанавливаем session cookie
        setCookie(c, "session_id", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Strict",
          maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400"),
          path: "/",
        });

        return c.json({
          success: true,
          userId: result.userId,
        });
      } catch (error) {
        console.error("[SMS BFF] Login PIN error:", error);
        return c.json({ error: "Внутренняя ошибка сервера" }, 500);
      }
    });

    // 5. Выход (logout)
    this.app.post("/auth/logout", async (c) => {
      try {
        const sessionId = getCookie(c, "session_id");

        if (sessionId) {
          await this.sessionStore.deleteSession(sessionId);
        }

        deleteCookie(c, "session_id");

        return c.json({ success: true });
      } catch (error) {
        console.error("[SMS BFF] Logout error:", error);
        return c.json({ error: "Внутренняя ошибка сервера" }, 500);
      }
    });

    // 6. Получение текущей сессии (для проверки)
    this.app.get("/auth/session", async (c) => {
      try {
        const sessionId = getCookie(c, "session_id");

        if (!sessionId) {
          return c.json({ authenticated: false }, 200);
        }

        const session = await this.getSession(sessionId);

        if (!session || session.expiresAt < Date.now()) {
          deleteCookie(c, "session_id");
          return c.json({ authenticated: false }, 200);
        }

        return c.json({
          authenticated: true,
          userId: session.userId,
          phone: (session as SMSSessionData).phone,
          requiresPinSetup: (session as SMSSessionData).requiresPinSetup,
        });
      } catch (error) {
        console.error("[SMS BFF] Session check error:", error);
        return c.json({ authenticated: false }, 200);
      }
    });
  }

  // Получение сессии
  async getSession(sessionId: string): Promise<SessionData | null> {
    const result = this.sessionStore.getSession(sessionId);
    return result instanceof Promise ? await result : result;
  }

  // Получение SMS Auth Service для Remote Functions
  getSMSAuthService(): SMSAuthService {
    return this.smsAuth;
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.smsAuth.shutdown();
    if (this.sessionStore.shutdown) {
      const result = this.sessionStore.shutdown();
      if (result instanceof Promise) await result;
    }
  }
}

// Singleton экземпляр
export const smsBFF = new SMSBFFService();
export const smsAuthService = smsBFF.getSMSAuthService();
