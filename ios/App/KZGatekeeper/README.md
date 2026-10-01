# שומר הסף — Screen Time scaffold (not built)

These sources are **not members of any Xcode target** and everything in them is behind `#if KZ_FAMILY_CONTROLS`.
The app is signed with a free personal team, which cannot hold `com.apple.developer.family-controls`; adding the
entitlement (or embedding these extensions) would break `npm run deploy:iphone`.

The app target contains only `App/KZGatekeeperPlugin.swift`, which compiles without the flag as a stub answering
`{ compiled: false }`.

To enable (paid Apple Developer Program team, after Apple approves the Family Controls (Distribution) request):

1. App target → Signing & Capabilities → **Family Controls**; add `com.apple.developer.family-controls` to
   `App/App.entitlements`.
2. File → New → Target → **Shield Configuration Extension** (`KZShieldConfiguration.swift`) and
   **Shield Action Extension** (`KZShieldAction.swift`), and **Device Activity Monitor Extension**
   (`KZDeviceActivityMonitor.swift`). Each gets the Family Controls capability and the App Group
   `group.com.kzohaar.app`. Each needs its own entitlement approval for distribution.
3. Add `KZ_FAMILY_CONTROLS` to *Active Compilation Conditions* of the app and the three extensions (Debug + Release).
4. Register the plugin in `KZBridgeViewController.capacitorDidLoad` (already registered — the stub becomes live).
5. Flip `GATEKEEPER_FLAGS.enabled` in `src/services/hitbodedut/gatekeeper.mjs` and wire `shield({ until })` /
   `unshield()` to session start / end.

Full details: `docs/leatzmi/shomer-hasaf.md`.
