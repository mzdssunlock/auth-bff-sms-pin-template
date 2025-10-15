// src/routes/profile/+page.server.ts
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db/surreal";

export const load: PageServerLoad = async ({ locals }) => {
  // Защита страницы - требуется авторизация
  if (!locals.user) {
    redirect(302, "/auth/sms-login");
  }

  // Получаем данные пользователя из БД
  const user = await db.getUserByPhone(locals.phone || "");

  if (!user) {
    redirect(302, "/auth/sms-login");
  }

  return {
    user: {
      userId: user.id.toString(), // Конвертируем RecordId в строку
      phone: user.phone,
      hasPIN: !!user.pin_hash,
      createdAt: user.created_at.toISOString(),
      lastLoginAt: user.last_login_at.toISOString(),
    },
  };
};
