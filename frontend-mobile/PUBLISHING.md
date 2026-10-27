# 📱 Ludoline — Mobile App Publishing Guide

This guide covers three distribution methods:

| Method | Time | Cost | Audience |
|--------|------|------|----------|
| **Direct APK** (Method 1) | 15 min | Free | Anyone with Android |
| **Google Play Store** (Method 2) | 1–3 days | $25 one-time | Android worldwide |
| **Apple App Store** (Method 3) | 1–7 days | $99/year | iPhone worldwide |

---

## ✅ Prerequisites (All Methods)

### 1. Install Node.js and npm
Download from: https://nodejs.org (LTS version)

### 2. Install EAS CLI (Expo Application Services)
```powershell
npm install -g eas-cli
```

### 3. Create a FREE Expo Account
Go to: https://expo.dev → Sign Up (free)

### 4. Login from terminal
```powershell
eas login
```

### 5. Set your backend URL in `.env`
Edit `frontend-mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://YOUR_SERVER_URL/api
EXPO_PUBLIC_SOCKET_URL=https://YOUR_SERVER_URL
```

### 6. Link project to your Expo account
```powershell
cd frontend-mobile
eas init --id YOUR_PROJECT_ID
```
Or create a new project:
```powershell
eas project:init
```

---

## 🤖 METHOD 1 — Direct APK (Android Only)
**Best for: Testing, sharing via WhatsApp/Telegram, internal distribution**

### Step 1 — Install dependencies
```powershell
cd d:\Gihon\Ludo_Online\ludoline\frontend-mobile
npm install
```

### Step 2 — Generate app assets (if not done)
```powershell
npm install canvas  # only for asset generation
node scripts/generate-assets.js
```
> 💡 Or design your own 1024×1024 icon.png, adaptive-icon.png, and 1284×2778 splash.png

### Step 3 — Build the APK on EAS cloud
```powershell
eas build --platform android --profile preview
```
- This uploads your code to **Expo's free build servers**
- Takes **10–20 minutes**
- You get a **download link** when done

### Step 4 — Download and share
1. Go to https://expo.dev → your project → Builds
2. Download the `.apk` file
3. **Share via:**
   - WhatsApp / Telegram (attach file)
   - Upload to Google Drive / Dropbox → share link
   - Host on your website as a direct download
   - Use https://apkpure.com or similar hosting

### Step 5 — Install on Android phone
On the recipient's phone:
1. Go to **Settings → Security → Unknown Sources** → Enable
   (or Settings → Apps → Special app access → Install unknown apps)
2. Open the APK file
3. Tap **Install**

---

## 🎯 METHOD 2 — Google Play Store

### Step 1 — Create Google Play Developer Account
1. Go to: https://play.google.com/console
2. Pay **$25 one-time fee** (USD)
3. Complete identity verification

### Step 2 — Create the app in Play Console
1. Click **Create app**
2. App name: **Ludoline**
3. Default language: English
4. App type: Game
5. Free app (but with in-app purchases: users deposit money)

### Step 3 — Build an AAB (Android App Bundle)
```powershell
cd d:\Gihon\Ludo_Online\ludoline\frontend-mobile
eas build --platform android --profile production
```
This produces a `.aab` file (Play Store format, smaller downloads).

### Step 4 — Configure store listing
In Play Console, fill in:
- **App description** (all 3 languages: EN, AM, OR)
- **Screenshots** (minimum 2, recommended 8)
- **Feature graphic** (1024×500 PNG)
- **Icon** (512×512 PNG)
- **Category:** Games → Board
- **Content rating:** Fill questionnaire (no violence, money gambling for adults)
- **Privacy policy URL** (required — host a page on your website)
- **Financial features:** Declare "real money gambling" — you MUST comply with Google's gambling policy

> ⚠️ **Important:** Real-money gambling apps require Google's approval.
> You need to provide proof of licensing from Ethiopian financial authorities.

### Step 5 — Upload and release
1. Go to **Release → Internal testing**
2. Upload the `.aab` file
3. Add testers (your team)
4. Promote to **Production** when ready

### Step 6 — EAS Auto-submit (optional)
After building, auto-submit to Play Store:
```powershell
eas submit --platform android
```
Requires `google-play-key.json` (service account key from Google Play Console).

---

## 🍎 METHOD 3 — Apple App Store

### Step 1 — Apple Developer Account
1. Go to: https://developer.apple.com
2. Pay **$99/year**
3. Enroll as an **Organization** (recommended for business apps)

### Step 2 — Build for iOS
```powershell
eas build --platform ios --profile production
```
This produces a `.ipa` file.

### Step 3 — App Store Connect
1. Go to: https://appstoreconnect.apple.com
2. Create new app
3. Bundle ID: `com.ludoline.app`
4. Fill in metadata (name, description, screenshots)
5. Age Rating: 17+ (due to gambling)
6. Upload via EAS submit or Transporter app

### Step 4 — Submit for review
Apple review takes **1–7 days**.
Real-money gambling apps need **proof of gambling license**.

---

## 🚀 RECOMMENDED FLOW for Immediate Distribution

### Today (15 minutes):
```powershell
# 1. Go to project
cd d:\Gihon\Ludo_Online\ludoline\frontend-mobile

# 2. Install everything
npm install

# 3. Login to Expo
eas login

# 4. Initialize EAS project
eas init

# 5. Build APK
eas build --platform android --profile preview
```

### Result:
- You get an APK download link in ~15 minutes
- Share to anyone's Android phone immediately
- No Play Store needed yet

---

## 📋 Pre-Launch Checklist

### App
- [ ] Replace placeholder assets with real design (icon, splash)
- [ ] Set real backend URL in `.env`
- [ ] Test all game flows end-to-end
- [ ] Test Telebirr deposit/withdrawal
- [ ] Test on real Android device

### Legal (Required for Money App)
- [ ] Get business registration certificate (Ethiopia)
- [ ] Get National Bank of Ethiopia authorization for money service
- [ ] Get Ethiopian Communications Authority app approval
- [ ] Privacy Policy page (required by Google/Apple)
- [ ] Terms & Conditions page
- [ ] Age verification (18+ for gambling)
- [ ] Anti-money laundering (AML) compliance

### Store Listing
- [ ] App icon (1024×1024)
- [ ] Splash screen
- [ ] 8+ screenshots (EN, AM, OR)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Feature graphic (1024×500)
- [ ] Privacy policy URL

---

## 🖼️ App Assets Needed

| Asset | Size | Format |
|-------|------|--------|
| App Icon | 1024×1024 px | PNG (no alpha for iOS) |
| Adaptive Icon (Android) | 1024×1024 px | PNG (with transparent bg) |
| Splash Screen | 1284×2778 px | PNG |
| Play Store Icon | 512×512 px | PNG |
| Feature Graphic | 1024×500 px | PNG/JPG |
| Screenshots | 1080×1920 px | PNG/JPG (min 2, max 8) |

Use tools like **Canva**, **Figma**, or **Adobe Express** to design these.

---

## 🆘 Common Issues

**"Build failed: google-services.json not found"**
→ Copy `google-services.json.example` to `google-services.json` and fill in values (or remove `googleServicesFile` from app.json if not using Firebase)

**"eas: command not found"**
→ Run: `npm install -g eas-cli`

**"Not logged in"**
→ Run: `eas login`

**"Project not linked"**
→ Run: `eas init` in the frontend-mobile directory

**APK installs but shows blank screen**
→ Check that `EXPO_PUBLIC_API_URL` in `.env` points to a running backend server
