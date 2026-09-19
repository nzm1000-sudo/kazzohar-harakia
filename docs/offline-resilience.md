# Offline resilience

## Fully offline

- The app shell, theme, settings, saved location, learning memory, daily completion, About/privacy pages, and previously stored local data remain available.
- Today uses local date and sunset-aware logic. Zmanim can continue from saved coordinates; changing the city by search requires the network.
- Tehillim is bundled in the app, so all 150 chapters remain available offline. The last chapter and reading preferences are stored locally.

## Last-viewed cache

The versioned `kz-content-cache-v1` localStorage cache stores only successful, license-eligible reads:

- 5 Talmud dapim.
- 10 Halacha/source reads.
- 5 Siddur sections when opened through Sefaria.

Entries retain reference, Hebrew text, edition, license, and source metadata. Oldest entries are evicted automatically within each content type. Cached content is labeled `זמין מהשמירה האחרונה`.

## Network-required

- New Sefaria text, outline, search, and commentary requests.
- New city/geocoding searches.
- Vilna scans are not bulk-cached. An uncached scan shows an explicit offline message instead of a broken remote image.
- Siddur sections are currently remote Sefaria content, not a bundled Siddur corpus. A section is available offline only after it has been successfully opened and cached, and only when its returned license does not clearly restrict local storage.

When no cached content exists, the reader shows `אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר`. A retry is available, and all resource loaders retry automatically when the browser/native connection returns without reloading the app.

## Real-device QA

The implementation is ready for the requested online/open/close/offline/reopen flow. Actual iPhone offline verification still requires repeating that flow on the device after this build; this environment cannot toggle cellular/Wi-Fi or run an iOS simulator because full Xcode is unavailable.