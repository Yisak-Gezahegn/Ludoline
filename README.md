# 🎲 Ludoline — Online Ludo with Real Money

A full-stack online Ludo game with real-money wagering via **Telebirr (ETB)**.  
Supports **Web** (React.js) and **Mobile** (React Native / Expo).

---

## 🏗️ Architecture

```
ludoline/
├── backend/           Node.js + Fastify + Socket.IO
├── frontend-web/      React.js (web app)
├── frontend-mobile/   React Native / Expo (Android + iOS)
└── shared/            (common game logic, optional)
```

| Layer         | Technology                        |
|---------------|-----------------------------------|
| Backend       | Node.js + Fastify                 |
| Real-time     | Socket.IO (WebSockets)            |
| Database      | PostgreSQL 16                     |
| Cache/PubSub  | Redis 7                           |
| Payments      | Telebirr USSD Push API            |
| Auth          | JWT + OTP (SMS)                   |
| Mobile        | React Native (Expo)               |
| Web           | React.js                          |
| Languages     | English / አማርኛ / Afaan Oromo     |

---

## 💰 Prize Distribution

| Players | 1st     | 2nd    | 3rd  | Platform |
|---------|---------|--------|------|----------|
| 2       | 98%     | —      | —    | 2%       |
| 3       | 75%     | 23%    | —    | 2%       |
| 4       | 73.5%   | 19.5%  | 7%   | 2%       |

**Bet range:** 2 ETB minimum — 10,000 ETB maximum

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7
- (Mobile) Expo CLI, Android Studio / Xcode

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your DB, Redis, Telebirr credentials

npm install
# Run migrations
psql -U ludoline_user -d ludoline -f migrations/001_initial.sql

npm run dev
```

### 2. Web Frontend

```bash
cd frontend-web
npm install
npm start
```

### 3. Mobile App

```bash
cd frontend-mobile
npm install
npx expo start
```

### 4. Docker (Recommended for Production)

```bash
cd ludoline
cp backend/.env.example backend/.env
# Edit backend/.env

docker-compose up -d
```

---

## 📱 Features

### Player
- ✅ Phone OTP login (no password)
- ✅ 3-language support (English, Amharic, Afaan Oromo)
- ✅ Telebirr deposit & withdrawal
- ✅ Create public/private rooms
- ✅ Join rooms by code
- ✅ 2–4 player Ludo with full rules
- ✅ Real-time gameplay (Socket.IO)
- ✅ In-game live chat
- ✅ Turn timer (30 seconds)
- ✅ Auto-skip on inactivity (3 strikes → removed)
- ✅ Prize auto-distribution after game
- ✅ Leaderboard
- ✅ Match history
- ✅ Wallet with transaction history

### Security
- ✅ JWT authentication
- ✅ OTP rate limiting (5/hour per phone)
- ✅ Telebirr callback signature verification
- ✅ Database transactions for all money operations
- ✅ Input validation (Joi)
- ✅ Rate limiting (200 req/min)
- ✅ Helmet security headers
- ✅ SQL injection prevention (parameterized queries)
- ✅ Audit logs

---

## 🎮 Game Rules (Standard Ludo)

- Roll a **6** to enter a piece onto the board
- Roll **3 sixes in a row**: lose your turn (no move)
- Land on an opponent's piece: send it back to their yard (+5 pts)
- Land on a **safe square** (star ⭐ or starting square): cannot be killed
- Get a piece to the home center to finish it (+10 pts)
- First player to finish all 4 pieces wins
- **30 seconds** per turn; timeout = auto-skip

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| POST   | /api/auth/request-otp       | Send OTP to phone       |
| POST   | /api/auth/verify-otp        | Verify OTP, get JWT     |
| POST   | /api/auth/complete-profile  | Set username, full name |
| GET    | /api/auth/me                | Get current user        |

### Wallet
| Method | Endpoint                        | Description             |
|--------|---------------------------------|-------------------------|
| GET    | /api/wallet/balance             | Get balance             |
| POST   | /api/wallet/deposit             | Initiate Telebirr deposit |
| POST   | /api/wallet/telebirr/callback   | Telebirr webhook (public) |
| POST   | /api/wallet/withdraw            | Withdraw to Telebirr    |
| GET    | /api/wallet/transactions        | Transaction history     |

### Rooms
| Method | Endpoint              | Description             |
|--------|-----------------------|-------------------------|
| GET    | /api/rooms            | List public rooms       |
| POST   | /api/rooms            | Create room             |
| GET    | /api/rooms/:code      | Get room by code        |
| POST   | /api/rooms/:id/join   | Join room               |

---

## 🔌 Socket.IO Events

### Client → Server
| Event             | Payload                  |
|-------------------|--------------------------|
| room:join         | { roomId }               |
| room:leave        | { roomId }               |
| game:roll_dice    | { roomId }               |
| game:move_piece   | { roomId, pieceId }      |
| chat:send         | { roomId, message }      |

### Server → Client
| Event                  | Description                    |
|------------------------|--------------------------------|
| room:players_updated   | Player list changed            |
| game:started           | Game begins, initial state     |
| game:dice_rolled       | Dice result + movable pieces   |
| game:move_applied      | Move result + updated state    |
| game:next_turn         | Whose turn is next             |
| game:turn_timeout      | Turn timed out                 |
| game:over              | Game finished, final standings |
| game:abandoned         | Game cancelled (refund)        |
| chat:message           | New chat message               |

---

## ⚙️ Telebirr Integration

1. Register at [developer.ethiotelecom.et](https://developer.ethiotelecom.et/)
2. Get `APP_ID`, `APP_KEY`, `PUBLIC_KEY`, `SHORT_CODE`
3. Set `TELEBIRR_NOTIFY_URL` to your server's `/api/wallet/telebirr/callback`
4. For withdrawals, request B2C API access from Telebirr

---

## 🔒 Security Checklist

- [ ] Change `JWT_SECRET` in production
- [ ] Set strong `DB_PASSWORD`
- [ ] Configure real `TELEBIRR_*` credentials
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS in production (SSL certificate)
- [ ] Configure real SMS gateway (not dev mode)
- [ ] Set up database backups
- [ ] Monitor `logs/error.log`

---

## � Publishing the Mobile App

See the full guide: [`frontend-mobile/PUBLISHING.md`](frontend-mobile/PUBLISHING.md)

### Quickest path — APK in 15 minutes:

```powershell
# Install EAS CLI (once)
npm install -g eas-cli

# Login to Expo (free account)
eas login

# Go to mobile project
cd frontend-mobile
npm install

# Build APK on Expo's cloud servers
eas build --platform android --profile preview
```

- Expo builds it on their servers (free tier: 30 builds/month)
- Download link appears when done (~15 min)
- Share the `.apk` via WhatsApp, Telegram, or any download link
- Recipients enable "Unknown Sources" on Android and tap to install

### For Play Store / App Store:
- See `frontend-mobile/PUBLISHING.md` for full steps
- Requires Google Play ($25 one-time) or Apple Developer ($99/year)
- Real-money gambling apps need regulatory approval in Ethiopia

---

## �📞 Support

**App Name:** Ludoline  
**Contact:** admin@ludoline.com  
**Languages:** English | አማርኛ | Afaan Oromo
