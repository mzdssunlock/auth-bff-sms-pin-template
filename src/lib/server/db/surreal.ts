// SurrealDB клиент и типы для SMS аутентификации
import { Surreal, RecordId, Table } from "surrealdb";

// Типы для БД (удовлетворяют ограничению Record<string, unknown>)
export interface User extends Record<string, unknown> {
  id: RecordId<string>;
  phone: string;
  pin_hash: string | null;
  created_at: Date;
  last_login_at: Date;
}

export interface OTPCode extends Record<string, unknown> {
  id: RecordId<string>;
  user_phone: string;
  code: string;
  expires_at: Date;
  attempts: number;
  verified: boolean;
  created_at: Date;
}

export interface LoginAttempt extends Record<string, unknown> {
  id?: RecordId<string>;
  phone: string;
  attempt_type: "otp" | "pin";
  success: boolean;
  ip_address: string;
  timestamp: Date;
}

// Singleton SurrealDB клиент
class SurrealDBClient {
  private static instance: SurrealDBClient;
  private db: Surreal;
  private connected = false;

  private constructor() {
    this.db = new Surreal();
  }

  static getInstance(): SurrealDBClient {
    if (!SurrealDBClient.instance) {
      SurrealDBClient.instance = new SurrealDBClient();
    }
    return SurrealDBClient.instance;
  }

  async connect() {
    if (this.connected) return;

    try {
      const dbHost = process.env.DB_HOST || "http://localhost:8000";
      const dbUser = process.env.DB_USER || "root";
      const dbPassword = process.env.DB_PASSWORD || "root";
      const dbNamespace = process.env.DB_NAMESPACE || "auth_app";
      const dbDatabase = process.env.DB_DATABASE || "main";

      // Подключаемся к RPC endpoint
      const rpcUrl = dbHost.endsWith("/rpc") ? dbHost : `${dbHost}/rpc`;
      await this.db.connect(rpcUrl);

      // Используем namespace/database
      await this.db.use({ namespace: dbNamespace, database: dbDatabase });

      // Авторизуемся
      await this.db.signin({ username: dbUser, password: dbPassword });

      this.connected = true;
      console.log("[SurrealDB] Connected successfully");
    } catch (error) {
      console.error("[SurrealDB] Connection failed:", error);
      throw error;
    }
  }

  async ensureConnection() {
    if (!this.connected) {
      await this.connect();
    }
  }

  // Users
  async getUserByPhone(phone: string): Promise<User | null> {
    await this.ensureConnection();
    // Получаем всех пользователей и фильтруем
    const users = (await this.db.select(new Table("users"))) as User[];
    return users.find((u: User) => u.phone === phone) ?? null;
  }

  async createUser(data: Omit<User, "id">): Promise<User> {
    await this.ensureConnection();
    // create с Table возвращает массив
    const users = (await this.db.create(new Table("users"), {
      ...data,
      created_at: new Date(),
      last_login_at: new Date(),
    })) as User[];

    return users[0];
  }

  async updateUserPin(userId: string, pinHash: string): Promise<void> {
    await this.ensureConnection();
    // Получаем RecordId и обновляем через update
    const idPart = userId.includes(":") ? userId.split(":")[1] : userId;
    const recordId = new RecordId("users", idPart);

    // Используем параметризованный запрос для безопасности
    await this.db.query(`UPDATE $recordId SET pin_hash = $pinHash`, {
      recordId,
      pinHash,
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.ensureConnection();
    const idPart = userId.includes(":") ? userId.split(":")[1] : userId;
    const recordId = new RecordId("users", idPart);

    // Используем параметризованный запрос для консистентности
    await this.db.query(`UPDATE $recordId SET last_login_at = time::now()`, {
      recordId,
    });
  }

  // OTP Codes
  async createOTPCode(
    data: Omit<OTPCode, "id" | "created_at">,
  ): Promise<OTPCode> {
    await this.ensureConnection();

    // Удаляем старые коды для этого телефона
    const allCodes = (await this.db.select(
      new Table("otp_codes"),
    )) as OTPCode[];
    for (const code of allCodes) {
      if (code.user_phone === data.user_phone) {
        await this.db.delete(code.id);
      }
    }

    // Создаём новый OTP
    const codes = (await this.db.create(new Table("otp_codes"), {
      ...data,
      created_at: new Date(),
    })) as OTPCode[];

    return codes[0];
  }

  async getOTPByPhone(phone: string): Promise<OTPCode | null> {
    await this.ensureConnection();
    // Получаем все OTP коды и фильтруем
    const allCodes = (await this.db.select(
      new Table("otp_codes"),
    )) as OTPCode[];
    const now = new Date();

    // Фильтруем валидные коды
    const validCodes = allCodes.filter(
      (code: OTPCode) =>
        code.user_phone === phone && new Date(code.expires_at) > now,
    );

    if (validCodes.length === 0) return null;

    // Сортируем по created_at DESC и берём первый
    validCodes.sort(
      (a: OTPCode, b: OTPCode) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return validCodes[0];
  }

  async incrementOTPAttempts(otpId: string): Promise<void> {
    await this.ensureConnection();
    const idPart = otpId.includes(":") ? otpId.split(":")[1] : otpId;
    const recordId = new RecordId("otp_codes", idPart);

    // Получаем текущий код
    const current = (await this.db.select(recordId)) as OTPCode;
    if (current) {
      const newAttempts = current.attempts + 1;
      await this.db.query(`UPDATE $recordId SET attempts = $attempts`, {
        recordId,
        attempts: newAttempts,
      });
    }
  }

  async deleteOTPCode(otpId: string): Promise<void> {
    await this.ensureConnection();
    const idPart = otpId.includes(":") ? otpId.split(":")[1] : otpId;
    await this.db.delete(new RecordId("otp_codes", idPart));
  }

  // Login Attempts (аудит)
  async logLoginAttempt(data: Omit<LoginAttempt, "id">): Promise<void> {
    await this.ensureConnection();
    await this.db.create(new Table("login_attempts"), {
      ...data,
      timestamp: new Date(),
    });
  }

  // Cleanup старых OTP кодов (можно вызывать периодически)
  async cleanupExpiredOTP(): Promise<void> {
    await this.ensureConnection();
    await this.db.query(`DELETE otp_codes WHERE expires_at < time::now()`);
  }
}

// Экспортируем единственный экземпляр
export const surrealDB = SurrealDBClient.getInstance();

// Для обратной совместимости
export const db = surrealDB;
