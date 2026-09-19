# Offline resilience

## Fully offline

- The app shell, theme, settings, saved location, learning memory, daily completion, About/privacy pages, and previously stored local data remain available.
- Today uses local date and sunset-aware logic. The last seven successful zmanim snapshots and three calendar snapshots are retained for the saved coordinates; changing the city by search requires the network.
- Tehillim is bundled in the app, so all 150 chapters remain available offline. The last chapter and reading preferences are stored locally.

## Bundled Siddur

The current `Siddur Edot HaMizrach` index is bundled from the existing Sefaria source. It contains 121 of 129 leaf sections whose exact returned edition metadata is `Shaliehsaboo Edition` with `CC0`; this bundle is 1,915,846 bytes. Eight sections returned no license metadata and remain network-only rather than being redistributed without clearance: Bedtime Shema, Song of Songs, Shabbat Shacharit Mi Sheberach, Havdalah Before Havdalah, Havdalah Veyiten Lecha, Rosh Hodesh Mussaf, Seventeenth of Tammuz, and Mourning.

The bundled sections use the existing Siddur normalization policy: Hebrew nikud is preserved and cantillation is removed. The existing flow navigation remains local because the schema is bundled with the text.

## Last-viewed cache

The versioned `kz-content-cache-v1` localStorage cache stores only successful, license-eligible reads:

- The last 5 automatically opened Talmud dapim. Pinned dapim are stored separately and do not consume these five automatic slots.
- 60 recently loaded commentary references, subject to each edition's license.
- 10 Halacha/source reads.
- 5 Siddur sections when opened through Sefaria for the eight network-only sections.

Entries retain reference, Hebrew text, edition, license, and source metadata. The Talmud reader automatically retains the last five successfully opened eligible dapim; the oldest automatic daf is evicted when a sixth is opened. Pinned dapim survive this LRU eviction and do not consume an automatic Talmud slot. Cached content is labeled `זמין מהשמירה האחרונה`.

The automatic Talmud package preserves Gemara, the aligned William Davidson / Steinsaltz payload, segment links, and reading progress stored in local learning memory. Rashi, Tosafot, and other linked commentaries are cached separately when the user opens them and their exact license permits persistence; pinned dapim additionally retain the already-loaded eligible commentary payload inside the pinned package.

Eligible text readers expose `שמור לשימוש ללא אינטרנט`. Pinned entries are protected from normal eviction, with a 30-entry and 4 MiB serialized-cache safety ceiling. The Offline Library reports actual serialized cache bytes, pinned bytes, automatic-cache bytes, and bundled bytes.

## Network-required

- New Sefaria text, outline, search, and commentary requests.
- New city/geocoding searches.
- Vilna scans are not bulk-cached. An uncached scan shows an explicit offline message instead of a broken remote image.
- The 121 CC0 Siddur sections are bundled. The eight sections without license metadata remain remote and can be available offline only after a successful eligible cache, which currently does not occur without explicit license metadata.

When no cached content exists, the reader shows `אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר`. A retry is available, and all resource loaders retry automatically when the browser/native connection returns without reloading the app.

## Real-device QA

The implementation is ready for the requested online/open/close/offline/reopen flow. Actual iPhone offline verification still requires repeating that flow on the device after this build; this environment cannot toggle cellular/Wi-Fi or run an iOS simulator because full Xcode is unavailable.

## Steinsaltz licensing

- Exact edition: `William Davidson Edition - Hebrew`.
- License returned by the current API: `CC-BY-NC`.
- Source URL returned by the edition: `https://korenpub.co.il/collections/koren-talmud-bavli-1`.
- Bundled offline: no.
- Bounded recent/pinned caching: enabled for the noncommercial, attributed use represented by this app, only while the exact metadata remains eligible.
- Commercial/store-distribution concern: yes. `CC-BY-NC` is not commercial-store clearance; legal permission is required before commercial monetization or a store distribution model that is not clearly noncommercial.
- The Gemara edition is `William Davidson Edition - Vocalized Aramaic`, also `CC-BY-NC` from Sefaria. Both edition/version strings and licenses remain visible in the reader attribution.