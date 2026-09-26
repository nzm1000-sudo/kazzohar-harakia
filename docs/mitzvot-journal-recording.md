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

- One entry per activity per day (deduplicated by `eventKey`); never a separate count per interaction.
- No weighting between types; the journal is factual, never a score.
- Prayers are recorded only on explicit completion — opening a prayer is not praying.
- Everything stays on the device.

New features that detect user activity must write to the journal (not only to a feature-specific store).
