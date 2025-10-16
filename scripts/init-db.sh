#!/bin/bash
# Инициализация PostgreSQL схемы через Drizzle Kit
# Использование: ./scripts/init-db.sh

echo "🚀 Инициализация PostgreSQL схемы через Drizzle..."

# Проверка, запущен ли контейнер PostgreSQL
if ! docker ps | grep -q postgres-auth; then
  echo "❌ Контейнер postgres-auth не запущен"
  echo "Запустите: docker compose up -d"
  exit 1
fi

echo "📦 Ожидание готовности PostgreSQL..."
sleep 2

# Проверка подключения к PostgreSQL
if ! docker exec postgres-auth pg_isready -U postgres > /dev/null 2>&1; then
  echo "❌ PostgreSQL не готов принимать подключения"
  exit 1
fi

echo "✅ PostgreSQL готов"
echo "🔄 Применение миграций..."

# Применение миграций через Drizzle Kit
npm run db:push

echo "✅ Схема применена успешно"
echo "💡 Для просмотра БД используйте: npm run db:studio"
