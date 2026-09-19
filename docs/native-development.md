# Native Development

The native shells package the local Vite output from `dist/`. They do not load the GitHub Pages site at runtime.

## Web

```sh
npm run dev
npm test
npm run build
```

The normal build keeps the GitHub Pages base path `/kazzohar-harakia/`.

## Native

```sh
npm run build:native
npm run cap:sync
npm run cap:ios
npm run cap:android
```

`build:native` uses a relative asset base and disables the public PWA service-worker registration. `cap:sync` rebuilds that bundle and copies it into both native projects.

The current native identity is:

- App name: `K-Zohaar`
- Display label: `כזוהר הרקיע`
- Bundle/Application ID: `com.kzohaar.app`

## Platform tools

`npm run cap:ios` opens Xcode after syncing. `npm run cap:android` opens Android Studio after syncing. This repository does not include signing keys, provisioning profiles, keystores, `local.properties`, or user-specific Xcode state.

## Runtime decisions

- The native bundle does not register the GitHub Pages service worker. Native WebView storage remains localStorage-compatible, so existing theme, location, learning, reader-position, and daily-progress keys are not migrated.
- Remote text, calendar, location, and image content still require HTTPS network access. The native shell retains the app's clear offline state for remote-only views.
- Location permission is requested only after the user taps `המיקום שלי`; manual place search does not require permission.
- Native Android Back first closes known overlays, then follows WebView history, and exits only at the logical root.
- Final device QA is still required for VoiceOver, TalkBack, Dynamic Type, rotation, offline recovery, and permission denial.