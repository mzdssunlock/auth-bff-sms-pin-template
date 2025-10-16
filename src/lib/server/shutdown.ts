// Graceful shutdown handler для корректного закрытия соединений
import { db } from "./db/index.js";
import { smsBFF } from "./auth/sms-bff.js";

let isShuttingDown = false;

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] ${signal} received. Starting graceful shutdown...`);

  try {
    // Закрываем SMS BFF (sessions, rate limiters, etc.)
    console.log("[Shutdown] Closing SMS BFF...");
    await smsBFF.shutdown();

    // Закрываем соединение с базой данных
    console.log("[Shutdown] Closing database connection...");
    await db.end();

    console.log("[Shutdown] Graceful shutdown completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("[Shutdown] Error during graceful shutdown:", error);
    process.exit(1);
  }
}

// Регистрируем обработчики сигналов
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
