// Серверный слой для SMS авторизации (для использования в Remote Functions)
import type { RequestEvent } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import { smsBFF } from "./sms-bff";

/**
 * Запрос OTP кода
 */
export async function serverRequestOTP(phone: string) {
  const smsAuth = smsBFF.getSMSAuthService();
  return await smsAuth.sendOTP(phone);
}

/**
 * Проверка OTP и создание сессии
 */
export async function serverVerifyOTP(
  phone: string,
  code: string,
  event: RequestEvent,
) {
  const smsAuth = smsBFF.getSMSAuthService();
  const ipAddress = event.getClientAddress();
  const result = await smsAuth.verifyOTP(phone, code, ipAddress);

  if (!result.success) {
    return result;
  }

  // Создаём сессию
  const sessionId = randomUUID();
  const sessionData = {
    sessionId,
    userId: String(result.userId!),
    phone,
    expiresAt:
      Date.now() + parseInt(process.env.SESSION_MAX_AGE || "86400") * 1000,
    requiresPinSetup: result.requiresPinSetup || false,
  };

  await smsBFF.sessionStore.createSession(sessionData);

  // Устанавливаем cookie
  event.cookies.set("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400"),
    path: "/",
  });

  return {
    success: true,
    requiresPinSetup: sessionData.requiresPinSetup,
    userId: result.userId,
  };
}

/**
 * Установка PIN
 */
export async function serverSetupPIN(pin: string, event: RequestEvent) {
  const sessionId = event.cookies.get("session_id");

  if (!sessionId) {
    return { success: false, error: "Не авторизован" };
  }

  const session = await smsBFF.getSession(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    return { success: false, error: "Сессия истекла" };
  }

  const smsAuth = smsBFF.getSMSAuthService();
  const result = await smsAuth.setupPIN(Number(session.userId), pin);

  if (!result.success) {
    return result;
  }

  // PIN успешно сохранён в БД
  // Сессию обновлять не требуется - requiresPinSetup будет актуальным при следующем login
  return { success: true, message: "PIN код установлен" };
}

/**
 * Вход по PIN
 */
export async function serverLoginWithPIN(
  phone: string,
  pin: string,
  event: RequestEvent,
) {
  const smsAuth = smsBFF.getSMSAuthService();
  const ipAddress = event.getClientAddress();
  const result = await smsAuth.loginWithPIN(phone, pin, ipAddress);

  if (!result.success) {
    return result;
  }

  // Создаём сессию
  const sessionId = randomUUID();
  const sessionData = {
    sessionId,
    userId: String(result.userId!),
    phone,
    expiresAt:
      Date.now() + parseInt(process.env.SESSION_MAX_AGE || "86400") * 1000,
    requiresPinSetup: false,
  };

  await smsBFF.sessionStore.createSession(sessionData);

  // Устанавливаем cookie
  event.cookies.set("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400"),
    path: "/",
  });

  return {
    success: true,
    userId: result.userId,
  };
}

/**
 * Выход
 */
export async function serverLogout(event: RequestEvent) {
  const sessionId = event.cookies.get("session_id");

  if (sessionId) {
    await smsBFF.sessionStore.deleteSession(sessionId);
  }

  event.cookies.delete("session_id", { path: "/" });

  return { success: true };
}
