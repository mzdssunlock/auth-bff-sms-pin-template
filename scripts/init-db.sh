#!/bin/bash
# Инициализация SurrealDB схемы
# Использование: ./scripts/init-db.sh

echo "🚀 Инициализация SurrealDB схемы..."

# Проверка, запущен ли контейнер
if ! docker ps | grep -q surrealdb-auth; then
  echo "❌ Контейнер surrealdb-auth не запущен"
  echo "Запустите: docker-compose up -d"
  exit 1
fi

# Применение схемы
docker exec -i surrealdb-auth /surreal sql \
  -c http://localhost:8000 \
  -u root \
  -p root \
  --ns auth_app \
  --db main \
  --pretty < src/lib/server/db/schema.surql

echo "✅ Схема применена успешно"

