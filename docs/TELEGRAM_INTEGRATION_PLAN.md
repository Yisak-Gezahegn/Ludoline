# Telegram Verification Integration Plan

## Architecture Discovered

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, react-router-dom v6, axios, framer-motion, react-hot-toast, i18next (EN/AM/OR) |
| Backend | Node.js + Fastify v4, @fastify/jwt, PostgreSQL, Redis |
| Auth | Phone number → SMS OTP → JWT (localStorage) |
| DB | PostgreSQL with users, rooms, transactions, audit_logs tables |
| Cache | Redis for OTP storage, game state, rate limiting |

## Integration Strategy

Replace the SMS OTP delivery channel with Telegram delivery, while keeping the exact same
frontend flow (phone → OTP → profile) and backend JWT auth system. The Telegram bot
(`@LudolineVerifyBot`) is a separate service that:

1. Receives a linking token from the Ludoline backend
2. Validates it against the backend
3. Associates the Telegram user with the pending phone session
4. Sends the OTP to the Telegram chat

## Bot Service Contract

Since `@LudolineVerifyBot` is a separate project not present in this workspace, we define
the required contract here. The bot service must expose these HTTP endpoints to the Ludoline backend:

### POST /bot/link-session/validate
Called by Ludoline backend when the bot receives a deep-link start.
**Request:**
```json
{ "token": "abc123" }
```
**Response 200:**
```json
{ "valid": true, "sessionId": "uuid", "telegramUserId": 123456789 }
```
**Response 400/404:** `{ "valid": false, "reason": "expired|used|not_found" }`

### POST /bot/otp/send
Called by Ludoline backend to trigger OTP delivery.
**Request:**
```json
{ "sessionId": "uuid", "otp": "123456", "language": "en" }
```
**Response 200:**
```json
{ "delivered": true, "messageId": "..." }
```

### GET /bot/session/:sessionId/status
Called by Ludoline backend to check if the Telegram account has linked.
**Response:**
```json
{ "status": "pending|linked|expired", "telegramUserId": 123456789 }
```

The bot calls back to Ludoline backend when a user presses Start:
### POST /api/auth/telegram/bot-callback (Ludoline backend)
Protected by a shared secret (`TELEGRAM_BOT_SERVICE_SECRET`).
**Request:**
```json
{ "token": "abc123", "telegramUserId": 123456789, "telegramUsername": "username" }
```

## Database Changes

New migration `002_telegram_verification.sql`:
- `telegram_link_sessions` table: stores short-lived linking sessions
- `users` table: add `telegram_id`, `telegram_username` columns

## Files Changed / Created

### Backend
- `migrations/002_telegram_verification.sql` — schema addition
- `src/config/redis.js` — add Telegram session helpers
- `src/services/telegram/telegramBotAdapter.js` — HTTP adapter to bot service
- `src/services/telegram/telegramAuthService.js` — business logic for linking + OTP
- `src/routes/telegramAuth.js` — new Fastify routes
- `src/utils/validators.js` — add new Joi schemas
- `src/index.js` — register new route prefix
- `.env.example` — add TELEGRAM_* variables

### Frontend Web
- `src/api/client.js` — add telegramAuthAPI
- `src/i18n/index.js` — add Telegram i18n keys (EN/AM/OR)
- `src/hooks/useTelegramVerification.js` — stateful hook
- `src/components/auth/TelegramVerificationPanel.js` — UI component
- `src/pages/LoginPage.js` — add Telegram tab alongside SMS

### Documentation
- `docs/TELEGRAM_INTEGRATION_PLAN.md` (this file)
- `docs/TELEGRAM_GAME_INTEGRATION.md` — full integration doc

## Security Decisions
- Linking tokens: UUID v4 + HMAC signature, 10-minute TTL, single-use
- Bot callback protected by shared secret header
- OTP never stored in DB plaintext; stored only in Redis with TTL
- No Telegram credentials in frontend
- Telegram user ID stored server-side only
- Rate limit: 3 linking sessions per phone per hour
