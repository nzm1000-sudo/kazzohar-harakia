# שומר הסף — app shielding during התבודדות (scaffold, OFF)

Goal: while a session runs, apps the person chose show a calm shield — title "זה הזמן שבחרת לעצמך", a soft subtitle, and the button "חזור לכזוהר הרקיע" — and the shield lifts by itself at the end.

## Why it is off
Screen Time's APIs (FamilyControls, ManagedSettings, DeviceActivity, ManagedSettingsUI) require the **`com.apple.developer.family-controls`** entitlement. The app is signed with a **free personal team**, which cannot hold it; adding it would make automatic signing (and `npm run deploy:iphone`) fail.

## What is in the repo
- `src/services/hitbodedut/gatekeeper.mjs` — `GATEKEEPER_FLAGS.enabled = false` (frozen), `gatekeeperStatus()`, the Hebrew texts. Tested in `tests/hitbodedutNative.test.mjs`.
- The UI (`#leatzmi/hitbodedut/shomer`) explains honestly: "דורש אישור מאפל — יופעל בגרסה עתידית", with a preview of the shield.
- `ios/App/App/KZGatekeeperPlugin.swift` (in the app target) — compiles without the entitlement: without `KZ_FAMILY_CONTROLS` it answers `{ compiled: false }`; with it: authorization (`.individual`), `FamilyActivityPicker`, `ManagedSettingsStore` shield, `DeviceActivityCenter` schedule.
- `ios/App/KZGatekeeper/` (not in any target): `KZShieldConfiguration.swift`, `KZShieldAction.swift`, `KZDeviceActivityMonitor.swift`, `README.md`.

## What is needed to turn it on
1. **Paid Apple Developer Program** membership (individual or organization).
2. **Request the Family Controls (Distribution) entitlement** from Apple (developer.apple.com → Family Controls request form), for the app **and for each extension bundle ID**. Development use works on a paid team once the capability is added; App Store distribution needs the approval.
3. Xcode: add the **Family Controls** capability to the app; add three targets — **Shield Configuration Extension**, **Shield Action Extension**, **Device Activity Monitor Extension** — with the files above, the Family Controls capability and the App Group `group.com.kzohaar.app`; embed them in the app.
4. Define `KZ_FAMILY_CONTROLS` in *Active Compilation Conditions* for the app and the extensions.
5. Flip `GATEKEEPER_FLAGS.enabled`, add a setup step (authorize, pick apps) and call `KZGatekeeper.shield({ until: endsAt })` on session start and `unshield()` on end.
6. Privacy: the selection is opaque tokens kept on the device; update the privacy disclosures accordingly.
