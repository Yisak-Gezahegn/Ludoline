# Ludoline × @LudolineVerifyBot Integration

## 1. Architecture Overview

```
Browser/App
    │  (HTTPS)
    ▼
Ludoline Frontend (React)
    │  /api/auth/telegram/*  (HTTPS)
    ▼
Ludoline Backend (Fastify + PostgreSQL + Redis)
    │  x-service-secret header  (private network / HTTPS)
    ▼
@LudolineVerifyBot Service (separate Node.js process)
    │  sendMessage()
    ▼
Telegram API → User's Telegram app
```

The frontend **never** contacts Telegram directly.  
The Telegram bot **never** contacts the browser.  
All OTP logic is server-side.

---

## 2. Files Changed

### Backend
| File | Change |
|------|--------|
| `src/config/redis.js` | Added Telegram session/OTP helpers |
| `src/services/telegram/telegramBotAdapter.js` | **New** — HTTP client to bot service |
| `src/services/telegram/telegramAuthService.js` | **New** — business logic |
| `src/routes/telegramAuth.js` | **New** — 6 Fastify routes |
| `src/index.js` | Registered `/api/auth/telegram` prefix |
| `src/models/User.js` | Added `telegram_linked` to getProfile, added `findByTelegramId` |
| `migrations/002_telegram_verification.sql` | **New** — schema addition |
| `migrations/002_telegram_verification_rollback.sql` | **New** — rollback |
| `.env.example` | Added `TELEGRAM_*` variables |
| `package.json` | Added jest dev dependency + test script |
| `tests/telegramAuth.test.js` | **New** — 17 unit/integration tests |

### Frontend Web
| File | Change |
|------|--------|
| `src/api/client.js` | Added `telegramAuthAPI` |
| `src/i18n/index.js` | Added Telegram keys in EN / አማርኛ / Afaan Oromo |
| `src/hooks/useTelegramVerification.js` | **New** — stateful verification hook |
| `src/components/auth/TelegramVerificationPanel.js` | **New** — full UI component |
| `src/pages/LoginPage.js` | Added Telegram/SMS tab switcher |
| `src/__tests__/TelegramVerification.test.js` | **New** — 17 frontend tests |

---

## 3. New Environment Variables

Add to `backend/.env`:

```bash
# Name of the Telegram bot (without @)
TELEGRAM_BOT_NAME=LudolineVerifyBot

# URL where @LudolineVerifyBot backend service is running
TELEGRAM_BOT_SERVICE_URL=http://localhost:4000

# Shared secret between Ludoline backend and the bot service
# Generate: openssl rand -hex 32
TELEGRAM_BOT_SERVICE_SECRET=<32-byte-hex>

# HMAC secret for signing linking tokens
# Generate: openssl rand -hex 32
TELEGRAM_HMAC_SECRET=<32-byte-hex>
```

---

## 4. Bot Service Contract

The `@LudolineVerifyBot` service must implement:

### Endpoints the bot EXPOSES (called by Ludoline backend)

#### POST /bot/otp/send
```
Header: x-service-secret: <TELEGRAM_BOT_SERVICE_SECRET>
Body:   { sessionId, otp, language, telegramId }
→ 200: { delivered: true, messageId: "..." }
→ 4xx: { delivered: false, reason: "user_not_found|blocked|rate_limited" }
```

#### GET /bot/session/:sessionId/status
```
Header: x-service-secret: <TELEGRAM_BOT_SERVICE_SECRET>
→ 200: { status: "pending"|"linked"|"expired", telegramId, telegramUsername }
```

### Endpoint the bot CALLS (on Ludoline backend)

#### POST /api/auth/telegram/bot-callback
```
Header: x-bot-secret: <TELEGRAM_BOT_SERVICE_SECRET>
Body:   { token, telegramId, telegramUsername }
→ 200: { success: true }
→ 400: { success: false, error: "INVALID_TOKEN"|"EXPIRED"|"ALREADY_LINKED" }
```

**When does the bot call this?**  
When a user opens the deep link `https://t.me/LudolineVerifyBot?start=<token>` and presses Start, the bot extracts the token from the `/start` payload and calls this endpoint.

---

## 5. Registration & Linking Sequence

```
User                       Frontend               Backend               Bot Service         Telegram
 │── enter phone ──────────►│                       │                     │                  │
 │                          │── POST start-session─►│                     │                  │
 │                          │                       │── create DB session  │                  │
 │                          │                       │── store in Redis     │                  │
 │                          │◄── { sessionId,       │                     │                  │
 │                          │     deepLink }        │                     │                  │
 │◄── show "Open Bot" btn ──│                       │                     │                  │
 │── tap deep link ─────────────────────────────────────────────────────►│                  │
 │                                                                         │── /start token ─►│
 │                                                                         │◄─ Telegram user  │
 │                                                                         │── bot-callback ─►│
 │                          │                       │◄─ POST bot-callback  │                  │
 │                          │                       │── validate token     │                  │
 │                          │                       │── link Telegram ID   │                  │
 │                          │                       │── generate OTP       │                  │
 │                          │                       │── store in Redis     │                  │
 │                          │                       │── POST /bot/otp/send►│                  │
 │                          │                       │                     │── sendMessage ───►│
 │◄── receives OTP in TG ───────────────────────────────────────────────────────────────────│
 │── enters OTP ────────────►│                       │                     │                  │
 │                          │── POST verify-otp ───►│                     │                  │
 │                          │                       │── check Redis OTP    │                  │
 │                          │                       │── create/update user │                  │
 │                          │◄── { token, user }    │                     │                  │
 │◄── redirected to lobby ──│                       │                     │                  │
```

---

## 6. OTP Confirmation Sequence

1. Frontend sends `POST /api/auth/telegram/verify-otp` with `{ sessionId, otp, phone, language }`
2. Backend:
   - Locks session row for update (prevents race conditions)
   - Checks session ownership (phone must match)
   - Checks session status is `linked` (not pending/expired/cancelled)
   - Checks expiry
   - Checks attempt count (max 5)
   - Increments attempt counter **before** checking OTP value
   - Fetches OTP from Redis
   - Compares with timing-safe equality
   - On success: deletes OTP from Redis, marks session `verified`, creates/updates user
3. Returns JWT token if successful

---

## 7. Security Decisions

| Decision | Rationale |
|----------|-----------|
| Linking tokens signed with HMAC | Prevents forgery of tokens not issued by us |
| Redis tombstone for used tokens | Prevents replay attacks within TTL window |
| Bot callback protected by shared secret | Bot service cannot be spoofed by external callers |
| OTP attempt counter incremented before check | Prevents timing attacks that avoid the counter |
| Phone ownership check on every endpoint | Prevents cross-session attacks |
| DB transaction with row-level lock for OTP verify | Prevents race conditions on concurrent submissions |
| OTP stored in Redis only (not DB) | Minimizes exposure; auto-expires without cleanup job |
| Telegram ID stored server-side only | Never sent to browser until account is activated |
| `is_verified` only set after OTP confirmation | Bot callback alone doesn't grant verified status |
| Session rate limit: 3/phone/hour | Prevents session spam and OTP delivery abuse |

---

## 8. Local Development Setup

```bash
# Backend
cd backend
cp .env.example .env
# Fill in TELEGRAM_BOT_NAME, TELEGRAM_BOT_SERVICE_SECRET, TELEGRAM_HMAC_SECRET
# Leave TELEGRAM_BOT_SERVICE_URL as-is if running bot locally on port 4000
# In dev mode (NODE_ENV=development), OTPs are logged instead of delivered
npm run dev
```

```bash
# Apply migration
psql -U ludoline_user -d ludoline -f migrations/002_telegram_verification.sql
```

```bash
# Frontend
cd frontend-web
npm start
```

In **development mode**, when `TELEGRAM_BOT_SERVICE_SECRET` is empty or `NODE_ENV=development`:
- OTP is printed to the backend console log instead of being sent to Telegram
- Bot callback can be simulated with:

```bash
curl -X POST http://localhost:3001/api/auth/telegram/bot-callback \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: YOUR_SECRET" \
  -d '{"token":"YOUR_LINKING_TOKEN","telegramId":12345678,"telegramUsername":"testuser"}'
```

The linking token appears in the backend logs when the session is created.

---

## 9. Running Tests

```bash
# Backend unit tests (requires: npm install jest --save-dev)
cd backend
npm test

# Frontend tests (requires: npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jest-environment-jsdom)
cd frontend-web
npm test -- --watchAll=false
```

---

## 10. Common Errors & Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `TG_SESSION_RATE_LIMITED` | > 3 sessions/phone/hour | Wait 1 hour or clear Redis `tg_session_attempts:*` key |
| `TG_INVALID_TOKEN` | Wrong HMAC secret or tampered token | Ensure `TELEGRAM_HMAC_SECRET` is same in both backend instances |
| `TG_TOKEN_ALREADY_USED` | Deep link opened twice | User must start a new session |
| `TG_ALREADY_LINKED` | Telegram ID already has an account | User should log in instead |
| `TG_OTP_EXPIRED` | OTP TTL (5 min) elapsed | User must resend |
| `BOT_STATUS_UNAVAILABLE` | Bot service unreachable | Check `TELEGRAM_BOT_SERVICE_URL` |
| `TELEGRAM_DELIVERY_FAILED` | Bot can't message user | User must start the bot first |
| Bot callback returns 401 | Wrong `x-bot-secret` header | Ensure secret matches in both services |
| Session stays `pending` | Bot callback never arrived | Verify bot is calling `/api/auth/telegram/bot-callback` |

---

## 11. Outstanding Dependencies

| Item | Status | Action Required |
|------|--------|-----------------|
| @LudolineVerifyBot service | Not in this workspace | Implement bot service per Section 4 contract |
| `TELEGRAM_BOT_SERVICE_SECRET` | Not configured | Generate and deploy to both services |
| `TELEGRAM_HMAC_SECRET` | Not configured | Generate and deploy to backend |
| DB migration 002 | Not applied | Run `psql ... -f migrations/002_telegram_verification.sql` |
| Real Telebirr production config | Not configured | Separate task |
| Mobile app (React Native) | Not integrated | Apply same pattern to LoginScreen.js |

---

## 12. What is NOT done (intentional)

- **Phone ownership proof**: Telegram linking proves Telegram account ownership, not phone number ownership. The phone number is associated but not independently verified via carrier. This is acceptable per current product requirements.
- **Real-money features**: Wallet deposit/withdraw remain disabled pending Ethiopian regulatory approval. This integration does not change financial behavior.
- **iOS App Store / Play Store submission**: Requires separate build process.
