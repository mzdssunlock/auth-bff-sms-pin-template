// Обработчик Hono BFF маршрутов
import type { RequestHandler } from "./$types";
import { smsBFF } from "$lib/server/auth/sms-bff";

// Обрабатываем GET /auth/session для проверки сессии
export const GET: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};

// Обрабатываем POST запросы для всех auth endpoints
export const POST: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};
