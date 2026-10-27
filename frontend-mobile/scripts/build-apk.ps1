# ─────────────────────────────────────────────────────────────
# build-apk.ps1 — Builds a Ludoline APK using EAS Build (cloud)
# Usage (PowerShell): .\scripts\build-apk.ps1
# ─────────────────────────────────────────────────────────────

Write-Host "🎲 Ludoline APK Builder" -ForegroundColor Cyan
Write-Host "═══════════════════════" -ForegroundColor Cyan

# 1. Check EAS CLI
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Write-Host "📦 Installing EAS CLI..." -ForegroundColor Yellow
    npm install -g eas-cli
}

# 2. Check login
Write-Host "🔐 Checking Expo login..." -ForegroundColor Yellow
try {
    eas whoami 2>$null
} catch {
    Write-Host "Please login to Expo:" -ForegroundColor Yellow
    eas login
}

# 3. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# 4. Build APK
Write-Host "🔨 Building APK (preview profile)..." -ForegroundColor Green
Write-Host "   This runs on Expo's cloud servers (~10–15 min)" -ForegroundColor Gray
eas build --platform android --profile preview --non-interactive

Write-Host ""
Write-Host "✅ Build submitted to EAS!" -ForegroundColor Green
Write-Host "📱 Check status at: https://expo.dev/accounts/[your-account]/projects/ludoline/builds" -ForegroundColor Cyan
Write-Host "   Download the APK and share via WhatsApp, Telegram, or a download link." -ForegroundColor Cyan
