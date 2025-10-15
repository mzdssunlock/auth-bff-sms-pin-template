// OTP Store для хранения одноразовых кодов
// Аналогично SessionStore, можно расширить на Redis/PostgreSQL

export interface OTPData {
  phone: string;
  code: string;
  expiresAt: number; // timestamp
  attempts: number;
  verified: boolean;
}

export interface OTPStore {
  /**
   * Сохранить OTP код
   */
  set(phone: string, data: OTPData): Promise<void> | void;

  /**
   * Получить OTP код по телефону
   */
  get(phone: string): Promise<OTPData | null> | OTPData | null;

  /**
   * Удалить OTP код
   */
  delete(phone: string): Promise<boolean> | boolean;

  /**
   * Инкремент попыток ввода
   */
  incrementAttempts(phone: string): Promise<void> | void;

  /**
   * Очистка истёкших кодов
   */
  cleanupExpired(): Promise<void> | void;

  /**
   * Shutdown (если нужно)
   */
  shutdown?(): Promise<void> | void;
}

/**
 * In-Memory OTP Store (для разработки)
 */
export class MemoryOTPStore implements OTPStore {
  private store = new Map<string, OTPData>();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60000) {
    // Автоочистка каждую минуту
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);
  }

  set(phone: string, data: OTPData): void {
    this.store.set(phone, data);
  }

  get(phone: string): OTPData | null {
    const data = this.store.get(phone);
    if (!data) return null;

    // Проверяем, не истёк ли код
    if (data.expiresAt < Date.now()) {
      this.store.delete(phone);
      return null;
    }

    return data;
  }

  delete(phone: string): boolean {
    return this.store.delete(phone);
  }

  incrementAttempts(phone: string): void {
    const data = this.store.get(phone);
    if (data) {
      data.attempts++;
      this.store.set(phone, data);
    }
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [phone, data] of this.store.entries()) {
      if (data.expiresAt < now) {
        this.store.delete(phone);
      }
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }

  // Debug метод
  getAll(): Map<string, OTPData> {
    return new Map(this.store);
  }
}
