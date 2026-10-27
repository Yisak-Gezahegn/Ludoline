#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# build-apk.sh  —  Builds a Ludoline APK using EAS Build (cloud)
# Usage: bash scripts/build-apk.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "🎲 Ludoline APK Builder"
echo "═══════════════════════"

# 1. Check EAS CLI
if ! command -v eas &> /dev/null; then
  echo "📦 Installing EAS CLI..."
  npm install -g eas-cli
fi

# 2. Check login
echo "🔐 Checking Expo login..."
eas whoami || eas login

# 3. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Build APK (preview profile = direct install APK)
echo "🔨 Building APK (this takes ~10–15 min on EAS servers)..."
eas build --platform android --profile preview --non-interactive

echo ""
echo "✅ Build complete!"
echo "📱 Download the APK from: https://expo.dev"
echo "   Share the download link to install on any Android phone."
