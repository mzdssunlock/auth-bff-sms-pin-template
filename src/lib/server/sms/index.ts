// SMS провайдер (автоматический выбор mock/real)
import { MockSMSProvider } from "./mock-provider";
import { RealSMSProvider } from "./real-provider";
import type { SMSProvider } from "./types";

function createSMSProvider(): SMSProvider {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (
    isDevelopment ||
    !process.env.SMS_API_KEY ||
    process.env.SMS_API_KEY === "mock_key_for_development"
  ) {
    console.log("[SMS] Используется MOCK провайдер (разработка)");
    return new MockSMSProvider();
  }

  console.log("[SMS] Используется реальный провайдер (production)");
  return new RealSMSProvider({
    apiKey: process.env.SMS_API_KEY,
    apiUrl: process.env.SMS_API_URL || "https://api.sms.ru/sms/send",
    senderName: process.env.SMS_SENDER_NAME || "AuthApp",
  });
}

// Singleton
export const smsProvider = createSMSProvider();
