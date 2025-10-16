// src/hooks.server.ts
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";
import { smsAuthMiddleware } from "$lib/server/auth/sms-middleware.js";
import {
  createRateLimiter,
  rateLimitPresets,
} from "$lib/server/auth/rate-limiter.js";
import { db } from "$lib/server/db/index.js";

// ============================================================================
// Database Initialization
// ============================================================================

// Инициализируем подключение к PostgreSQL при старте
db.connect().catch((err: Error) => {
  console.error("[Startup] FATAL: Failed to connect to PostgreSQL:", err);
  console.error(
    "[Startup] Application cannot start without database connection",
  );
  process.exit(1); // Останавливаем приложение
});

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Строгий rate limiting для auth endpoints
 * 5 попыток за минуту для защиты от брутфорса
 */
const authRateLimiter = createRateLimiter(rateLimitPresets.strictAuth);

/**
 * Мягкий rate limiting для API endpoints
 * 30 запросов за минуту
 */
const apiRateLimiter = createRateLimiter(rateLimitPresets.api);

// ============================================================================
// Security Headers Middleware
// ============================================================================

/**
 * Security headers для защиты от различных атак
 */
const securityHeadersMiddleware: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  // HSTS только для production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';",
  );

  return response;
};

// ============================================================================
// Middleware Chain
// ============================================================================

export const handle = sequence(
  // 1. Security headers (применяются ко всем запросам)
  securityHeadersMiddleware,

  // 2. Rate limiting для auth endpoints (защита от брутфорса)
  authRateLimiter({
    routes: [
      "/auth/request-otp",
      "/auth/verify-otp",
      "/auth/setup-pin",
      "/auth/login-pin",
      "/auth/logout",
    ],
  }),

  // 3. Rate limiting для API endpoints
  apiRateLimiter({
    routes: ["/api"],
  }),

  // 4. SMS Аутентификация (проверка сессий)
  smsAuthMiddleware,
);

// ============================================================================
// Настройка rate limiting (опционально)
// ============================================================================

// Для более тонкой настройки раскомментируйте и измените:

/*
const customAuthLimiter = createRateLimiter({
  maxRequests: 3,              // Максимум запросов
  windowMs: 60000,             // За 1 минуту
  skipSuccessfulRequests: true, // Не считать успешные
  message: 'Слишком много попыток входа. Попробуйте через минуту.',
  skipIps: ['127.0.0.1']       // Whitelist IP
});

export const handle = sequence(
  customAuthLimiter({ routes: ['/auth/login'] }),
  authMiddleware
);
*/

// ============================================================================
// Production Tips
// ============================================================================

// 1. Для production используйте Redis-based rate limiter:
//    - npm install ioredis
//    - Создайте RedisRateLimiter (аналогично RedisSessionStore)
//
// 2. Настройте мониторинг:
//    - Логируйте 429 ошибки
//    - Отслеживайте IP с частыми блокировками
//
// 3. Рассмотрите дополнительные защиты:
//    - Captcha после N неудачных попыток
//    - Временная блокировка аккаунта
//    - Email уведомления о подозрительной активности
