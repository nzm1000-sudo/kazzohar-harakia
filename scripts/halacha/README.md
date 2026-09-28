# How the Halacha Engine corpus was built (2026-09-28)

1. **Source**: קיצור שולחן ערוך ילקוט יוסף (הרב יצחק יוסף, מהדורת תשס"ז), already bundled in the app
   (`src/data/yalkutYosef.mjs`, CC BY-NC-SA 2.5 via תורת אמת; see `docs/licenses/yalkut-yosef.md`).
2. **Questions**: six drafting agents, one per area (prayer, blessings, Shabbat, Pesach/Omer/fasts, Tishrei–Purim,
   home/kashrut/life cycle), looked at what people actually ask on public Hebrew Q&A sites (hidabroot, kipa, din.org.il
   and others). The sites were leads only: no answer text was taken from them. Where a page asking the question was
   opened and matched, its URL is kept in `askedOn`.
3. **Answers** (`PROTOCOL.md`): each entry is grounded in one Yalkut Yosef section — a verbatim excerpt (40–400
   characters) that contains the ruling, and a short answer that adds nothing to it and keeps its level
   (נהגו / ראוי / יש אומרים).
4. **Mechanical verification** (`verify.mjs`) — an entry is rejected unless:
   - the section exists and the excerpt is a verbatim span of it;
   - fields, contexts and rule type are valid; a "custom" shows custom wording in the quoted words;
   - it duplicates no existing answer (same section and question, or the same canonical question) or other entry.
   The siman/se'if citation is computed from the section, the category from where the section sits in the book, and
   the further references from the brackets inside the section itself. Every `askedOn` page is fetched; only pages
   that load are kept.
5. **Editorial pass** (`editorial.json`): rule types the source states as plain rulings; `askedOn` pages that ask a
   neighbouring case; one entry whose excerpt could not hold both halves of its paragraph.
6. **Import** (`convert.mjs`) → `src/data/halachaEngineEntries.mjs`, with topic names aligned to the library's topics.
   `tests/halachaEngine.test.mjs` re-runs the quality gate on every entry.

The drafts and fetched pages were working files and are not stored in the repository; the scripts document the rules.

## Gap batch (stage 2)
`gap-entries.mjs` drafted eight entries for gaps the guided flows exposed (Chol HaMoed and Yom Tov yaaleh veyavo,
doubt in counting the Omer, המלך המשפט and finishing without it, mezonot said over bread — kept as a dispute — and a
dairy spoon in an old meat pot). Excerpts are cut from the section by script (start/end phrases), then pass the same
`verify.mjs`. `editorial.json` also narrows first-night entries to `seder-night` / `sukkot-first-night`.

## Stage 3
- `gap-entries.mjs` adds the two Rosh Chodesh mid-Amidah entries (section 7-27-16), each with a supporting section for
  the Mincha case (`extraSources`, verified verbatim like the main excerpt).
- `source-map.mjs` builds `src/data/halachaSourceMap.mjs`: the Shulchan Arukh siman a Yalkut Yosef section is built on,
  kept only when the wording confirms it (claimed siman among the 3 closest of the whole book, IDF-weighted overlap).

## Stage 5 — learning tracks (2026-09-28)
Four drafting agents (brief: `TRACKS-BRIEF.md`) collected the questions people ask on each track's subject (דין,
הלכה יומית, הידברות, קו ההלכה, hl5047 and others — leads only, no answer text taken) and answered each from one Yalkut
Yosef section, exactly per `PROTOCOL.md`. `HALACHA_STAGE=tracks node verify.mjs` checked every draft against every
published entry (Halacha Engine entries included) and every page in `askedOn`: 283 accepted, 0 rejected.
`HALACHA_STAGE=tracks node convert.mjs` writes `src/data/halachaTrackEntries.mjs`; the tracks' additions (new entries and
published entries not yet on the track) are in `tracks-<track>.json`. In search a track entry weighs 0.6, so a general
question keeps its general answer while a specific question still reaches its specific case.
