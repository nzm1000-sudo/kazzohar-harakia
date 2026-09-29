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
