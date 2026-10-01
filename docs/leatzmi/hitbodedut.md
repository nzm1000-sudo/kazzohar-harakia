# התבודדות — quiet time in "לעצמי"

Route: `#leatzmi/hitbodedut` (setup) · `/focus` (Focus explainer) · `/shomer` (שומר הסף) · `/packs` (offline packs; only when a pack exists).
Page: `src/pages/HitbodedutPage.jsx` · styles: `src/styles/hitbodedut.css`.

## What the person chooses
- **Duration**: 15 / 30 / 60 minutes, or a custom value (1–180, stepper by 5).
- **Background sound** — ten small tiles in a 5 × 2 grid (fine-line sign + short name; the chosen one outlined with a soft glow, no fill; a tap selects and plays an 8 s preview, a tap on the playing tile stops it): silence, white / pink / brown noise, a gentle tone (low G3 / middle C4 / high E4), **צליל עמוק — לאוזניות**, and four nature recordings — **אקווריום, פלג נחל, זרימה שקטה, יום גשום וציפורים**. Volume slider. Presented as background sound for focus only — no claims of any effect.
  - Generated (`src/services/ambientAudio/noise.mjs`, mirrored natively): the noises, the tone and צליל עמוק — a 500 Hz sine in the left channel and 501.5 Hz in the right (2 s loop = 1000 / 1003 whole cycles, exact seam), ~−20 LUFS, needs stereo, hence "לאוזניות". The owner's reference file for it is **not** bundled.
  - One loudness: measured at full volume the noises were white −12.8, pink −16.5, brown −17.5, tone −18.7 LUFS; `LEVEL_TRIM` (white 0.55, pink 0.84, brown 0.94) brings them to −18 LUFS, where the recordings were normalised.
- **AdaptiveAmbientAudio** (`presets.mjs`): until the person picks a sound, the time of day suggests one (morning pink/soft, day brown, evening brown/lower, night low tone), labelled "מוצע לשעה זו". A manual choice is never overridden.
- **On screen**: a quiet clock, or **תהילים ברצף** — a *wheel* of verses (offline text `src/data/tehillim.json`): the current verse large and bright in the centre, neighbours shrinking, tilting and fading above and below (a drum), advancing verse by verse at a reading pace by word count (`itemDurationMs`, five speeds, persisted); a quiet chapter title passes through the centre between chapters. Behind the centre line the light of a small candle — a warm-gold radial glow, flickering very slightly (two layers, 7.3 s / 3.7 s irregular keyframes); reduced motion: static glow and no turning — the centre verse alone, changing with a plain fade.
  - Order: **לפי הסדר** (from a chosen chapter, past 150 to 1) or **סדר אקראי** — a shuffle bag kept on the device (`kz-hitbodedut-tehillim-bag-v1`): every chapter once before any repeats, across sessions; a refill never starts with the chapter just read.
  - A tap on the wheel holds it / lets it go (decided after the double-tap window, so a double tap never holds); a swipe moves one verse and holds; the session's pause holds it too. A chapter counts as read when its last verse leaves the centre going forward (for the explicit "סיימתי" at the end).
- **Screen**: stay on (always for Tehillim), dim, a soft chime at the end.

## The session
Full-screen, near-black overlay (portal to `body`); `html[data-kz-immersive]` hides the header, tab bar and footer; the status bar is hidden.
**Controls behind one golden ring**: once the session starts no control is shown — only a hollow gold ring centred at the bottom, the size of the − / + buttons, glowing softly and breathing (reduced motion: a still glow). It is a button "הצגת פקדים" (`aria-expanded`, `aria-controls="hb-dock"`); a tap reveals the dock (Tehillim pace, dimming, dim · pause/resume · end) just above it, over a dark veil; the dock hides after 6 s without a touch (every press inside starts the count again) or with another tap on the ring, and never while the end confirmation is open (`src/services/hitbodedut/controlsReveal.mjs`). Hidden, the dock is `inert` and `aria-hidden`. A **double tap** anywhere also reveals it; a single tap on the background does nothing, so a resting hand never disturbs the session (`src/services/hitbodedut/taps.mjs`: 320 ms / 28 px window; a touch that moved > 12 px or lasted > 350 ms is not a tap).
**Sound at start**: "התחלה" primes the audio inside the tap (Web Audio: `navigator.audioSession.type = 'playback'` so the silent switch does not mute it on iOS, the context resumed and a silent sample played) and the controller asks for the sound before the brightness calls. If the tile's 8 s listen is still playing, the same sound goes on and takes the session's end time (`retime` / native `audioRetime`) — it used to keep the listen's 8 s end and fall silent a few seconds into the session. A play during a fade-out starts the sound afresh. Native: `AVAudioSession` category `.playback` (plays with the silent switch on and, with `UIBackgroundModes: audio`, with the screen locked); the recordings ship in the bundle's `public/audio/ambient/` (copied by `cap sync`).
**End**: the closing screen appears at once — no fade-in on its words (the fade over a still-dim screen read as a screen popping up ~1.5 s later) — and stays until **חזרה**; nothing closes or navigates by itself. It is never a dark trap — in the open app the native brightness climbs back to the person's own over 3 s in parallel (`restore({ rampMs: 3000 })`, ease-out; the saved original is cleared only when the climb is done, so a kill midway still restores on next launch; leaving the app mid-climb restores at once), and a warm-gold glow rises behind the words with a softly gold-lit **חזרה**. A session ended while the app is hidden restores at once. An extra software dimming layer has three levels.
Escape, the Android back button and the dock's "סיום" ask "לסיים את ההתבודדות?" (NewApp treats `.hb-session` as an overlay). **Leaving never shows the closing screen**: "לסיים", Back (iOS edge swipe / browser — a same-URL guard history entry, so Back lands on the choice screen, which is what the swipe shows while it moves) and any navigation away end the session quietly (`leaveSession`: brightness back at once, no chime) and return to the choice screen with nothing popping up afterwards; the closing screen is dropped in the same turn as the end, so it is never painted. Back used to re-push the guard and ask — on iOS the question (and then the closing screen) appeared about a second after the swipe had already shown the screen beneath. The closing screen is only for a session whose time ran out while the person was on it.

Orchestration: `src/services/hitbodedut/session.mjs` (pure, wall-clock timer in `timer.mjs`) keeps timer, screen, sound and Live Activity in step; the running session is persisted (`kz-hitbodedut-session-v1`) so a WebView reload continues it, and a session whose time passed is closed quietly with everything restored.

## Ring / journal
התבודדות is not study and writes nothing to the journal. With Tehillim, the closing screen (a session whose time ran out) offers the app's explicit "סיימתי" (`CompletionButton` → `recordTehillimCompletion(chapters read)`); never automatic.

## Native (`KZHitbodedut` plugin)
| | iOS (`ios/App/App/KZHitbodedutPlugin.swift`) | Android (`…/hitbodedut/KZHitbodedutPlugin.java`) |
|---|---|---|
| Brightness | `UIScreen.brightness`; original saved in UserDefaults; restored on end, on resign-active (re-dimmed on return), on terminate, on next launch | window `screenBrightness` override (system setting untouched); original in SharedPreferences; restored on end, onPause, onDestroy, next launch |
| Keep awake | `isIdleTimerDisabled` | `FLAG_KEEP_SCREEN_ON` |
| Sound | `AVAudioEngine` + one stereo `AVAudioSourceNode` at 44.1 kHz (generated sounds + decoded recordings), session `.playback`, `UIBackgroundModes: audio`; fades; stops itself at the end time; Now Playing + play/pause remote commands; interruptions handled | stereo `AudioTrack` stream thread (recordings via `MediaCodec`), audio focus; fades; stops itself at the end time |
| Live Activity | ActivityKit (iOS 16.2+): Lock Screen "התבודדות · 18:42 נותרו" via `Text(timerInterval:)`; Dynamic Island compact/minimal/expanded; pause/resume/end buttons as `LiveActivityIntent` (iOS 17+) | none (no-op) |

Live Activity code: `ios/App/Shared/KZHitbodedutActivity.swift` (attributes, intents, pending-action store — app + widget targets) and `ios/App/KZWidgets/KZHitbodedutLiveActivity.swift` (UI). `NSSupportsLiveActivities` is in the app Info.plist. No entitlement is needed, so the free personal team still signs it.
Lock Screen actions are applied natively at once (sound, activity, brightness on end) and queued with an id and instant; the page applies each once.

Siri / Shortcuts: "התחל התבודדות" (`KZStartHitbodedutIntent`, opens `kzohaar://open/hitbodedut`) — usable in a Focus automation.

## Nature recordings (bundled)
Four loops in `public/audio/ambient/<id>.m4a` (bundled with the web assets: offline in the browser and in the app), from free-to-use Pixabay downloads by the owner (Pixabay Content License). Provenance: `sources/audio/provenance.json` (original file name, creator handle, Pixabay id, licence, retrieval date 2026-10-01, every processing number, sha256).

| id | title | source (creator) | segment | loudness | size |
|---|---|---|---|---|---|
| aquarium | אקווריום | joelfazhari · 193236 | 2:13.42–5:19.42 | −18.0 LUFS, TP −2.1 | 1,418,128 B |
| brook | פלג נחל | restfuldreamingtunes · 276298 | 2:55.53–6:01.53 | −21.6 LUFS, TP −1.1 (see below) | 1,421,209 B |
| flow | זרימה שקטה | universfield · 387676 | 4:45.01–7:51.01 | −18.0 LUFS, TP −2.7 | 1,366,595 B |
| rain | יום גשום וציפורים | whitenoisesleepers · 194011 | 3:12.46–6:18.46 | −18.5 LUFS, TP −1.2 | 1,375,938 B |

Processing (`node scripts/audio/build-ambient-loops.mjs [~/Downloads]`, ffmpeg + macOS afconvert):
1. Decode to mono 44.1 kHz ((L+R)/2 — the channels are loosely correlated room tone; mono halves the size, and every other sound is mono too).
2. Choose the stretch (180 s loop + 6 s cross-fade), clear of the file's first/last 15 s: 100 ms frames scored for level spread, one-off events (frames ≥ 6 dB over the stretch median, sharp peaks) and above all how alike the two seam zones are (level and brightness); then the boundary is moved within ±1 s to the calmest instant (smallest 10 / 50 / 200 ms level step), so no drop or chirp begins exactly at the seam.
3. Loudness to −18 LUFS (EBU R128) with a JS look-ahead peak limiter applied *before* folding (so its gain never jumps at the seam), ceiling −2 dBFS sample peak, true peak ≤ −1 dBTP. The brook's water drops stand 31 dB above its body; the limiter is capped at 14 dB of reduction, so the brook sits at −21.6 LUFS rather than squash its drops.
4. Equal-power fold: `loop[i] = s[i]·sin + s[N+i]·cos` over 6 s, so loop[N−1] → loop[0] is the recording's own continuity.
5. Margins: the file is `[last 0.5 s of loop][loop][first 0.5 s]`, AAC-LC mono 60 kb/s (afconvert ABR, quality 127), ~1.4 MB each, 5,581,870 B for all four.

**Gap-free playback**: AAC adds encoder priming/padding that decoders may or may not trim, so no player loops the file as-is. Because the file content is periodic, *any* window of exactly one loop inside it is a perfect loop; every player decodes the whole file to PCM and loops the middle window (`loopWindow` in `recordings.mjs`): Web Audio — `decodeAudioData` → window → `AudioBufferSourceNode.loop = true` (sample-accurate); iOS — `AVAudioFile` → 16-bit PCM window → looped sample by sample in the same stereo `AVAudioSourceNode` as the generated sounds (not `AVAudioPlayer.numberOfLoops`, which is not gapless with AAC); Android — `MediaExtractor` + `MediaCodec` → 16-bit PCM window → looped in the `AudioTrack` stream. Background playback with the screen locked is unchanged (same native engine). Memory: one decoded loop ≈ 16 MB natively (Int16), ≈ 32 MB in Web Audio (Float32; the last two kept).

**Seam check** (`node scripts/audio/check-ambient-loops.mjs` → `sources/audio/loop-check.json`): each file decoded by ffmpeg, ffmpeg ignoring the edit list, Apple's decoder (afconvert) and ffmpeg → 48 kHz; the window played twice; boundary sample jump vs the loop's own 99.9th-percentile step, and the 10 ms / 50 ms level step vs its own 99th percentile and < 2 dB at 50 ms. All 16 pass (jumps at the 11th–96th percentile of ordinary steps; level steps 0.05–0.5 dB).

## Known limits
- iOS Web Audio stops when locked — hence the native synth; the in-app web fallback is paused on hide and resumed on show.
- Android: no foreground service (no persistent notification, no extra permission). Sound continues in the background only while Android keeps the process alive; battery savers may stop it.
- The chime is played only when the screen is open at the end (with a locked phone, the sound simply fades out).
- iOS 16.1 is not supported for the Live Activity (16.2 APIs: `ActivityContent`, `staleDate`); buttons need iOS 17.
- The app cannot silence notifications; the Focus explainer says so (`focusGuide.mjs`).
