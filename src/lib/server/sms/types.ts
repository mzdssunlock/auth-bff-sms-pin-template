// Типы для SMS провайдера
export interface SMSConfig {
  apiKey: string;
  apiUrl: string;
  senderName: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SMSProvider {
  send(phone: string, message: string): Promise<SMSResponse>;
}
