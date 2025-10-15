// SMS Authentication Middleware
import type { Handle } from "@sveltejs/kit";
import { smsBFF, type SMSSessionData } from "./sms-bff";

export const smsAuthMiddleware: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get("session_id");

  if (!sessionId) {
    event.locals.user = undefined;
    event.locals.phone = undefined;
    return resolve(event);
  }

  const session = await smsBFF.getSession(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    event.cookies.delete("session_id", { path: "/" });
    event.locals.user = undefined;
    event.locals.phone = undefined;
    return resolve(event);
  }

  // Продлеваем сессию если она близка к истечению (за 2 часа)
  if (session.expiresAt - Date.now() < 2 * 60 * 60 * 1000) {
    const newExpiresAt =
      Date.now() + parseInt(process.env.SESSION_MAX_AGE || "86400") * 1000;
    await smsBFF.sessionStore["updateSession"](sessionId, {
      ...session,
      expiresAt: newExpiresAt,
    });
  }

  // Устанавливаем данные пользователя в locals
  event.locals.user = {
    userId: session.userId,
    sessionId: session.sessionId,
  };
  event.locals.phone = (session as SMSSessionData).phone;

  return resolve(event);
};
