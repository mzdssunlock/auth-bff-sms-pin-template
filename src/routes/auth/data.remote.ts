// Remote Functions для SMS + PIN авторизации
import { command, getRequestEvent } from "$app/server";
import * as v from "valibot";
import {
  serverRequestOTP,
  serverVerifyOTP,
  serverSetupPIN,
  serverLoginWithPIN,
  serverLogout,
} from "$lib/server/auth/sms-service";

// Валидационные схемы
const phoneSchema = v.pipe(
  v.string("Телефон обязателен"),
  v.regex(/^\+7\d{10}$/, "Неверный формат телефона. Используйте +79991234567"),
);

const otpCodeSchema = v.pipe(
  v.string("Код обязателен"),
  v.regex(/^\d{6}$/, "Код должен содержать 6 цифр"),
);

const pinSchema = v.pipe(
  v.string("PIN обязателен"),
  v.regex(/^\d{4,6}$/, "PIN должен содержать 4-6 цифр"),
);

/**
 * Запрос OTP кода на телефон
 */
export const requestOTP = command(
  v.object({
    phone: phoneSchema,
  }),
  async (data) => {
    const result = await serverRequestOTP(data.phone);

    if (!result.success) {
      throw new Error(result.error || "Ошибка отправки кода");
    }

    return {
      success: true,
      message: "Код отправлен на ваш телефон",
    };
  },
);

/**
 * Проверка OTP кода
 */
export const verifyOTP = command(
  v.object({
    phone: phoneSchema,
    code: otpCodeSchema,
  }),
  async (data) => {
    const event = getRequestEvent();
    const result = await serverVerifyOTP(data.phone, data.code, event);

    if (!result.success) {
      throw new Error(result.error || "Ошибка проверки кода");
    }

    return result;
  },
);

/**
 * Установка PIN кода
 */
export const setupPIN = command(
  v.object({
    pin: pinSchema,
  }),
  async (data) => {
    const event = getRequestEvent();
    const result = await serverSetupPIN(data.pin, event);

    if (!result.success) {
      throw new Error(
        "error" in result ? result.error : "Ошибка установки PIN",
      );
    }

    return result;
  },
);

/**
 * Вход по PIN коду
 */
export const loginWithPIN = command(
  v.object({
    phone: phoneSchema,
    pin: pinSchema,
  }),
  async (data) => {
    const event = getRequestEvent();
    const result = await serverLoginWithPIN(data.phone, data.pin, event);

    if (!result.success) {
      throw new Error(result.error || "Ошибка входа");
    }

    return result;
  },
);

/**
 * Выход из системы
 */
export const logout = command(async () => {
  const event = getRequestEvent();
  return await serverLogout(event);
});
