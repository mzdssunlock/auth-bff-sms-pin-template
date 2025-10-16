import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Загружаем переменные окружения из .env
config();

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || "5433"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "myapp",
    ssl: false,
  },
  verbose: true,
  strict: true,
});
