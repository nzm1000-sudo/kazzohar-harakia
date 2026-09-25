# iOS Deployment Quick Reference

## One-Command Deploy to iPhone

```bash
npm run deploy:iphone
```

This single command:
- ✅ Removes stale builds
- ✅ Builds with native configuration (VITE_NATIVE=true)
- ✅ Verifies all asset paths are relative (./assets/...)
- ✅ Syncs to Capacitor iOS project
- ✅ Builds Release for physical device
- ✅ Installs to iPhone
- ✅ Launches the app

**Expected Result:** App displays TODAY PAGE (not black screen)

---

## What NOT To Do ❌

These commands will cause **BLACK SCREEN** on iOS:

```bash
❌ npm run build                          # Creates wrong paths for native
❌ npm run cap:sync                       # Uses plain npm run build
❌ Manual Xcode build with old dist/      # No automatic verification
❌ npm run build && npx cap sync && ...   # Wrong build type
```

---

## Device Info

- **UDID:** `00008150-0001146A01DA401C`
- **Bundle ID:** `com.kzohaar.app`
- **App Name:** כזוהר הרקיע

---

## Why This Matters

The app runs in iOS WebView which requires **relative asset paths** (`./assets/...`) but the default web build produces **absolute paths** (`/kazzohar-harakia/assets/...`). These absolute paths don't resolve on the iOS file system, resulting in a black screen.

The deployment script automates the correct build process and verifies paths at every step.

---

## Full Documentation

See [docs/native-development.md](docs/native-development.md) for:
- Detailed troubleshooting
- Manual build steps (for development)
- Runtime behavior and configuration
- Platform-specific decisions
