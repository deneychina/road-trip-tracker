#!/bin/bash

# Road Trip Tracker - APK Build Script
# This script builds the Android APK locally

set -e

echo " Building Road Trip Tracker APK..."

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Step 2: Build shared package
echo "🔨 Building shared package..."
npm run build -w @road-trip/shared

# Step 3: Build web app
echo "🌐 Building web app..."
npm run build -w road-trip-tracker

# Step 4: Sync Capacitor
echo "🔄 Syncing Capacitor..."
cd apps/web
npx cap sync android

# Step 5: Build APK
echo "📱 Building APK..."
cd android
chmod +x ./gradlew
./gradlew assembleRelease

echo "✅ APK built successfully!"
echo "📍 Location: apps/web/android/app/build/outputs/apk/release/app-release-unsigned.apk"
echo ""
echo "⚠️  Note: This is an unsigned APK. For distribution, you need to sign it."
echo "   See: https://developer.android.com/studio/publish/app-signing"
