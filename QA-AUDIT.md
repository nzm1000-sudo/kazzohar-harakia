# QA Audit — כזוהר הרקיע

Date: 2026-09-22 · Baseline: `5966f03` (tag `qa-audit-backup-20260922-0131`) · Result: `56350a6`
Method: full inventory (routes/screens/services/storage/tests) → live walkthrough in Chromium (390 px mobile + 320/360/375/430/768/1024/1280/1440 sweeps, offline, API failure, hostile input) → static audit → root-cause fixes → regression tests → full suite → production web build + preview smoke → iOS build + install on device.

## Findings

| # | Severity | Area | Problem | Root Cause | Fix | Regression Test |
|---|---|---|---|---|---|---|
| 1 | **P0** | Talmud reader | Opening any daf crashed to "משהו השתבש" (`ReferenceError: isBookmarked`). | Bookmarks were removed earlier but `AmudReader` still called `isBookmarked`/`toggleBookmark`. | Removed leftover state/effect/button; dropped unused React imports. | Browser walkthrough (all routes); `tests/talmud.test.mjs` |
| 2 | **P1** | Shell / desktop | 861–1440 px: 13 nav buttons overflowed; global search + theme picker pushed off-screen (≈300 px horizontal scroll at 1024). | `.shell-nav` had no `min-width:0`/shrink; `.head-tools` not `flex:0 0 auto`. | Nav shrinks and scrolls internally; tighter padding 861–1320 px. | Measured `scrollWidth-clientWidth === 0` at 9 widths |
| 3 | **P1** | Shell / mobile | "זמנים" (times/settings incl. manual location + halachic profile) unreachable on phones — not in tab bar nor in "עוד". | `MORE` list omitted desktop-only NAV entries. | `MOBILE_MORE = [...NAV.slice(4), ...MORE]`. | `tests/uiFocusedFixes.test.mjs` (new test) |
| 4 | **P2** | Shell | Nested routes (`halacha/q/…`, `talmud/…`) highlighted no nav item. | Exact `page === id` comparison. | `navRootFor()` maps route → owner (+aliases `settings→times`, `preparation→shabbat-page`). | `tests/uiFocusedFixes.test.mjs` |
| 5 | **P1** | Navigation | After opening a source from a deep link, "חזרה" in the reader did nothing (reader stayed open). | `sync()` compared against a signature that `pushRoute` never updated → popstate to the initial entry was treated as "no change". | Shared `signatureRef` between `pushRoute` and `sync`. | Browser flow (deep-link → open → back ×3) |
| 6 | **P2** | Navigation | `<a href="#…">` links (Travel, Personal Tools, Siddur→forgotten) reset `kzDepth` → Android hardware back / back-gesture could exit the app. | Anchor navigation creates history entries without app state. | `hashchange` stamps entries with `depthRef+1`; `dailyTehillim` reset on sync. | Browser flow: depth 1→2→3→2→1→0 |
| 7 | **P1** | Halacha search | `בשר אחרי חלב` and `חלב אחרי בשר` returned the same record; `בורא נפשות` ranked below stems; `מקווה בחו''ל` (two apostrophes) missed. | No word-order signal; fuzzy prefix matched 3-char stems (`נפש`↔`נפשות`); quote normalization collapsed `''`→`""`. | Ordered-bigram bonus (with adjective stemKey), whole-word bonus, `stemMatch` min length, `[״"׳']+`. | `tests/halachaSearch.test.mjs` (+3 tests) |
| 8 | **P2** | Global search | Duplicate Sefaria hits (same segment per edition); index keys. | `search()` didn't dedupe by ref. | Dedupe + stable keys. | — (network) |
| 9 | **P1** | Parasha / Shabbat sheet | When a festival falls on Shabbat (e.g. Sukkot I 26.9.2026) the app showed *Bereshit* as "this Shabbat"; ShabbatPage reading fields always "לא זמין"; ParashaPage showed raw `2026-10-10 · 29 Tishrei 5787`. | `dayContext` only looked at `parashat` items; `ShabbatPage` read a non-existent `context.torahReading`; date formatting bypassed formatters. | `context.shabbatReading` (festival overrides parasha); ShabbatPage/ParashaPage consume it; Hebrew date + compound refs formatted; haftarah fallback. | `tests/hebrewUiParasha.test.mjs` (+1 test) |
| 10 | **P2** | Preparation | "צאת השבת/החג: לא זמין" for festivals. | Templates key on the *Erev* day; Hebcal puts havdalah on Yom Tov. | `havdalahAfter()` — first havdalah after candles within 3 days. | `tests/preparationPlan.test.mjs` (+1 test) |
| 11 | **P1** | Date converter | Hebrew→Gregorian off by one day for Israeli users (א׳ תשרי תשפ״ז → 11.9.2026 *Friday*). | `HDate.greg()` is local midnight; formatters use UTC. | Re-anchor to UTC noon via `parseGregorian`. | `tests/personalTools.test.mjs` (+1 test, run in Asia/Jerusalem and America/Los_Angeles) |
| 12 | **P1** | Bar-mitzvah parasha | Added 13 *Gregorian* years → wrong Shabbat/parasha in most cases. | Wrong calendar. | 13th *Hebrew* birthday (Adar II→Adar in non-leap). Verified: born 13.3.2013 → 20.3.2026 → ויקרא. | Browser verification |
| 13 | **P2** | Personal tools | Default "today" computed once at module load with UTC getters (previous day 00:00–03:00 IL); `decodeURIComponent` on malformed hash crashed page; region radios had no `name`; hidden date input unlabeled. | — | `localTodayParts()` per render; `safeDecode`; `name="parasha-region"`; `aria-label`. | — |
| 14 | **P1** | Prayer compass | Alignment class stuck / target stale after location change. | rAF loop captured `target`/`alignment` from first render. | `targetRef`/`alignmentRef`. | `tests/prayerCompass.test.mjs` (existing) |
| 15 | **P2** | Zmanim / Tehillim / Today | Manual-location form never resynced after picking a city; `initialChapter` ignored after first visit (search → wrong chapter); duplicate React keys in prayer panel. | Snapshot state; `useLocal` default only on empty; `key={item.kind}`. | Resync effect; explicit-chapter effect; composite key. | — |
| 16 | **P2** | Travel | "הנסיעה נשמרה" screen never appeared for a *new* trip; delete had no confirmation. | `newId` assigned inside a React updater (runs later). | Compute `upsertTrip(state, …)` synchronously; `confirm()` on delete. | Browser flow: create → open → reload → delete |
| 17 | **P1** | Network resilience | Hebcal fetch had no timeout; snapshot fallback only when `navigator.onLine===false` (flaky-but-online network showed errors despite cached data). | — | 12 s timeout guard (Hebrew message); snapshot on *any* failure; caller aborts preserved. | `tests/servicesResilience.test.mjs` (5 new tests) |
| 18 | **P1** | Sefaria | 15 s timeout raised `AbortError`, which `useResource` treats as "unmounted" → infinite "פותחים את המקור…" with no retry. | Timeout and unmount used the same signal type. | Timeout → `Error('ספריא לא הגיבה בזמן')`. | — (network) |
| 19 | **P1** | Security / sanitizer | Unterminated `<img onerror=…` survived sanitizing; `mark()` could later supply the `>` → live handler. Also prose `a < b` became `<b>`. | Tag regex `<[^>]+>` only stripped closed tags; no escaping of leftovers. | Tags must start `<letter`; every leftover `<` → `&lt;`; `mark()` refuses needles with `<>&`. | `tests/hebrewHtmlSanitizer.test.mjs` (4 new tests) |
| 20 | **P1** | Offline pinning | Pinning a daf with >29 commentaries failed ("אחסון מלא") and fired 100+ parallel requests (429s). | Each commentary consumed the 30-pin budget; `Promise.all` fan-out. | Commentaries ride inside the pinned daf package (offline fallback added to `loadCommentary`); concurrency pool of 4. | `tests/contentCache.test.mjs`, `tests/talmud.test.mjs` |
| 21 | **P2** | Service worker | Hard-coded `/kazzohar-harakia/` paths; `response.clone()` after hand-off (race); `cache.put` outside `waitUntil`; failed JS/JSON fell back to HTML. | — | `BASE` from `self.location`; clone first; `waitUntil`; navigate-only fallback; cache `v3`. | Preview smoke: 200 for shell URLs |
| 22 | **P2** | Siddur search | No-match left 21 open, empty group headers and no message. | Groups rendered regardless of matches. | Hide non-matching groups; `role=status` notice. | Browser verification |
| 23 | **P2** | Touch targets | Link-style buttons/chips 23–31 px tall on phones. | — | `@media (pointer:coarse)` min 44 px hit areas (visual unchanged). | Measured in browser |
| 24 | **P3** | Dead code | `HalachaPage`, `Library`, `SefariaPanel`, `PreparationHub`, `Capacitor`, `jewishDateKey`, `EVENTS` imported/defined but never used. | — | Removed from `NewApp.jsx` / `BooksPage.jsx` (files `Library.jsx`, `SefariaPanel.jsx`, `App.jsx` left in place, unreferenced). | Build |

## Not fixed (documented)

| Severity | Area | Problem | Why not fixed |
|---|---|---|---|
| P2 | Performance | ~63 MB of data modules (`booksOffline` 41 MB, `yalkutYosef` 14 MB, `tanakh.json` 6 MB) are statically imported into the main chunk (38 MB minified JS). | Architectural change (dynamic `import()` + loading states in `sefaria.mjs`/`BooksPage`/`personalTools`). Out of scope for a stabilization pass; recommended next step. |
| P2 | Books reader | Opening a full book renders every paragraph at once (e.g. בן פורת יוסף → 3 215 `<p>`). | Needs virtualization/pagination in `SourceReader`; deferred. |
| P2 | Product | `PreparationHub` (task reminders, notifications) is imported nowhere; all `preparation/*` routes render `ShabbatPage`. Tests still cover the component. | Looks like an intentional product decision from an earlier session; left as-is and flagged. |
| P3 | Dev only | Vite dev server requests `/kazzohar-harakia/kazzohar-harakia/manifest.webmanifest` (404). Production HTML is correct. | Vite 4 rebases `%BASE_URL%` twice in dev; harmless. |
| P3 | Travel | "חבילת אופליין" stores metadata only; "שירותים ליד היעד" has no provider so search always reports unavailable. | Existing, clearly labeled behaviour; noted for product. |
| P3 | Debug | `BUILD.id` falls back to `6ba84d4` in dev. | Injected correctly by `build:native`. |

## Summary

1. **Problems found:** 30 (24 fixed rows above, several bundling multiple defects, + 6 documented).
2. **Fixed:** 24 (1 P0, 12 P1, 10 P2, 1 P3).
3. **Remaining:** 6 (0 P0/P1; 3 P2 architectural/product, 3 P3).
4. **Why remaining items were not fixed:** see table — bundle splitting and reader virtualization are architectural; `PreparationHub` reachability is a product decision; the rest are dev-only or clearly labeled limitations.
5. **Automated tests added:** 16 new tests in 3 new files + 5 existing files
   - `tests/servicesResilience.test.mjs` (new, 5): snapshot fallback while online, server error with/without snapshot, calendar snapshot, internal timeout message, caller abort propagation.
   - `tests/hebrewHtmlSanitizer.test.mjs` (new, 4): allow-list, dangerous tags, unterminated-tag XSS, prose brackets.
   - `tests/halachaSearch.test.mjs` (+3): word order meat/milk, whole-word vs stem + quote variants, hostile/empty/latin input.
   - `tests/hebrewUiParasha.test.mjs` (+1): festival on Shabbat overrides parasha.
   - `tests/preparationPlan.test.mjs` (+1): festival havdalah on the day after Erev.
   - `tests/personalTools.test.mjs` (+1): Hebrew→Gregorian UTC-noon anchoring (verified in two host time zones).
   - `tests/uiFocusedFixes.test.mjs` (+1): mobile reachability of every page + nested-route highlighting.
6. **Areas exercised live:** all 35 routes (incl. invalid ids/unknown hash); Today (daily item complete + persistence, memorial modal, theme picker + persistence, contrast 10.1:1); Calendar (month/week/year, date input incl. empty, day select); Tehillim (daily portion, next/prev, favorites, search, exotic Unicode); Siddur (search, open prayer, reader back); Halacha (search edge cases, question → source → back, book unit restore); Talmud (study/gemara/iyun/scan, highlight incl. hostile `<b`, commentary panel, next amud); Parasha + Shabbat sheet; Personal tools (date converter both directions, bar-mitzvah, baby names route); Travel (create → detail → reload → delete); Forgotten addition flow; Offline (banner, snapshot, Hebrew errors, auto-recovery); API 500 simulation; back/forward/refresh/deep-link; 9 viewport widths; keyboard focus ring; fonts loaded (Heebo 400/600, Noto Sans Hebrew 400/600, Noto Serif Hebrew 400/700, no fallback glyph boxes).
7. **Could not be verified in this environment:** service-worker *activation* (the embedded browser registers but does not activate SWs on `http://localhost`; precache URLs verified 200 individually); Capacitor hardware back button, geolocation permission prompt, device compass sensors, haptics, and `navigator.share` (require the physical device — the build was installed and launched on the iPhone `00008150-0001146A01DA401C`, but interactive device QA was not automated); real Nominatim/Sefaria rate-limiting under load.
8. **Final results:**
   - `npm test`: **302 tests, 302 pass, 0 fail**
   - `vite build` (web, base `/kazzohar-harakia/`): ✓ built; preview returns 200 for `/`, `index.html`, `manifest.webmanifest`, `sw.js`, icons, deep-link + refresh.
   - Production mode in browser: **0 console errors / 0 React warnings** across Today, Talmud, Halacha, reload.
   - `npm run cap:sync` + `xcodebuild … build`: **BUILD SUCCEEDED**; installed and launched on device (`com.kzohaar.app`, build id `56350a6`).
   - Git: `42b89f3`, `56350a6` on `main`; rollback point `qa-audit-backup-20260922-0131`.
