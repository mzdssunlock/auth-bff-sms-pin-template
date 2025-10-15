// Моковый SMS провайдер для разработки
import crypto from "crypto";
import type { SMSProvider, SMSResponse } from "./types";

export class MockSMSProvider implements SMSProvider {
  private sentMessages: Array<{
    phone: string;
    message: string;
    timestamp: Date;
    messageId: string;
  }> = [];

  async send(phone: string, message: string): Promise<SMSResponse> {
    const messageId = crypto.randomUUID();

    // Симулируем задержку сети (50-200ms)
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 150 + 50),
    );

    // Логируем в консоль (в разработке ты увидишь OTP код здесь)
    console.log("\n📱 [MOCK SMS PROVIDER]");
    console.log("├─ Получатель:", phone);
    console.log("├─ Сообщение:", message);
    console.log("├─ ID:", messageId);
    console.log("└─ Время:", new Date().toLocaleString("ru-RU"));

    // Сохраняем для истории (можно посмотреть в дебаге)
    this.sentMessages.push({
      phone,
      message,
      timestamp: new Date(),
      messageId,
    });

    // Ограничиваем историю 100 последними сообщениями
    if (this.sentMessages.length > 100) {
      this.sentMessages = this.sentMessages.slice(-100);
    }

    return {
      success: true,
      messageId,
    };
  }

  // Вспомогательный метод для тестирования
  getLastMessage(phone?: string) {
    if (phone) {
      return this.sentMessages.filter((m) => m.phone === phone).slice(-1)[0];
    }
    return this.sentMessages.slice(-1)[0];
  }

  // Получить все сообщения для телефона
  getMessages(phone: string) {
    return this.sentMessages.filter((m) => m.phone === phone);
  }

  // Очистить историю
  clear() {
    this.sentMessages = [];
  }
}
