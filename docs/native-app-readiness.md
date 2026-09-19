# Native App Readiness

The React/Vite app remains the shared product core. The next phase should wrap this code with a native bridge such as Capacitor rather than create a second app.

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