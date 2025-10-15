// Реальный SMS провайдер (для production)
import type { SMSConfig, SMSProvider, SMSResponse } from "./types";

export class RealSMSProvider implements SMSProvider {
  constructor(private config: SMSConfig) {}

  async send(phone: string, message: string): Promise<SMSResponse> {
    try {
      // Пример интеграции с SMS.ru (один из популярных в России)
      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          to: phone,
          msg: message,
          from: this.config.senderName,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[SMS Provider] Error:", error);
        return {
          success: false,
          error: `SMS API error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Формат ответа зависит от провайдера
      // Адаптируй под свой API
      return {
        success: data.status === "OK" || data.success === true,
        messageId: data.sms_id || data.message_id,
      };
    } catch (error) {
      console.error("[SMS Provider] Exception:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
