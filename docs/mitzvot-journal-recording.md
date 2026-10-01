# Recording rule — "המצוות שלי"

The Mitzvot Journal (`src/services/mitzvotJournal.mjs`, localStorage key `kz-mitzvot-journal-v1`) is the single source of truth for the user's Jewish activity. It feeds the "המצוות שלי" screen and the Presence Glow (the radiance of the app emblem).

## Rule

Every completed task, every completed prayer, and any study session of **one minute or more** must be recorded in the journal.

| Activity | How it is recorded | Where |
|---|---|---|
| Prayer | Explicit "סיימתי את התפילה" → `recordPrayerCompletion` | `ComposedPrayerReader.jsx` |
| Tehillim | Chapter / daily portion completed → `recordTehillimCompletion` | `Tehillim.jsx`, `NewApp.jsx` |
| Study | Automatically once a study session passes 60 active seconds → `upsertTorahStudyMinutes` (one entry per work per day; later minutes update it) | `studySession.mjs` |

## Constraints

- When an item may be recorded again is one policy (`repeatPolicy` in `mitzvotJournal.mjs`, shown by `CompletionButton`'s
  "סיימתי" / "ישר כח!"):

  | Kind | Again after | Why |
  |---|---|---|
  | Blessings (ברכות — ברכת המזון, מעין שלוש, בורא נפשות, ברכות הנהנין, תפילת הדרך, ברכות הראייה / המצוות…) | **one hour** after the item's last recording | the same blessing is said again later in the day |
  | Tehillim chapters (and the chapters of התבודדות) | **one hour** | a chapter may be said again |
  | A unit of study ("סיימתי את הלימוד") | **one hour** | the same unit may be learned again |
  | Prayers (שחרית, מנחה, ערבית, ברכות השחר, הלל, הבדלה, ק״ש שעל המיטה, a prayer of שלום רב…), the Omer count, Shnayim Mikra, Today's daily Tehillim portion | the next Jewish day | never counted twice in its time |
  | Timed study minutes | one entry per work per day, updated | unchanged |

  Within its window a second tap records nothing (deduplicated by `eventKey` for a day item, by the hour for an hourly
  one); each recording an hour apart is its own entry and its own light. An open screen flips back to "סיימתי" by
  itself (a timer at the end of the hour, and a re-check when the app returns).
- No weighting between types; the journal is factual, never a score.
- Prayers are recorded only on explicit completion — opening a prayer is not praying.
- Everything stays on the device.

New features that detect user activity must write to the journal (not only to a feature-specific store).
