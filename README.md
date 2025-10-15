# 🔐 Auth BFF SMS + PIN Template

Production-ready **SvelteKit 5** authentication template with **SMS** and **PIN** authorization using **BFF pattern**, **SurrealDB**, and **enterprise-grade security**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-FF3E00?logo=svelte)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## 🌟 Features

### 🔒 Security First

- ✅ **Argon2id** password hashing (OWASP recommended)
- ✅ **HTTP-only cookies** (XSS protection)
- ✅ **SameSite=Strict** (CSRF protection)
- ✅ **Rate limiting** (brute-force protection)
- ✅ **Security headers** (HSTS, CSP, X-Frame-Options)
- ✅ **SQL injection protection** (parameterized queries)
- ✅ **IP logging** for audit trails

### 🏗️ Modern Architecture

- ✅ **BFF Pattern** (Backend for Frontend)
- ✅ **Remote Functions** (type-safe client-server communication)
- ✅ **Clean Architecture** (separation of concerns)
- ✅ **TypeScript** strict mode
- ✅ **Zero client-side secrets** (everything server-side)

### 📱 SMS + PIN Authentication

- ✅ SMS OTP (6 digits, 5 min expiration)
- ✅ PIN setup after first login
- ✅ Quick login with PIN for returning users
- ✅ Mock SMS provider for development
- ✅ Easy integration with real SMS providers

### 🗄️ Database & Session Management

- ✅ **SurrealDB** for data persistence
- ✅ **Redis** support for sessions (production-ready)
- ✅ **Memory store** for development
- ✅ Session auto-renewal
- ✅ Full audit logging

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker** (for SurrealDB)

### Installation

```bash
# Clone the repository
git clone https://github.com/FrankFMY/auth-bff-sms-pin-template.git
cd auth-bff-sms-pin-template

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate SESSION_SECRET
openssl rand -base64 32
# Add to .env: SESSION_SECRET=<generated_key>

# Start SurrealDB via Docker
docker compose up -d

# Start development server
npm run dev
```

Open [http://localhost:5173/auth/sms-login](http://localhost:5173/auth/sms-login)

---

## 📋 Environment Variables

Create `.env` file:

```env
# SurrealDB
DB_USER=root
DB_PASSWORD=root
DB_HOST=http://localhost:8000
DB_NAMESPACE=auth_app
DB_DATABASE=main

# SMS Provider (mock for development)
SMS_API_KEY=mock_key_for_development
SMS_API_URL=https://api.sms.ru/sms/send
SMS_SENDER_NAME=AuthApp

# Session
SESSION_SECRET=<generated_32+_characters>
SESSION_MAX_AGE=86400

# Rate Limiting
RATE_LIMIT_OTP_MAX=3
RATE_LIMIT_OTP_WINDOW_MS=60000
RATE_LIMIT_PIN_MAX=5
RATE_LIMIT_PIN_WINDOW_MS=900000

# Environment
NODE_ENV=development
```

---

## 🏗️ Architecture

### System Architecture

```mermaid
graph TB
    Client[🌐 Client Browser<br/>Svelte 5 + Runes Mode]

    subgraph SvelteKit["🚀 SvelteKit Server"]
        RemoteFunctions[📡 Remote Functions Layer<br/>requestOTP, verifyOTP<br/>setupPIN, loginWithPIN]
        ServiceLayer[⚙️ Service Layer<br/>sms-service.ts]

        subgraph AuthLogic["🔐 Authentication Logic"]
            SMSAuth[SMS Auth Service<br/>Argon2, OTP Generation]
            RateLimit[Rate Limiter<br/>Brute-force Protection]
            SessionStore[Session Store<br/>Memory/Redis]
        end
    end

    Database[(🗄️ SurrealDB<br/>━━━━━━━━━━<br/>📊 Users<br/>📱 OTP Codes<br/>📝 Login Attempts)]

    Client -->|Type-Safe RPC| RemoteFunctions
    RemoteFunctions --> ServiceLayer
    ServiceLayer --> AuthLogic
    SMSAuth --> Database
    RateLimit --> Database
    SessionStore --> Database

    style Client fill:#FF3E00,stroke:#333,stroke-width:2px,color:#fff
    style SvelteKit fill:#FF3E00,stroke:#333,stroke-width:3px,color:#fff
    style Database fill:#9333EA,stroke:#333,stroke-width:2px,color:#fff
    style AuthLogic fill:#10B981,stroke:#333,stroke-width:2px
```

### Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as 🎨 Svelte UI
    participant RF as 📡 Remote Functions
    participant Auth as 🔐 Auth Service
    participant DB as 🗄️ SurrealDB
    participant SMS as 📱 SMS Provider

    %% SMS Login Flow
    User->>UI: Enters phone number
    UI->>RF: requestOTP(phone)
    RF->>Auth: sendOTP(phone)
    Auth->>Auth: Generate 6-digit OTP
    Auth->>DB: Store OTP (5 min expiry)
    Auth->>SMS: Send SMS
    SMS-->>User: 📩 SMS with OTP code
    Auth-->>RF: Success
    RF-->>UI: OTP sent

    %% OTP Verification
    User->>UI: Enters OTP code
    UI->>RF: verifyOTP(phone, code)
    RF->>Auth: verifyOTP(phone, code, IP)
    Auth->>DB: Check OTP validity

    alt OTP Valid
        Auth->>DB: Create/Update User
        Auth->>DB: Log login attempt (success)
        Auth->>DB: Delete used OTP
        Auth-->>RF: Success + requiresPinSetup
        RF->>RF: Create HTTP-only session
        RF-->>UI: Success

        alt First Time User
            UI->>UI: Show PIN setup
            User->>UI: Creates PIN (4-6 digits)
            UI->>RF: setupPIN(pin)
            RF->>Auth: setupPIN(userId, pin)
            Auth->>Auth: Hash PIN (Argon2id)
            Auth->>DB: Save PIN hash
            Auth-->>RF: Success
            RF-->>UI: PIN setup complete
        end

        UI->>UI: Redirect to Dashboard
    else OTP Invalid
        Auth->>DB: Increment attempts
        Auth->>DB: Log login attempt (failed)
        Auth-->>RF: Error + attemptsLeft
        RF-->>UI: Show error
    end

    %% PIN Login Flow (Returning Users)
    User->>UI: Enter phone + PIN
    UI->>RF: loginWithPIN(phone, pin)
    RF->>Auth: loginWithPIN(phone, pin, IP)
    Auth->>DB: Get user by phone
    Auth->>Auth: Verify PIN (Argon2)

    alt PIN Valid
        Auth->>DB: Log login attempt (success)
        Auth-->>RF: Success
        RF->>RF: Create HTTP-only session
        RF-->>UI: Success
        UI->>UI: Redirect to Dashboard
    else PIN Invalid
        Auth->>DB: Log login attempt (failed)
        Auth-->>RF: Error
        RF-->>UI: Show error
    end
```

---

## 📂 Project Structure

```
src/
├── lib/
│   └── server/
│       ├── auth/
│       │   ├── sms-auth.ts          # Core SMS/PIN logic
│       │   ├── sms-service.ts       # Service layer for Remote Functions
│       │   ├── sms-bff.ts           # BFF API (HonoJS)
│       │   ├── sms-middleware.ts    # Session middleware
│       │   ├── sms-rate-limiter.ts  # Rate limiting
│       │   └── stores/
│       │       ├── memory.ts        # Memory session store (dev)
│       │       └── redis.ts         # Redis session store (prod)
│       ├── db/
│       │   └── surreal.ts           # SurrealDB client
│       └── sms/
│           ├── mock-provider.ts     # Mock SMS for dev
│           └── real-provider.ts     # Real SMS provider
└── routes/
    ├── auth/
    │   ├── data.remote.ts           # Remote Functions
    │   └── sms-login/
    │       └── +page.svelte         # Login UI
    ├── +layout.server.ts            # Global layout load
    └── +page.svelte                 # Home page
```

---

## 🔒 Security Features

### Authentication Flow

1. **SMS OTP Request**
   - User enters phone number
   - System generates 6-digit OTP (crypto.randomInt)
   - OTP stored in SurrealDB with 5-minute expiration
   - SMS sent (mock in dev, real in prod)

2. **OTP Verification**
   - User enters OTP code
   - System validates against SurrealDB
   - Max 3 attempts before lockout
   - IP address logged for audit

3. **PIN Setup** (first-time users)
   - User creates 4-6 digit PIN
   - Validated against weak patterns (1234, 1111, etc.)
   - Hashed with Argon2id (64MB memory, 3 iterations)
   - Stored in SurrealDB

4. **PIN Login** (returning users)
   - User enters phone + PIN
   - PIN verified against Argon2 hash
   - Max 5 attempts per 15 minutes
   - Session created with HTTP-only cookie

### Rate Limiting

| Operation        | Limit      | Window     |
| ---------------- | ---------- | ---------- |
| OTP Request      | 3 attempts | 1 minute   |
| OTP Verification | 3 attempts | 1 minute   |
| PIN Login        | 5 attempts | 15 minutes |

### Security Headers

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (production only)
- `Content-Security-Policy`

---

## 🧪 Testing

```bash
# Type checking
npm run check

# Linting
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

---

## 🚀 Production Deployment

### 1. Generate Secrets

```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Update .env.production
SESSION_SECRET=<generated_key>
DB_USER=prod_user_$(openssl rand -hex 4)
DB_PASSWORD=$(openssl rand -base64 24)
```

### 2. Switch to Redis (Recommended)

Edit `src/lib/server/auth/sms-bff.ts`:

```typescript
// Replace:
import { MemorySessionStore } from "./stores/memory";
this.sessionStore = sessionStore ?? new MemorySessionStore();

// With:
import { RedisSessionStore } from "./stores/redis";
this.sessionStore = sessionStore ?? new RedisSessionStore();
```

Add Redis to `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
```

### 3. Configure Real SMS Provider

Update `src/lib/server/sms/index.ts`:

```typescript
import { RealSMSProvider } from "./real-provider";

export const smsProvider = new RealSMSProvider({
  apiKey: process.env.SMS_API_KEY!,
  apiUrl: process.env.SMS_API_URL!,
});
```

### 4. Deploy

```bash
npm run build
npm run preview
```

---

## 📚 Documentation

- [Security Audit Report](./docs/SECURITY_AUDIT.md) - Full security analysis
- [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) - Deployment guide
- [Redis Setup Guide](./docs/REDIS_SETUP.md) - Redis configuration

---

## 🛠️ Tech Stack

- **[SvelteKit 5](https://kit.svelte.dev/)** - Web framework
- **[Svelte 5](https://svelte.dev/)** - UI framework (Runes Mode)
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[SurrealDB](https://surrealdb.com/)** - Database
- **[Argon2](https://github.com/ranisalt/node-argon2)** - Password hashing
- **[HonoJS](https://hono.dev/)** - BFF framework
- **[Valibot](https://valibot.dev/)** - Schema validation
- **[Redis](https://redis.io/)** - Session storage (optional)

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 👤 Author

**FrankFMY**

- GitHub: [@FrankFMY](https://github.com/FrankFMY)
- Telegram: [@FrankFMY](https://t.me/FrankFMY)
- Email: Pryanishnikovartem@gmail.com

---

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⭐ Show your support

Give a ⭐️ if this project helped you!

---

## 🔐 Security

If you discover a security vulnerability, please email Pryanishnikovartem@gmail.com

**Do NOT open a public issue.**

---

## 📊 Project Status

✅ **Production Ready** - Fully tested and secure

- ✅ 0 TypeScript errors
- ✅ 0 ESLint warnings
- ✅ 100% security audit passed
- ✅ Parameterized SQL queries
- ✅ IP logging implemented
- ✅ Rate limiting configured
- ✅ Security headers enabled

---

Made with ❤️ by [FrankFMY](https://github.com/FrankFMY)
