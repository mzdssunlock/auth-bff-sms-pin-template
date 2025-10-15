-- SurrealDB схема для SMS + PIN аутентификации
-- Для применения: docker exec -it surrealdb-auth /surreal sql -c http://localhost:8000 -u root -p root --ns auth_app --db main --pretty < schema.surql

-- Namespace и Database (уже созданы при подключении)
-- USE NS auth_app;
-- USE DB main;

-- Таблица пользователей
DEFINE TABLE users SCHEMAFULL;
DEFINE FIELD phone ON users TYPE string ASSERT $value != NONE AND string::len($value) > 10;
DEFINE FIELD pin_hash ON users TYPE option<string>;
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE FIELD last_login_at ON users TYPE datetime DEFAULT time::now();
DEFINE INDEX unique_phone ON users FIELDS phone UNIQUE;

-- Таблица OTP кодов
DEFINE TABLE otp_codes SCHEMAFULL;
DEFINE FIELD user_phone ON otp_codes TYPE string ASSERT $value != NONE;
DEFINE FIELD code ON otp_codes TYPE string ASSERT string::len($value) = 6;
DEFINE FIELD expires_at ON otp_codes TYPE datetime ASSERT $value > time::now();
DEFINE FIELD attempts ON otp_codes TYPE int DEFAULT 0 ASSERT $value >= 0 AND $value <= 10;
DEFINE FIELD verified ON otp_codes TYPE bool DEFAULT false;
DEFINE FIELD created_at ON otp_codes TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_phone_expires ON otp_codes FIELDS user_phone, expires_at;

-- Таблица попыток входа (аудит)
DEFINE TABLE login_attempts SCHEMAFULL;
DEFINE FIELD phone ON login_attempts TYPE string;
DEFINE FIELD attempt_type ON login_attempts TYPE string ASSERT $value IN ['otp', 'pin'];
DEFINE FIELD success ON login_attempts TYPE bool;
DEFINE FIELD ip_address ON login_attempts TYPE string;
DEFINE FIELD timestamp ON login_attempts TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_phone_timestamp ON login_attempts FIELDS phone, timestamp;

-- Примеры запросов для тестирования:

-- Создать пользователя
-- CREATE users SET phone = '+79991234567', pin_hash = NONE, created_at = time::now(), last_login_at = time::now();

-- Найти пользователя по телефону
-- SELECT * FROM users WHERE phone = '+79991234567';

-- Создать OTP код
-- CREATE otp_codes SET user_phone = '+79991234567', code = '123456', expires_at = time::now() + 5m, attempts = 0, verified = false;

-- Найти активные OTP коды
-- SELECT * FROM otp_codes WHERE user_phone = '+79991234567' AND expires_at > time::now();

-- Залогировать попытку входа
-- CREATE login_attempts SET phone = '+79991234567', attempt_type = 'otp', success = true, ip_address = '127.0.0.1', timestamp = time::now();

-- Очистка истёкших OTP
-- DELETE FROM otp_codes WHERE expires_at < time::now();

