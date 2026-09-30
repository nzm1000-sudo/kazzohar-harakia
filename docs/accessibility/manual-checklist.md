# Manual accessibility checklist (iOS and Android)

This list separates what was checked from what still needs doing, and says how each item was checked. Nothing here was
tested on a physical device. "Simulator" means the iOS Simulator (iPhone 18 Pro Max, iOS 26) running the native build
of this branch. "Automated" means the Node test suite, which checks server-rendered markup and source code.

Legend: **Done (automated)**, **Done (simulator, visual)**, **Pending (device)**, **Pending (simulator)**.

## iOS

| # | Check | Status |
|---|---|---|
| 1 | Default settings: key screens look the same as before this change (Today, Siddur home, Tanakh chapter, commentator chapter, Halacha, Settings) | Done (simulator, visual): before/after screenshots |
| 2 | Text size 150% and 200% in the reader: the text grows and re-flows, there is no sideways scroll, and nikud and te'amim stay attached to their letters | Done (simulator, visual): Genesis 1 at 150%, and at 200% with bold and wide spacing |
| 3 | Header and tab bar at 200%: labels stay whole (they stop growing at 130%) | Done (simulator, visual) |
| 4 | Dynamic Type at Accessibility sizes with text size set to "system": the text follows the device, up to 200% | Done (simulator, visual) at AX-XL, before the 200% cap. **Pending:** re-check after the cap |
| 5 | Bold text: nikud placement with the real 700 face | Done (simulator, visual): Genesis 1. **Pending:** Siddur, Tehillim, Talmud |
| 6 | High contrast in all 8 themes: no text below 4.5:1, and the chosen state is shown by more than colour | Pending (simulator) |
| 7 | Reduce Motion (device setting): no decorative animation; pressed states still show | Automated (CSS scoped). Pending (simulator) |
| 8 | Reduce Transparency (device setting): frosted bars are solid | Pending (simulator; `prefers-reduced-transparency` support in WKWebView is not confirmed) |
| 9 | VoiceOver: every control on Today, Siddur, Tanakh, commentators, Talmud, Halacha and Settings has a name, a role and a state | Automated for the shared parts and the settings (markup checker). **Pending (device)** |
| 10 | VoiceOver: focus lands on the page title after navigation, and returns to the opener after a sheet closes | Pending (device) |
| 11 | VoiceOver: the Divine Name forms (יְיָ, יְהֹוָה) and heavily pointed text | Pending (device). See `README.md` §Hebrew speech. Needs the owner's decision on the spoken form |
| 12 | Voice Control: "Tap <label>" works for the commentator tiles, the search fields and the settings switches (each visible label starts its accessible name) | Pending (device) |
| 13 | Switch Control: menus (עוד, ערכת צבע) and sheets can be opened and closed | Pending (device) |
| 14 | Hardware keyboard (iPad): Tab order, Escape closes menus and sheets, arrow keys move within menus | Automated (source). Pending (simulator/device) |
| 15 | Landscape, iPad split view, at 200% | Pending (simulator) |
| 16 | Search typing: letters appear at once in Halacha, the header search, Library, Siddur, Tradition and Blessings | Automated (source and timing). **Pending (device):** feel on an older iPhone |

## Android (Capacitor WebView)

| # | Check | Status |
|---|---|---|
| A1 | Text size setting: `text-size-adjust` percentages in the Android WebView | Pending (device or emulator; not confirmed) |
| A2 | System font scale: the WebView's textZoom does not follow the system by default. The "system" option may not follow Android's font size | Pending. A native `setTextZoom` bridge may be needed |
| A3 | TalkBack: the same screens as items 9–13 | Pending (device) |
| A4 | Touch targets ≥ 48dp | Automated (CSS gives at least 44 CSS px). Pending (device) |
| A5 | No AccessibilityService and no BIND_ACCESSIBILITY_SERVICE in the manifest | Done (automated: grep of `android/`) |
