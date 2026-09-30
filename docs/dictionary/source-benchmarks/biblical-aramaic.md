# Biblical Aramaic (Daniel, Ezra) — OSHB/morphhb and BDB benchmark

Sources:
- **OSHB/morphhb** (CC BY 4.0, already registered as `morphhb`; `sources/morphhb/raw/words.tsv.gz`): every word of
  Daniel/Ezra with its augmented Strong lemma and an Aramaic morphology code (A-prefixed: `AVqv2ms`,
  `AR/Ncmsd/Td`) — 4,948 Aramaic word tokens.
- **Open Scriptures Hebrew Lexicon** (CC BY 4.0; github.com/openscriptures/HebrewLexicon commit `21c9add1`): AugIndex
  (lemma → lexical id) and LexicalIndex (Aramaic part: 710 rows with the pointed BDB headword, part of speech and a
  short English definition). Fetched by `scripts/dictionary/fetch-oshb-lexicon.mjs` into
  `sources/oshb-lexicon/raw/aramaic-index.tsv.gz` (registry `oshb-lexicon`, not imported). BDB's English is evidence
  only: never shown and never translated.

1,811 Biblical Aramaic surface forms get an OSHB lemma (1,522 of the 1,542 unresolved ones).

## The experiment: OSHB's annotated lemma as a confirmation of the engine's own analysis
The engine's Daniel/Ezra analyses below the review gate are published only when Onkelos publishes the same analysis. A
second confirmation was tried: the form's OSHB lemma (one lemma for all its occurrences) is the lemma of the engine's
analysis.

| RULE | FORMS GAINED | TOKENS | WRONG IN THE REVIEW |
|---|---:|---:|---|
| lemma letters equal (final א/ה aside) | 179 | 354 | about a third (ספר "shore" for "book"; מאני "who" for "vessels"; רבה "took interest" for "great"; בעל "lay with" for "commander") |
| + same part of speech, single-entry lemma, single sense | 18 | 26 | 8 of 18 (מרא "hoe" for "lord"; גשמה "bolt" for "his body"; יתירא "rope" for "excellent"; אתעקרו "became barren" for "were uprooted") |

The letters and the part of speech do not tell homographs apart, and the dictionaries' Hebrew senses (Krupnik,
Jastrow) are the Talmud's, not Daniel's. **Decision: not imported.** Biblical Aramaic coverage stays 47.5% (4,672
tokens; Krupnik contributes 1.3 points). What the sources give instead is a review queue:
`docs/dictionary/review/biblical-aramaic-oshb.tsv` — every unresolved Daniel/Ezra form with the engine's candidate,
OSHB's lemma, part of speech, morphology and BDB's English, for the human reviewer (who can write the Hebrew gloss;
nothing is translated automatically).

Accuracy of Biblical Aramaic in the fresh sample of this pass (seed 30930): 30/30 correct (the stratum was 91% in the
second pass sample; its errors were corrected then).
