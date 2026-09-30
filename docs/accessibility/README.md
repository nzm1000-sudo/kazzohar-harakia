# Accessibility in כּזוהר הרקיע

Last review: 2026-09-30. This page covers the audit findings, how the accessibility features are built, the Hebrew
speech question, and what is still open. The per-workflow matrix is in `matrix.md`. The iOS and Android checklist,
showing what was checked and what is pending, is in `manual-checklist.md`.

**What was checked, and how:** automated tests on Node 20 (server-rendered markup and source), plus visual checks in
the iOS Simulator. No physical device was used, and no VoiceOver or TalkBack session was run. The app makes no claim of
conformance with any accessibility standard.

## 1. Design principle

Accessibility here should not be visible to anyone who does not need it. There is no floating accessibility button, no
toolbar and no overlay. Everything lives in one quiet settings section (הגדרות › נגישות). By default the app follows
the device (התאמה אוטומטית למכשיר). A reader who changes nothing gets the page exactly as designed: no attribute is
written on `<html>` and no rule in `styles/accessibility.css` matches. `tests/accessibilityPreferences.test.mjs` checks
this.

## 2. Architecture

| Part | File | Role |
|---|---|---|
| Preference store | `src/services/accessibility/preferences.mjs` | Defaults, validation (a damaged record falls back to defaults), persistence (`kz-accessibility-v1`), reading the device settings (`prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, `prefers-reduced-transparency`, colour scheme), the effective result, and `applyToDocument()`, which writes data attributes and CSS variables on `<html>`. Also `hapticsAllowed()`. |
| Runtime | `src/services/accessibility/runtime.mjs` | `installAccessibility()` runs from `main.jsx` before the first render. It adds the hidden Dynamic Type probe and re-applies the settings when a setting, a media query, or the app's visibility changes (iOS applies a new Dynamic Type size on return). It also provides `useAccessibilityPreferences()` (via `useSyncExternalStore`). |
| Styles | `src/styles/accessibility.css` | Every rule is scoped to `html[data-a11y-*]`. |
| Touch targets | `src/styles/touch-targets.css` | Invisible hit-area expansion to at least 44×44 CSS px. |
| Primitives | `src/components/a11yPrimitives.jsx` | `VisuallyHidden`, `announce()` (one polite live region), `useModalFocus()` (focus moves in, Tab is trapped, Escape closes, the background is inert, focus is restored), and `focusPageTitle()`. |
| Settings UI | `src/pages/AccessibilityPage.jsx` | The settings screen (`#accessibility`) and the statement (`#accessibility/statement`). The entry point is the last card of the settings screen (`#settings` / `#times`). |

### Text size

- **Phones and tablets:** `-webkit-text-size-adjust: N%` is set on `<html>`. WebKit scales the text and the lines
  re-flow, while images and layout boxes keep their size. The iOS Simulator confirmed this works in WKWebView.
- **Desktop browsers:** these ignore that property, so `zoom` is used on `#root` instead.
- **"מערכת" (the default):** iOS reports the reader's Dynamic Type through `-apple-system-body`, which is 17px at the
  default size. A hidden probe reads it, and the ratio to 17px becomes the scale: the default size gives 1, and the
  scale is capped at 2.
- **Double scaling:** while a scale is applied, `html` font-size is pinned to 17px so that sizes set in rem do not grow
  twice.
- **Header and tab bar:** these stop growing at 130%. Above that, their labels broke inside words (seen in the
  Simulator).

### Line spacing and bold

- **Line spacing:** multiplies the line height of each reading surface by its own base value: normal 1, comfortable
  1.12, wide 1.25. Letter spacing and word spacing are never changed (a test checks this), because spacing pulls nikud
  and te'amim away from their letters.
- **Bold:** uses real bold faces (Noto Serif Hebrew 700, Heebo and Noto Sans Hebrew 600), so the font positions the marks
  itself.

### High contrast, transparency, motion

- **High contrast:** keeps the reader's theme; no competing theme system. The muted ink becomes full ink, hairlines
  get stronger and links are underlined. Chosen and current states get an outline, so no state is shown by colour
  alone.
- **Reduce transparency:** turns off the backdrop blur and makes those bars solid.
- **Reduce motion:** the device's request is always honoured (base.css already had a
  `prefers-reduced-motion` rule, and this is unchanged). The switch in the app forces the same behaviour. Functional
  feedback, such as pressed states and focus rings, is a state rather than motion, so it stays.

### Haptics and focused reading

- **Haptics:** `hapticsAllowed()` gates the non-essential haptic (the switch tick in השעון היהודי). The prayer compass's
  alignment tick is functional feedback and stays on.
- **Focused reading (קריאה ממוקדת):** off by default. On the reading screens it hides the ornaments, the "tap a verse…"
  hints and the offline invitation, and keeps a comfortable line length. It never hides navigation, text, tabs or
  actions.

## 3. Search typing lag: root cause and fix

**Symptom:** the keyboard's haptic came at once, but the letter appeared about half a second later.

**Root causes, measured on Node 20 on a laptop (a phone is 2–4× slower):**

1. **The Halacha search (`searchHalacha`) took 264–441 ms per query.**
   - Every query re-normalized and re-tokenized all ~2,470 question records: 14 regex passes each, NFKD, bags and
     bigrams.
   - `searchYalkut` re-normalized every Yalkut Yosef section and de-duplicated its results in O(n²).
   - The field already debounced (320 ms) and used `startTransition`, but a transition cannot interrupt a single
     synchronous 300 ms computation. Any pause longer than 320 ms froze the next keystroke.
   - After each search, the page called `routeHalachaQuery(searchQ)` without the results, which ran the whole search a
     second time.
2. **The header search held its text in the app root.** Each keystroke re-rendered the entire app: the shell, the
   current page, and the search page with its local search.
3. **Other fields searched on every keystroke:** Library, category, contents, in-book search, the Siddur search (whose
   page also re-composes the weekday Mincha on each render), Blessings, Shalom Rav, baby names, verses, Tradition,
   Talmud commentary, and the Halacha question index.

**Fixes (no change to any result):**

1. **Halacha search:** each record's normalized words, bags and bigrams are prepared once and cached in a WeakMap, and
   the per-query parts are computed once per query. Category and topic names are normalized once. Yalkut sections are
   normalized once, and duplicates are removed in one pass. Routing reuses the results.
   - On all ~414 comparison queries (190 question texts, one in nine of the 2,282 verified questions, and edge cases),
     the output is identical to the baseline commit: 0 differences.
   - After the first query, a query now takes **15–30 ms** instead of **264–441 ms**, roughly 15× faster.
   - `warmHalachaSearch()` fills the caches in small idle slices, so the first query is fast too.
2. **`ClearableInput deferred`:** the field keeps its own text, so a keystroke renders only the field. The page gets
   the value through `startTransition`, and clearing is immediate. This is used by the header search (the app no longer
   re-renders on each key) and by every heavy field. Raw inputs (Tradition, Talmud commentary, verses) use
   `useDeferredValue`.
3. **Halacha question index:** each question's text is normalized once.

`tests/searchTypingLatency.test.mjs` pins the deferral wiring and a time budget.

## 4. Audit findings: problems found

See the final report for the full list per file. The main items:

- The header search re-rendered the whole app on every key, and the Halacha search blocked the main thread for 0.3–1 s
  (§3).
- Some search fields had only a placeholder and no accessible label: the Halacha question index filter and the Talmud
  commentary search. The clear buttons had inconsistent names ("ניקוי", "נקה את החיפוש"). They are now named
  consistently ("נקה חיפוש", "נקה סינון").
- The bookmark buttons on verse numbers were named "סימנייה" or "הסרת סימנייה" and also carried `aria-pressed`, so the
  state was given twice. Each is now "פסוק א׳, הוסף לסימניות" with `aria-pressed`, and a short announcement when it
  changes.
- The colour-theme button's name did not contain its visible text or its value. It is now "ערכת צבע: בהיר".
- The phone's "עוד" menu and the colour-theme list had no focus management: focus did not move in, Escape did not
  close them on touch keyboards, and there were no arrow keys. They now have all three.
- There was no focus move after navigation. The new page's title now takes focus after a push navigation, Back, or
  opening a source. Moving within the same page (a verse tap, `replace` routes) does not move focus.
- Reading-screen, dialog, ring, touch-target and gesture findings are listed in `matrix.md` and the final report.

## 5. Hebrew speech: nikud, te'amim and the Divine Name

What was examined:

- **Nikud and te'amim:** VoiceOver and TalkBack Hebrew voices generally skip combining marks. Heavily pointed text is
  read by its letters. The coloured te'amim view draws the verse twice, and one copy is `aria-hidden`, so it is not
  read twice.
- **The Divine Name:** the liturgy data holds about 3,000 יְיָ, 6,400 יְהֹוָה, 740 יי and 200 ה׳. A synthetic voice is
  likely to read these as letters or as a transliteration ("yeya", "yehova"). That can be both confusing and
  religiously inappropriate.
- **Not implemented, and why:** the fix would be spoken text for accessibility only: the visible form `aria-hidden`
  and a visually hidden spoken form. That touches the rendering of every prayer. It also needs a halachic decision the
  owner must make: whether the spoken form is "אֲדֹנָי" (as in prayer) or "השם" (as when reading outside prayer). A
  machine voice is not praying, and many readers expect "השם". The visible text would not change.
- **Proposed approach, once decided:** one render-time helper in the prayer text renderer that wraps these forms. Copy,
  search and word lookup would still see only the visible text, so those paths must be checked. Then test it with
  VoiceOver on a device.
- **Status:** a remaining manual check (checklist item 11).

## 6. Remaining limitations

- There has been no device testing with VoiceOver, TalkBack, Voice Control or Switch Control.
- On Android, whether `text-size-adjust` works in the WebView, and whether the WebView follows the system font scale, is
  unverified.
- `prefers-reduced-transparency` may not be reported by every WKWebView version. The in-app switch covers this.
- Reporting an accessibility problem (דיווח על בעיית נגישות) uses the system share sheet, with the clipboard as a
  fallback. The app has no contact address built in, so the owner should add one (for example on the statement page).
- Some small print uses sizes below 15px (for example the chapter marks at `max(14px,.58em)`). These were left as
  designed and need the owner's review.
- The Tanakh and Mishnah verse-tap shortcut (tap a verse to see its commentators) is a mouse and touch action on the
  text. The keyboard and screen-reader alternative is the מפרשים tab, which lists the same commentators.
