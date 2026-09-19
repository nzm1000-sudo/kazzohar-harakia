# Native App Readiness

Status: **native packaging may start; store submission is not yet cleared.** The React/Vite app remains the shared product core. The next phase should wrap this code with a native bridge such as Capacitor rather than create a second app.

See the focused audit in [native packaging blockers](native-packaging-blockers.md), [privacy data map](privacy-data-map.md), [content licenses](content-licenses.md), and [store metadata checklist](store-metadata-checklist.md).

## iOS

- Create an Xcode project and choose the final bundle identifier.
- Configure signing, App Store Connect, icons, launch assets, and privacy declarations.
- Add native permission strings only for explicitly requested location and future notifications.
- Add native share, lifecycle/background restore, and optional local notification bridges.
- Complete VoiceOver, Dynamic Type, rotation, offline, and back-navigation QA.

## Android

- Create the Android project with the final application ID and target SDK 36 or newer.
- Configure signing, Play Console, adaptive/maskable icons, and permission declarations.
- Map system back, activity pause/resume, denied permissions, rotation, and network recovery.
- Add native share, haptics, and optional local notification bridges without first-launch permission prompts.

## Store and release checklist

- Reserve store accounts, bundle/application identifiers, signing keys, and release channels.
- Prepare privacy declarations that distinguish local device storage from external requests to Hebcal, Sefaria, and location services.
- Prepare screenshots at phone and tablet sizes, Hebrew store metadata, support URL, and review notes.
- Verify source attribution, licenses, the non-affiliation statement, offline behavior, accessibility, deep links, and purchase-free navigation.

## Official references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple privacy guidance](https://developer.apple.com/documentation/uikit/protecting_the_user_privacy)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Android 16 compatibility guidance](https://developer.android.com/about/versions/16/overview)