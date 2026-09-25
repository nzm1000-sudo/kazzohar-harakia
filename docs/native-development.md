# Native Development & iOS Deployment

The native shells package the local Vite output from `dist/`. They do not load the GitHub Pages site at runtime.

## ⚠️ CRITICAL: Black Screen Prevention Rule

**Do NOT use plain `npm run build` for native deployment.** This creates absolute GitHub-Pages paths (`/kazzohar-harakia/assets/...`) that break on iOS WebView and display a black screen.

**ALWAYS use ONE of these:**
- `npm run deploy:iphone` ← **Recommended: One-command deploy to physical iPhone**
- `npm run build:native` → `npx cap sync ios` ← Manual build steps (for development only)

### The Problem

| Build Command | Asset Paths | Native Result |
|---|---|---|
| `npm run build` | `/kazzohar-harakia/assets/...` | ❌ BLACK SCREEN (absolute paths don't resolve on iOS file://) |
| `npm run build:native` | `./assets/...` | ✅ WORKS (relative paths for Capacitor WebView) |

### The Solution

Use `npm run deploy:iphone` which **automatically:**
1. ✓ Removes stale dist
2. ✓ Runs `npm run build:native` (never plain `npm run build`)
3. ✓ Verifies dist/index.html uses relative `./assets/...` paths
4. ✓ Verifies no PWA service worker in native build
5. ✓ Syncs to Capacitor
6. ✓ Verifies ios/App/App/public/index.html also has relative paths
7. ✓ Builds Release for arm64 physical device
8. ✓ Installs to device (UDID: `00008150-0001146A01DA401C`)
9. ✓ Launches app

**Single command for guaranteed safe deployment:**
```sh
npm run deploy:iphone
```

---

## Web Development

```sh
npm run dev
npm test
npm run build
```

The normal build keeps the GitHub Pages base path `/kazzohar-harakia/`.

## Native Development & Testing

### Deploy to Physical iPhone (Recommended)

```sh
npm run deploy:iphone
```

Expected result: App launches with TODAY PAGE visible (not black screen).

### Manual Native Build Steps (Development Only)

```sh
npm run build:native      # Creates dist/ with relative paths
npm run cap:sync          # Copies to ios/App/App/public/
npm run cap:ios           # Opens Xcode for simulator testing
npm run cap:android       # Opens Android Studio for Android testing
```

**Requirements:**
- `build:native` uses a relative asset base (`./` instead of `/kazzohar-harakia/`)
- Disables public PWA service-worker registration
- `cap:sync` copies this build to both native projects

### Device Information

The current native identity is:

- App name: `K-Zohaar`
- Display label: `כזוהר הרקיע`
- Bundle/Application ID: `com.kzohaar.app`
- Physical device UDID: `00008150-0001146A01DA401C`

### Platform Tools

`npm run cap:ios` opens Xcode after syncing. `npm run cap:android` opens Android Studio after syncing. This repository does not include signing keys, provisioning profiles, keystores, `local.properties`, or user-specific Xcode state.

---

## Regression Protection

To prevent black screen regression, **the deployment script validates:**

✅ Old dist is removed (no cache reuse)
✅ `npm run build:native` used (mandatory for native)
✅ Relative `./assets/...` paths in dist/index.html (not absolute)
✅ No PWA service worker in native build
✅ Capacitor sync successful
✅ Relative paths copied to ios/App/App/public/index.html
✅ Clean Xcode build
✅ Release build for arm64
✅ Installation to physical device
✅ App launch successful

**If ANY validation fails, deployment stops before install.**

---

## Runtime Decisions

- The native bundle does not register the GitHub Pages service worker. Native WebView storage remains localStorage-compatible, so existing theme, location, learning, reader-position, and daily-progress keys are not migrated.
- Remote text, calendar, location, and image content still require HTTPS network access. The native shell retains the app's clear offline state for remote-only views.
- Location permission is requested only after the user taps `המיקום שלי`; manual place search does not require permission.
- Native Android Back first closes known overlays, then follows WebView history, and exits only at the logical root.
- Final device QA is still required for VoiceOver, TalkBack, Dynamic Type, rotation, offline recovery, and permission denial.

---

## Troubleshooting

**Black screen after deployment:**
1. Run `npm run deploy:iphone` again (auto-recovers from most issues)
2. If persists, capture console: `log stream --device --predicate 'process == "App"'`
3. Look for JavaScript errors (Cannot find module, Failed to load resource, etc.)

**Do not use plain `npm run build` + manual Xcode steps.** This is the direct cause of the black screen regression.