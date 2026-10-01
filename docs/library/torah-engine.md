# Torah Engine — Stage 0

One engine connects content → canonical references → index → search → commentaries → navigation → UI. It extends the
library model (`content-model.md`); nothing is copied or renumbered.

## Modules (`src/services/torah/`)

| Module | Role |
|---|---|
| `inventory.mjs` | One record per work: rights state (OPEN · PERMISSION_GRANTED · NONCOMMERCIAL_ONLY · UNKNOWN · PENDING_PERMISSION · REMOTE_ONLY), capabilities (browsing, global search, in-book search, offline, commentary engine, reference resolution), reader and route, data location. **The rights gate**: only OPEN / PERMISSION_GRANTED / NONCOMMERCIAL_ONLY, published and local, reach full text. |
| `hebrew.mjs` | Search-only normalization (nikud, te'amim, finals, quotes/geresh/gershayim, maqaf, punctuation); tokens keep their span in the original text for highlighting. |
| `refs.mjs` | `TorahRef` `{ workId, category, section, segment, anchorRef, commentatorId, baseWorkId, displayRef }`, `displayRef()`, and `targetFor()` — the one deep-link contract. |
| `commentaries.mjs` | `commentatorsOnVerse()`, `commentariesAt()`, `getCommentaries()`: only commentators with content at the place (verse, seif, segment, page). |
| `citations.mjs` | Conservative explicit-citation parser (SA with part + siman, MB with ס"ק, Tanakh in parentheses, Bavli with amud). |
| `search.mjs` | Query engine: layered query, weighted expansions, AND/partial coverage, text rerank (phrase, proximity window, heading, repetition), exact snippets, series diversity, filters, in-book search. |
| `searchIndex.mjs` / `indexFormat.mjs` | Lazy, checksum-verified loading of the binary index (shards by a word's last two letters; LRU of 48 shards). |
| `engine.mjs` | Facade: `getWork`, `getSegment`, `getCommentaries`, `search`, `resolveRef`, `navigateToRef`, `getRights`, `getAvailability`, `getRelated`. |
| `audit.mjs` | Data-quality audit (also `node scripts/torah/audit.mjs`). |

Curated data (reviewable, not code): `src/data/torah/abbreviations.mjs`, `src/data/torah/topics.mjs` (word families only —
never halachic equivalence).

## Building the index

```
node scripts/torah/build-search-index.mjs          # writes public/torah-index/ and src/data/torah/{searchIndex,verseLayers,citationEdges}.mjs
node scripts/torah/build-search-index.mjs --check  # fails if anything differs (run by tests/torahEngineRegistry.test.mjs)
node scripts/torah/audit.mjs                       # 0 problems expected
```

Rebuild after any pack, registry or normalizer change; the manifest records every work's edition checksum and the
normalizer / format / builder versions, and the tests fail on a stale index.

- **Scope (Stage 0):** Tanakh, Mishnah, Talmud (Bavli, Yerushalmi, minor tractates, Rashi, Tosafot, Rif), halacha (the
  Shulchan Arukh and its bundled commentaries, Rambam, the halacha shelf, עונג שבת and its notes, Yalkut Yosef, the
  Halacha Engine's published answers) and the Zohar with its bundled commentaries: 628 works, 537,640 units, 21.6 MB.
  The whole library would cost 38 MB (691,392 units); the other shelves (chassidut, midrash, responsa, machshava, mussar,
  other kabbalah, mitzvot, reference, legacy books) keep title search and in-book search, with the reason recorded.
- **Stop terms:** the 22 words present in more than 8% of units (לא, על, של…) are not stored; the query treats them as
  optional and the reranker still reads them in the text.

## Reader routes

- `books/r/<work>/<node>[/<unit>][/m[/<comment id>]]` — `m` opens the מפרשים tab narrowed to the unit; a comment id
  scrolls to that comment and marks it.
- `talmud/<Tractate>/<amud>[/<segment>[/rashi|tosafot]]` — the segment is marked; the commentator's panel opens.

## Where מפרשים appear on a Torah verse

The library's chapter reader (tab bar, and a tap on a verse shows the line of its commentators), the library's weekly
portion view, a reading opened from פרשת השבוע / a holiday / a haftarah (the source reader), and שניים מקרא ואחד תרגום.

# Stage 0.5 — offline first, packs, and hybrid search

## Offline audit

Computed from the inventory by `src/services/torah/offlineAudit.mjs` (`tests/offlineAudit.test.mjs` keeps this table
equal to the code). Notes, favorites, recent reading, positions and the spiritual ring are stored on the device for every
corpus. "Needs network" lists what is read online only.

<!-- offline-audit:start -->
| Corpus | Works | Text offline | Global search offline | Book search offline | Commentaries offline | Deep link offline | Scans offline | Needs network | Size | Rights |
|---|---|---|---|---|---|---|---|---|---|---|
| תנ״ך | 39 | yes | built-in (39) | 39/39 | 124/228 | exact place | — | 104 commentary layers read online | 1.4 MB | OPEN |
| מפרשי התנ״ך | 228 | partial (124/228) | built-in (124) | 124/228 | — | exact place | — | 104 works read online | 10.2 MB | OPEN, REMOTE_ONLY |
| משנה | 63 | yes | built-in (63) | 63/63 | 127/127 | exact place | — | — | 0.6 MB | OPEN |
| מפרשי המשנה | 127 | yes | built-in (127) | 127/127 | — | exact place | — | — | 4.3 MB | NONCOMMERCIAL_ONLY, OPEN |
| תלמוד בבלי | 37 | yes | built-in (37) | 37/37 | 97/249 | exact place | no | 152 commentary layers read online; page scans (צורת הדף) | 4.0 MB | OPEN |
| רש״י על התלמוד | 36 | yes | built-in (36) | 36/36 | — | exact place | — | — | 5.8 MB | OPEN |
| תוספות | 36 | yes | built-in (36) | 36/36 | — | exact place | — | — | 5.2 MB | OPEN |
| רי״ף | 25 | yes | built-in (25) | 25/25 | — | exact place | — | — | 1.1 MB | OPEN |
| רמב״ם | 79 | yes | built-in (79) | 79/79 | — | exact place | — | — | 2.1 MB | OPEN |
| שולחן ערוך | 4 | yes | built-in (4) | 4/4 | 4/19 | exact place | — | 15 commentary layers read online | 2.0 MB | OPEN |
| משנה ברורה | 1 | yes | built-in (1) | 1/1 | — | exact place | — | — | 1.7 MB | OPEN |
| ביאור הלכה | 1 | yes | built-in (1) | 1/1 | — | exact place | — | — | 1.0 MB | OPEN |
| באר היטב | 4 | partial (1/4) | built-in (1) | 1/4 | — | exact place | — | 3 works read online | 0.5 MB | OPEN, REMOTE_ONLY |
| כף החיים | 2 | partial (1/2) | built-in (1) | 1/2 | — | exact place | — | 1 works read online | 4.4 MB | OPEN, REMOTE_ONLY |
| ילקוט יוסף | 1 | yes | built-in (1) | 1/1 | — | exact place | — | — | 13.7 MB | NONCOMMERCIAL_ONLY |
| עונג שבת | 2 | yes | built-in (2) | 2/2 | — | exact place | — | — | 0.2 MB | PERMISSION_GRANTED |
| זוהר | 1 | yes | built-in (1) | 1/1 | 3/7 | exact place | — | 4 commentary layers read online | 2.0 MB | OPEN |
| מדרש | 21 | yes | pack midrash (21) | 21/21 | — | exact place | — | — | 7.4 MB | NONCOMMERCIAL_ONLY, OPEN |
| חסידות | 44 | yes | pack chassidut (35) · title only (9) | 35/44 | — | the book | — | — | 19.0 MB | NONCOMMERCIAL_ONLY, OPEN (3 hidden: unknown rights) |
| שו״ת | 19 | yes | pack responsa (19) | 19/19 | — | exact place | — | — | 12.8 MB | OPEN |
| מחשבה, מוסר, קבלה, מצוות, עיון | 73 | yes | pack machshava (59) · title only (14) | 59/73 | — | the book | — | — | 13.4 MB | NONCOMMERCIAL_ONLY, OPEN (2 hidden: unknown rights) |
<!-- offline-audit:end -->

Outside the Torah engine: the calendar's holiday/event list comes from Hebcal online with a saved snapshot as fallback
(zmanim are computed on the device); daf-yomi scans and Steinsaltz are online. The header search, the library, every
book, the מפרשים of the bundled layers, the Siddur and the Halacha Engine start and work with no network.

## Offline packs

- Format (schema 1): `src/services/torah/packFormat.mjs`; built by `node scripts/torah/build-search-index.mjs` into
  `public/torah-packs/<packId>/` (manifest + files) and `public/torah-packs/catalog.json`; the same catalog is bundled
  (`src/data/torah/packCatalog.mjs`). Hosted with the web app on GitHub Pages
  (`https://nzm1000-sudo.github.io/kazzohar-harakia/torah-packs/`); never inside the native app (vite.config.js).
- Install / update / resume / remove: `src/services/torah/packManager.mjs` (SHA-256 of the manifest and of every file,
  atomic registry switch, the previous version kept on failure). Storage: Library/NoCloud through
  `@capacitor/filesystem` on the phone (persistent, excluded from iCloud backup), IndexedDB on the web
  (`src/services/torah/packStore.mjs`).
- Search: an installed pack registers its index (`registerIndex` in `searchIndex.mjs`); a stale one (another normalizer,
  format, stop list or edition) is refused and shown as "נדרש עדכון".
- UI: "הספרייה במכשיר" on the offline page (`pages/OfflineLibrary.jsx`).

## Hybrid search

- `src/data/torah/semanticLexicon.mjs` — reviewed data: question scaffolding and concepts (the words people type → the
  words the sources use), each expansion with its relation (variant 0.95 · synonym 0.9 · modern 0.85 · related 0.5).
- `src/services/torah/queryIntent.mjs` — intent (reference · quote · question · topic), optional scaffolding,
  first-person verbs (שכחתי → שכח) as extra forms, rewrites.
- `src/services/torah/search.mjs` — `mode: 'lexical'` is Stage 0 exactly; `mode: 'hybrid'` (default) adds the rewrites
  and fuses the variants by weighted reciprocal rank (k = 60) before the text reranker; a query the lexicon does not
  rewrite ranks exactly as Stage 0. Every result carries `explain` (variants, base, phrase, window, heading).
- `src/services/torah/typo.mjs` — one-edit correction, only when nothing was found, labelled.
- `src/services/torah/verifiedAnswers.mjs` — for a question: the Halacha Engine's answers among the results and the
  עונג שבת blessing-table row of a named food, shown as the app's verified answer beside the sources.
- Benchmark: `tests/fixtures/semanticBenchmark.mjs` (judged by reading), `node scripts/torah/semantic-benchmark.mjs
  [--mode lexical] [--held-out]`.

### Benchmark (36 judged queries; `node scripts/torah/semantic-benchmark.mjs`)

| | Top-1 | Top-5 | MRR@10 |
|---|---|---|---|
| Stage 0 lexical (`--mode lexical`) | 0.806 | 0.861 | 0.820 |
| Stage 0.5 hybrid (deterministic) | 0.917 | 1.000 | 0.947 |
| questions (7): lexical → hybrid | 0.429 → 0.857 | 0.714 → 1.000 | 0.505 → 0.905 |
| modern Hebrew (5): lexical → hybrid | 0.4 → 0.6 | 0.4 → 1.0 | 0.40 → 0.75 |
| exact refs, keywords, word order, abbreviations, spelling | unchanged: 1.0 | 1.0 | 1.0 |
| held-out questions (5, written after the lexicon was frozen) | 0.4 → 0.4 | 0.4 → 0.4 | 0.40 → 0.40 |

The deterministic layer helps exactly where its reviewed data reaches; it does not generalize to concepts it does not
know (the held-out set) — said plainly, not hidden. Latency on the development Mac (warm, from disk): lexical median
242 ms (p90 380), hybrid median 298 ms (p90 591, max 713). The app shows the lexical results first and replaces them
with the hybrid ranking when ready ("מחפשים גם לפי המשמעות…").

### Local semantic model — feasibility spike (rejected)

Candidates: `intfloat/multilingual-e5-small` (MIT; ONNX int8 via transformers.js, 118 MB), `paraphrase-multilingual-
MiniLM-L12-v2` (Apache-2.0, same size class, weaker on retrieval — not embedded), a Hebrew AlephBERT sentence model
(rejected: no licence stated). Measured with e5-small over the whole halacha family (138,880 units, int8 384-d vectors:
53 MB; embedding took 67 minutes on the Mac; query 118 ms median with a brute-force scan), same judgments, same family:

| halacha family, 33 queries | Top-1 | Top-5 | MRR@10 |
|---|---|---|---|
| lexical | 0.545 | 0.697 | 0.609 |
| deterministic hybrid | 0.727 | 0.848 | 0.786 |
| model alone | 0.212 | 0.485 | 0.336 |
| hybrid + model (RRF, model at 0.8) | 0.515 | 0.909 | 0.660 |

Fused with the hybrid ranking, the model lowers the first result for word order (1.0 → 0.67), abbreviations
(1.0 → 0.33), questions (1.0 → 0.57) and modern Hebrew (0.8 → 0.4); it gains on keywords by explicit judgments
(0.4 → 0.6; the spike counts judged ids only) and on one held-out question (MRR 0.40 → 0.47). With 118 MB of model and ~200 MB of vectors for the whole library it is not shipped: the
engine stays fully lexical + deterministic, and `SEMANTIC_BOUNDARY` in `search.mjs` remains the place a better local
model would plug in.
