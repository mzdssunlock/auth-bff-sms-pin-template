// PostgreSQL схема для SMS + PIN аутентификации с Drizzle ORM
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ============================================================================
// Таблица пользователей
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull().unique(),
    pin_hash: text("pin_hash"),
    created_at: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    last_login_at: timestamp("last_login_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_phone_idx").on(table.phone)],
);

// Типы для TypeScript
export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

// ============================================================================
// Таблица OTP кодов
// ============================================================================

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    user_phone: text("user_phone").notNull(),
    code: text("code").notNull(),
    expires_at: timestamp("expires_at", { mode: "date" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    created_at: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("otp_codes_phone_idx").on(table.user_phone),
    index("otp_codes_expires_idx").on(table.expires_at),
  ],
);

// Типы для TypeScript
export type OTPCode = InferSelectModel<typeof otpCodes>;
export type InsertOTPCode = InferInsertModel<typeof otpCodes>;

// ============================================================================
// Таблица попыток входа (аудит)
// ============================================================================

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    attempt_type: text("attempt_type").notNull(), // 'otp' | 'pin'
    success: boolean("success").notNull(),
    ip_address: text("ip_address").notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("login_attempts_phone_idx").on(table.phone),
    index("login_attempts_timestamp_idx").on(table.timestamp),
  ],
);

// Типы для TypeScript
export type LoginAttempt = InferSelectModel<typeof loginAttempts>;
export type InsertLoginAttempt = InferInsertModel<typeof loginAttempts>;
