// SMS Authentication Service
import crypto from "crypto";
import * as argon2 from "argon2";
import { smsProvider } from "$lib/server/sms";
import { db } from "$lib/server/db";
import { MemoryOTPStore, type OTPStore } from "./otp-store";
import type { RateLimiter } from "./sms-rate-limiter";

export interface SMSAuthConfig {
  otpLength: number; // Длина OTP кода (обычно 6)
  otpExpirationMinutes: number; // Время жизни OTP (обычно 5 минут)
  maxOTPAttempts: number; // Максимум попыток ввода (обычно 3)
  pinMinLength: number; // Минимальная длина PIN (обычно 4)
  pinMaxLength: number; // Максимальная длина PIN (обычно 6)
}

export class SMSAuthService {
  private otpStore: OTPStore;
  private config: SMSAuthConfig;

  constructor(
    private rateLimiter: RateLimiter,
    config?: Partial<SMSAuthConfig>,
  ) {
    this.otpStore = new MemoryOTPStore();
    this.config = {
      otpLength: config?.otpLength || 6,
      otpExpirationMinutes: config?.otpExpirationMinutes || 5,
      maxOTPAttempts: config?.maxOTPAttempts || 3,
      pinMinLength: config?.pinMinLength || 4,
      pinMaxLength: config?.pinMaxLength || 6,
    };
  }

  /**
   * Генерация OTP кода
   */
  generateOTP(): string {
    const max = Math.pow(10, this.config.otpLength) - 1;
    const min = Math.pow(10, this.config.otpLength - 1);
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Валидация формата телефона
   */
  validatePhone(phone: string): boolean {
    // Российский формат: +7XXXXXXXXXX (11 цифр после +7)
    return /^\+7\d{10}$/.test(phone);
  }

  /**
   * Валидация PIN кода
   */
  validatePIN(pin: string): { valid: boolean; error?: string } {
    if (!/^\d+$/.test(pin)) {
      return { valid: false, error: "PIN должен содержать только цифры" };
    }

    if (
      pin.length < this.config.pinMinLength ||
      pin.length > this.config.pinMaxLength
    ) {
      return {
        valid: false,
        error: `PIN должен содержать ${this.config.pinMinLength}-${this.config.pinMaxLength} цифр`,
      };
    }

    // Проверка на простые PIN (1111, 1234, и т.д.)
    if (/^(\d)\1+$/.test(pin)) {
      return {
        valid: false,
        error: "PIN не должен состоять из одинаковых цифр",
      };
    }

    if (pin === "1234" || pin === "4321" || pin === "0000") {
      return { valid: false, error: "Слишком простой PIN код" };
    }

    return { valid: true };
  }

  /**
   * Хеширование PIN с Argon2
   */
  async hashPIN(pin: string): Promise<string> {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Проверка PIN
   */
  async verifyPIN(pinHash: string, inputPin: string): Promise<boolean> {
    try {
      return await argon2.verify(pinHash, inputPin);
    } catch (error) {
      console.error("[SMSAuth] PIN verification error:", error);
      return false;
    }
  }

  /**
   * Отправка OTP кода на телефон
   */
  async sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
    // Валидация телефона
    if (!this.validatePhone(phone)) {
      return { success: false, error: "Неверный формат телефона" };
    }

    // Rate limiting
    const rateLimitKey = `otp:${phone}`;
    if (!this.rateLimiter.check(rateLimitKey)) {
      return {
        success: false,
        error: "Слишком много попыток. Попробуйте через минуту",
      };
    }

    // Генерируем OTP
    const otpCode = this.generateOTP();
    const expiresAt = Date.now() + this.config.otpExpirationMinutes * 60 * 1000;

    // Сохраняем в store
    this.otpStore.set(phone, {
      phone,
      code: otpCode,
      expiresAt,
      attempts: 0,
      verified: false,
    });

    // Также сохраняем в БД для аудита
    await db.createOTPCode({
      user_phone: phone,
      code: otpCode,
      expires_at: new Date(expiresAt),
      attempts: 0,
      verified: false,
    });

    // Отправляем SMS
    const message = `Ваш код подтверждения: ${otpCode}. Действителен ${this.config.otpExpirationMinutes} минут.`;
    const smsResult = await smsProvider.send(phone, message);

    if (!smsResult.success) {
      return { success: false, error: "Ошибка отправки SMS" };
    }

    return { success: true };
  }

  /**
   * Проверка OTP кода
   */
  async verifyOTP(
    phone: string,
    code: string,
    ipAddress: string,
  ): Promise<{
    success: boolean;
    userId?: number;
    requiresPinSetup?: boolean;
    error?: string;
    attemptsLeft?: number;
  }> {
    // Rate limiting
    const rateLimitKey = `verify:${phone}`;
    if (!this.rateLimiter.check(rateLimitKey)) {
      return {
        success: false,
        error: "Слишком много попыток. Попробуйте позже",
      };
    }

    // Получаем OTP из БД (не из памяти, чтобы переживать перезапуски)
    const otpRecord = await db.getOTPByPhone(phone);

    if (!otpRecord) {
      return { success: false, error: "Код не найден или истёк" };
    }

    if (otpRecord.attempts >= this.config.maxOTPAttempts) {
      await db.deleteOTPCode(otpRecord.id);
      return { success: false, error: "Превышено количество попыток" };
    }

    // Проверяем код
    if (otpRecord.code !== code) {
      await db.incrementOTPAttempts(otpRecord.id);
      return {
        success: false,
        error: "Неверный код",
        attemptsLeft: this.config.maxOTPAttempts - (otpRecord.attempts + 1),
      };
    }

    // OTP верный - проверяем/создаём пользователя
    let user = await db.getUserByPhone(phone);

    if (!user) {
      // Создаём нового пользователя
      user = await db.createUser({
        phone,
        pin_hash: null,
      });
    } else {
      await db.updateLastLogin(user.id);
    }

    // Логируем успешную попытку
    await db.logLoginAttempt({
      phone,
      attempt_type: "otp",
      success: true,
      ip_address: ipAddress,
    });

    // Удаляем использованный OTP из обоих хранилищ
    this.otpStore.delete(phone);
    await db.deleteOTPCode(otpRecord.id);

    return {
      success: true,
      userId: user.id,
      requiresPinSetup: !user.pin_hash,
    };
  }

  /**
   * Установка PIN кода
   */
  async setupPIN(
    userId: number,
    pin: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Валидация PIN
    const validation = this.validatePIN(pin);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Хешируем PIN
    const pinHash = await this.hashPIN(pin);

    // Сохраняем в БД
    await db.updateUserPin(userId, pinHash);

    return { success: true };
  }

  /**
   * Вход по PIN коду
   */
  async loginWithPIN(
    phone: string,
    pin: string,
    ipAddress: string,
  ): Promise<{ success: boolean; userId?: number; error?: string }> {
    // Валидация телефона
    if (!this.validatePhone(phone)) {
      return { success: false, error: "Неверный формат телефона" };
    }

    // Rate limiting
    const rateLimitKey = `pin:${phone}`;
    if (!this.rateLimiter.check(rateLimitKey)) {
      return {
        success: false,
        error: "Слишком много попыток. Попробуйте через 15 минут",
      };
    }

    // Ищем пользователя
    const user = await db.getUserByPhone(phone);

    if (!user || !user.pin_hash) {
      // Логируем неудачную попытку
      await db.logLoginAttempt({
        phone,
        attempt_type: "pin",
        success: false,
        ip_address: ipAddress,
      });

      return {
        success: false,
        error: "PIN не установлен. Используйте вход по SMS",
      };
    }

    // Проверяем PIN
    const isValidPin = await this.verifyPIN(user.pin_hash, pin);

    if (!isValidPin) {
      // Логируем неудачную попытку
      await db.logLoginAttempt({
        phone,
        attempt_type: "pin",
        success: false,
        ip_address: ipAddress,
      });

      return { success: false, error: "Неверный PIN код" };
    }

    // PIN верный - логируем успех
    await db.logLoginAttempt({
      phone,
      attempt_type: "pin",
      success: true,
      ip_address: ipAddress,
    });

    await db.updateLastLogin(user.id);

    return { success: true, userId: user.id };
  }

  /**
   * Shutdown (очистка ресурсов)
   */
  shutdown(): void {
    this.otpStore.shutdown?.();
  }
}
