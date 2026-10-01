# התבודדות — quiet time in "לעצמי"

Route: `#leatzmi/hitbodedut` (setup) · `/focus` (Focus explainer) · `/shomer` (שומר הסף) · `/packs` (offline packs; only when a pack exists).
Page: `src/pages/HitbodedutPage.jsx` · styles: `src/styles/hitbodedut.css`.

## What the person chooses
- **Duration**: 15 / 30 / 60 minutes, or a custom value (1–180, stepper by 5).
- **Background sound**: silence, white, pink, brown noise, a gentle tone (low G3 / middle C4 / high E4), volume, a short preview.
  Generated on the device (`src/services/ambientAudio/noise.mjs`): no download, offline. Presented as background sound for focus only — no claims of any effect.
- **AdaptiveAmbientAudio** (`presets.mjs`): until the person picks a sound, the time of day suggests one (morning pink/soft, day brown, evening brown/lower, night low tone), labelled "מוצע לשעה זו". A manual choice is never overridden.
- **On screen**: a quiet clock, or **תהילים ברצף** — chapters from the offline text (`src/data/tehillim.json`) flowing upwards by the shared auto-scroll engine (`src/hooks/useAutoScroll.js`), from a chosen chapter, continuing past 150 to 1. A touch pauses the flow; reduced motion: it does not start by itself.
- **Screen**: stay on (always for Tehillim), dim, a soft chime at the end.

## The session
Full-screen, near-black overlay (portal to `body`); `html[data-kz-immersive]` hides the header, tab bar and footer; the status bar is hidden.
Controls (dim · pause/resume · end) rest at low opacity and light up on touch. An extra software dimming layer has three levels.
Back (iOS edge swipe / browser), Escape and the Android back button ask "לסיים את ההתבודדות?" (a same-URL guard history entry; NewApp treats `.hb-session` as an overlay).

Orchestration: `src/services/hitbodedut/session.mjs` (pure, wall-clock timer in `timer.mjs`) keeps timer, screen, sound and Live Activity in step; the running session is persisted (`kz-hitbodedut-session-v1`) so a WebView reload continues it, and a session whose time passed is closed quietly with everything restored.

## Ring / journal
התבודדות is not study and writes nothing to the journal. With Tehillim, the closing screen offers the app's explicit "סיימתי" (`CompletionButton` → `recordTehillimCompletion(chapters read)`); never automatic.

## Native (`KZHitbodedut` plugin)
| | iOS (`ios/App/App/KZHitbodedutPlugin.swift`) | Android (`…/hitbodedut/KZHitbodedutPlugin.java`) |
|---|---|---|
| Brightness | `UIScreen.brightness`; original saved in UserDefaults; restored on end, on resign-active (re-dimmed on return), on terminate, on next launch | window `screenBrightness` override (system setting untouched); original in SharedPreferences; restored on end, onPause, onDestroy, next launch |
| Keep awake | `isIdleTimerDisabled` | `FLAG_KEEP_SCREEN_ON` |
| Sound | `AVAudioEngine` + `AVAudioSourceNode`, session `.playback`, `UIBackgroundModes: audio`; fades; stops itself at the end time; Now Playing + play/pause remote commands; interruptions handled | `AudioTrack` stream thread, audio focus; fades; stops itself at the end time |
| Live Activity | ActivityKit (iOS 16.2+): Lock Screen "התבודדות · 18:42 נותרו" via `Text(timerInterval:)`; Dynamic Island compact/minimal/expanded; pause/resume/end buttons as `LiveActivityIntent` (iOS 17+) | none (no-op) |

Live Activity code: `ios/App/Shared/KZHitbodedutActivity.swift` (attributes, intents, pending-action store — app + widget targets) and `ios/App/KZWidgets/KZHitbodedutLiveActivity.swift` (UI). `NSSupportsLiveActivities` is in the app Info.plist. No entitlement is needed, so the free personal team still signs it.
Lock Screen actions are applied natively at once (sound, activity, brightness on end) and queued with an id and instant; the page applies each once.

Siri / Shortcuts: "התחל התבודדות" (`KZStartHitbodedutIntent`, opens `kzohaar://open/hitbodedut`) — usable in a Focus automation.

## Known limits
- iOS Web Audio stops when locked — hence the native synth; the in-app web fallback is paused on hide and resumed on show.
- Android: no foreground service (no persistent notification, no extra permission). Sound continues in the background only while Android keeps the process alive; battery savers may stop it.
- The chime is played only when the screen is open at the end (with a locked phone, the sound simply fades out).
- iOS 16.1 is not supported for the Live Activity (16.2 APIs: `ActivityContent`, `staleDate`); buttons need iOS 17.
- The app cannot silence notifications; the Focus explainer says so (`focusGuide.mjs`).
