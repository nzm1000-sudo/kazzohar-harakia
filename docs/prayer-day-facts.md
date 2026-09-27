# Prayer Day Facts — contract (schemaVersion 1)

`computePrayerDayFacts({ instant, settings, times })` in `src/services/prayer/prayerDayFacts.mjs`.

The Smart Siddur's single **factual** view of the day. It answers *what day, time and place is this?* — never *what should be said*. Tachanun, Hallel, seasonal phrases, Yaaleh Veyavo, Al HaNissim, Aneinu belong to the rule layer (Stage 4). Runtime object; not persisted.

## Architecture inventory (Stage 0)

| Component | Role today | Source of truth? | Reused here? | Gap |
|---|---|---|---|---|
| `@hebcal/core` | Hebrew date, holiday events, flags, Chol HaMoed/Chanukah day numbers, local solar | Yes (calendar facts) | Yes | — |
| `civilDate.jewishDateKey` | Jewish-day boundary from sunset | Yes (boundary) | Yes | — |
| `services.mjs zmanim()` | Sunset via Hebcal API (network) | Yes when online | Preferred when valid for the day | Offline fallback needed → local solar |
| `jewishContextEngine.mjs` | Facts **and** prayer rulings mixed; default tz `UTC` | Partial | No (mixes layers) | Separation of facts/rules |
| `prayer/calendarContext.mjs` | Mincha adapter; own fast list; no sunset | Partial | No | Duplicate calculations |
| `prayer/timeContext.mjs` | Sun state for Mincha; default tz `Asia/Jerusalem` | Partial | Not yet | To be migrated onto facts |
| `dayContext.mjs` (Today page) | Third Hebrew-date path (Intl), fasts from network items | Partial | No | Duplicate calculations |
| `settings.halachicResidenceStatus` / `il` | Israel / diaspora | Yes | Yes (`geoRegimeFrom`) | Unknown was coerced to Israel elsewhere |
| `prayerSession.mjs` | Mincha session snapshot (unversioned storage) | Yes (sessions) | Not yet | Needs schema version + validation (Stage 5) |

## Fields

| Field | Meaning | Values / nullability | Source | Kind |
|---|---|---|---|---|
| `schemaVersion` | Contract version | `1` | — | constant |
| `status` | Overall certainty | `resolved` · `provisional` · `unresolved` | derived | derived |
| `instant` | Canonical instant | ISO string | input | authoritative |
| `timeZone` | IANA zone | string · `null` if invalid/missing | `settings.location.tzid` | authoritative |
| `civilDate` | Local civil date of the instant | `YYYY-MM-DD` · `null` | `civilDateKey` | derived |
| `location` | `{ tzid, latitude, longitude, source }` | numbers or `null` | settings | authoritative |
| `geoRegime` | Israel / diaspora | `israel` · `diaspora` · `unknown` | settings only (never language/nusach) | authoritative |
| `dayBoundary.status` | Could sunset be established? | `resolved` · `unresolved` (no coordinates) · `unsupported` (no sunset, e.g. polar) | — | derived |
| `dayBoundary.afterSunset` | After sunset of the civil date | `true` · `false` · **`null` when not resolved** | `jewishDateKey` | derived |
| `dayBoundary.sunset` / `.source` | Sunset used | ISO · `null`; `app-zmanim` · `local-solar` | app zmanim / `@hebcal/core` | derived |
| `jewishDay.status` | Day certainty | `resolved` · `provisional` (civil date assumed) | — | derived |
| `jewishDay.key` | Civil key of the Jewish day | `YYYY-MM-DD` | boundary | derived |
| `jewishDay.hebrew` | `{ year, month, day, isLeapYear }` (Hebcal month numbers) | numbers | `@hebcal/core` | derived |
| `jewishDay.weekday` / `isShabbat` | 0–6 / boolean | — | `@hebcal/core` | derived |
| `jewishDay.next` | Following Jewish day: `{ hebrew: {year, month, day}, chanukahDay }` — for eve-of-day rules (e.g. Mincha before Rosh Chodesh) | — | `@hebcal/core` | derived |
| `observanceStatus` | Can observances be stated? | `resolved` · `provisional` · `unresolved` (regime unknown and Israel ≠ diaspora) | — | derived |
| `observances[]` | `{ id, family, kind, dayIndex, cholHamoedDayIndex, scope }` — all simultaneous observances kept | `null` when unresolved | `@hebcal/core` flags + Hebrew month/day | derived |
| `facts.isYomTov`, `chag`, `chagDayIndex` | Festival identity and day within it | `rosh-hashanah` · `yom-kippur` · `sukkot` · `shemini-atzeret` · `simchat-torah` · `pesach` · `shavuot` · `null` | flags + month/day | derived |
| `facts.isCholHamoed`, `cholHamoedChag`, `cholHamoedDayIndex` | Exact Chol HaMoed day | index ≥ 1 or `null` | `cholHaMoedDay` (Hebcal), Hoshana Rabbah by ordinal | derived |
| `facts.isHoshanaRabbah`, `isShabbatCholHamoed` | | boolean | derived | derived |
| `facts.isRoshChodesh`, `roshChodeshDayIndex` | | 1 · 2 · `null` | `ROSH_CHODESH` flag | derived |
| `facts.chanukahDay` | Daytime day of Chanukah | 1–8 · `null` | `chanukahDay` (Hebcal) | derived |
| `facts.purim` | | `purim` · `shushan-purim` · `purim-katan` · `null` | month/day (Adar II in leap years) | derived |
| `facts.fast` | Public fast identity | `tzom-gedaliah` · `yom-kippur` · `asara-betevet` · `taanit-esther` · `shiva-asar-betammuz` · `tisha-beav` · `taanit-bechorot` · `null` | fast flags + month | derived |
| `facts.omerCalendarDay` | Calendar day of the Omer (not a counting instruction) | 1–49 · `null` | month/day | derived |
| `facts.modernObservance` | Modern Israeli observance (calendar fact; its prayer consequence is a rule) | `yom-haatzmaut` · `yom-yerushalayim` · `yom-hazikaron` · `yom-hashoah` · `null` | Hebcal `MODERN_HOLIDAY` flag + its canonical desc key | derived |
| `provenance` | `{ calendarEngine, boundary, sunsetSource, locationSource, geoRegimeSource, warnings[] }` | — | — | diagnostic |

**Not in this object, by design:** `tachanun`, `hallel`, `mashivHaruach`, `vetenTalUmatar`, `yaalehVeyavo`, `alHanissim`, `aneinu`, which Omer count to say, walled-city Purim for the user.

## Rule layer (Stage 4, first slice) — `src/services/prayer/prayerRules.mjs`

`resolvePrayerRules({ facts, prayer: { type }, sun })` → `{ version, prayer, factsSchemaVersion, rules }` with rules
`tachanun`, `gevurot.season`, `birkat-hashanim.season`. Each rule is an envelope
`{ ruleId, status, value, reasonCode, sourceRefs[], inputFacts, warnings[], review, kind }`;
`status ∈ resolved | needs-input | unresolved | unsupported`; every `sourceRefs[].ref` is an id in the bundled
Yalkut Yosef corpus (a test enforces this); `review` is `not-reviewed` for every rule — no ruling here has been
reviewed by a posek. `prayer.type` is the service the user opened (`arvit | shacharit | musaf | mincha`) and is
never inferred from the clock; `sun` (`{ state, zmaniyotMinutesAfterSunset }`) comes from the existing `timeContext`.
