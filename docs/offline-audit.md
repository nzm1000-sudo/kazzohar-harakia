# Offline audit — what works without a network (2026-10-01)

Scope: the whole app, with the new personal space **לעצמי**. "Installed app" = the iOS / Android build (`npm run build:native`,
every asset inside the app bundle). "Web" = the GitHub Pages build with its service worker (`public/sw.js`, network-first,
keeps a copy of everything it has fetched once). Checked by reading the code and by the automated tests; **not** verified
on a physical device with the network switched off — that still needs the open → offline → reopen flow on the iPhone.

| Area | Installed app | Web | Notes |
|---|---|---|---|
| Siddur (Edot HaMizrach and the other bundled rites) | ✅ | ✅ after first load | 121 of 129 Edot leaf sections are bundled; the 8 without licence metadata stay network-only (docs/offline-resilience.md). |
| Tehillim (150 chapters) | ✅ | ✅ after first open | `src/data/tehillim.json`, a lazy chunk. |
| Tanakh / library reader | ✅ | ✅ after first open of each pack | Packs under `public/library/packs`, shipped in the native bundle. The downloadable `torah-packs` are web-hosted only (never in the app bundle). |
| Shnayim Mikra | ✅ | ✅ after first load | Mikra + Onkelos bundled. |
| Halacha (local engine, practical Q&A, Yalkut Yosef) | ✅ | ✅ after first load | Data modules are local. Remote Sefaria commentary/search requires the network (cached reads are labelled). |
| Local search (global / in-book) | ✅ | ✅ | Built-in index; search packs for some shelves are fetched on request (see `src/services/torah/offlineAudit.mjs`). |
| Zmanim / calendar | ✅ (local calc + snapshots) | ✅ | New city search (geocoding) needs the network. |
| Favourites, ring (המעגל הרוחני), journal, learning history, reminders | ✅ | ✅ | localStorage only. |
| **חידושי התורה שלי** (write, edit, search, sort, filter, share, history) | ✅ | ✅ | `kz-leatzmi-chidushim-v1`. Sharing uses the system share sheet; the target app may need a network. |
| **שליחה למאגר** | ⚠️ partial | ⚠️ partial | The submission is recorded in the local outbox first (`kz-leatzmi-outbox-v1`) and handed to the mail app; the mail app sends when a network exists. If no mail app could be opened, the entry stays "queued" and can be retried. |
| **חזרה אליי** | ✅ | ✅ after the first visit to לעצמי | Schedule in `kz-leatzmi-review-v1`; titles of halachot and quiz answers come from local data chunks. |
| **ביום הזה** | ✅ | ✅ | Pure calculation over local chidushim + journal (Hebrew dates and parasha by @hebcal/core, on device). |
| **בשבילי היום** | ✅ | ✅ after the first visit to לעצמי | Reads Tehillim, the practical-halacha data and the quiz files (lazy chunks). |
| **פרק בהפתעה** | ✅ | ✅ | Catalog + shuffle bag on device; the chapter opens in the library reader (above). |
| **בחן אותי** (quiz) | ✅ | ✅ after first open | Question files are lazy chunks (`src/data/quiz`). |
| **Auto-Scroll** (all readers) | ✅ | ✅ | Pure client code; speed in `kz-autoscroll-v1`. |
| Page scans (Vilna), new Sefaria texts and remote commentary | ❌ | ❌ | Network only; shown with an explicit offline message, never a broken view. |

## Gaps fixed now
- **Web, לעצמי:** its own data chunks (Tehillim, practical halacha, quiz files, the quiz and התבודדות screens) were cached only
  once each screen had been opened online. Opening לעצמי while online now fetches them once in idle time
  (`warmOfflineChunks` in `src/pages/LeatzmiPage.jsx`), so בשבילי היום, חזרה אליי and בחן אותי work offline afterwards.
  The installed app needs no warm-up and fetches nothing.
- **לעצמי never depends on the network:** every store is local; the only outward action (שליחה למאגר) is explicit and
  goes through the user's own mail app.

## Remaining (documented, not changed here)
- Web only: any lazy chunk of the rest of the app (e.g. a rite's siddur pack, Tradition archive) is available offline only
  after it was opened once online. A precache list in `public/sw.js` would close this, at the cost of a much larger first
  download — an owner decision.
- The 8 Edot sections without licence metadata, Vilna scans, and new Sefaria requests stay network-only.
- Physical-device verification (airplane mode on iPhone / Android) is still to be done.
