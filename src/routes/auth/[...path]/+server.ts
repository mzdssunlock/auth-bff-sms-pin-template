// Обработчик Hono BFF маршрутов
import type { RequestHandler } from "./$types";
import { smsBFF } from "$lib/server/auth/sms-bff";

// Обрабатываем все /auth/* запросы через Hono
export const GET: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};

export const POST: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};

export const PUT: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};

export const DELETE: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};

export const PATCH: RequestHandler = async ({ request }) => {
  return smsBFF.app.fetch(request);
};
