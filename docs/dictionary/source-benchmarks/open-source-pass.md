# Open Sources Expansion Pass (2026-09-30) — summary

SOURCE ≠ GLOSS: every source was benchmarked against the app's own unresolved forms before any import, and enters only
in the role its evidence supports. One layer at a time, each rebuilt and measured.

## Phase 0 — baseline (commit 4521f4a)
- Aramaic token coverage 48.0% (docs/dictionary/coverage-current.md, committed texts); 49.6% measured in the working
  tree of this pass, which also holds the Tanakh commentaries another task is adding (same tree for every before/after
  below).
- Fresh independent accuracy (pass 2, seed 90127): 96.8% (< 98%).
- Dictionary module 182,947 bytes (48,492 gzip); 1,405 abbreviation rows (1,246 keys); 2,705 glossed forms.
- Rights registry: krupnik-1927 (DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION — unchanged; `--release`
  refuses it), jastrow-1903, he-wiktionary, morphhb (cleared).
- First fix of the pass: the Beit Yosef, added to the commentaries, outvoted Rashi's Aramaic קני and the base of למתני.
  It now keeps its own statistics group (scripts/aramaic/corpora.mjs `statsGroup`; the build decides the mixed profile
  with it and, where that fails, without it — and only when the Bavli profile reads the form the same way). Restored:
  קני "קנה", למתני "למלמד משנה" (and מתני, דקני, חליפין, מינאי). The two snapshot rows are restored.

## Phase 1 — the unresolved Aramaic tokens, classified before any source (unresolved-classes.md)

| WHAT WOULD CLOSE THEM | TOKENS | SHARE |
|---|---:|---:|
| morphology — a candidate from the grammar, withheld by the precision gate | 1,261,629 | 42.2% |
| open sources already imported — a Jastrow/Wiktionary/reviewed candidate, withheld by the gate | 28,772 | 1.0% |
| Krupnik only — his candidate, withheld by the gate | 347,276 | 11.6% |
| true lexical gaps — no Hebrew gloss in any imported source (human review) | 705,316 | 23.6% |
| ambiguous or Hebrew-majority forms — withheld | 643,894 | 21.6% |
| **total unresolved Aramaic tokens** (all profiles, the Beit Yosef included) | 2,986,887 | |

Per profile (Bavli / Zohar / Onkelos / Yerushalmi / Biblical): morphology 33% / 37% / 48% / 28% / 47%; Krupnik-only
21% / 23% / 17% / 15% / 13%; true lexical gaps 16% / 22% / 21% / 20% / 28%. The largest lever is not a new lexicon: it
is reviewing the gated morphology candidates (a human pass over `review/*-top-unresolved.tsv`).

## Sources

| SOURCE | LICENCE | BAVLI | ZOHAR | ONKELOS | YERUSHALMI | BIBLICAL | ABBREVIATIONS | CORRECTNESS SAMPLE | PROJECTED TOKEN GAIN | IMPORT DECISION | ROLE |
|---|---|---:|---:|---:|---:|---:|---|---|---|---|---|
| Jastrow 1903 — abbreviations he prints | public domain | (talmud group 23,770 abbr. tokens) | (kabbalah 25,836) | — | — | — | 143 readings, 127 keys; 9 new keys; 62 confirm existing | 118/124 pass the letter check; shipped rows in the samples all correct | 136,659 abbr. tokens with others; 7,866 alone | **imported** (same cleared source) | ABBREVIATION_EXPANSION |
| Ben-Yehuda 37578, ספר ראשי תיבות (Halperin) | public domain | (talmud 50,468) | (kabbalah 198,787) | — | — | — | 13,847 keys, 29,359 readings | final round: 119–120/120 by row, 98–99/100 by tokens | **+579,024 abbr. tokens with others; 337,619 alone** | **imported** | ABBREVIATION_EXPANSION |
| PanLex (ACoLi export; API/dumps gone) | CC0 | 5 | 46 | 88 | 0 | 3 | — | not meaningful (208 tokens) | < 0.01% | not imported | EVIDENCE_ONLY |
| Wikidata Lexemes | CC0 | 0 | 0 | 0 | 0 | 0 | — | — | 0 (2 JBA lexemes, no Hebrew) | not imported | EVIDENCE_ONLY |
| English Wiktionary (kaikki, Aramaic) | CC BY-SA 4.0 | 1,505 | 3,629 | 862 | 311 | 62 | 4 tagged | English only; lineage Jastrow/Sokoloff | lemma matches for 4.6% of the gap tokens; no Hebrew | not imported | LEMMA_ONLY |
| OSHB + Open Scriptures lexicon (BDB) | CC BY 4.0 | — | — | — | — | 179 forms / 354 tokens (letters); 18 / 26 (strict) | — | ~⅓ wrong (letters); 8/18 wrong (strict) | 0 (not imported) | not imported; review queue | EVIDENCE_ONLY (lemma) |
| Sefer HeArukh (Sefaria, Lublin 1883) | public domain | 1,141 | 761 | 626 | 233 | 70 | — | headword matches only | discursive entries: no rule yields a gloss | not imported | EVIDENCE_ONLY |
| Sefer Meturgeman (1541) | public domain | — | — | 500-form lookup list | — | — | — | scans only | — | not imported; lookup queue | FINAL_HEBREW_GLOSS if transcribed |
| Arukh HaShalem (Kohut) | public domain | — | — | — | — | — | — | noisy OCR | — | not imported | EVIDENCE_ONLY |
| Tishbi (Levita) | PD; Wikisource CC BY-SA | — | — | — | — | — | — | letters א–ד only | — | not imported | EVIDENCE_ONLY |
| Heilprin, ערכי הכינויים | public domain | — | — | — | — | — | — | scans only | — | not imported | ABBREVIATION_EXPANSION |
| Assaf, קיצורים וראשי תיבות (BY 43775) | public domain | — | — | — | — | — | 40 bibliographic sigla | — | — | not imported | — |
| CAL | all rights reserved | — | — | — | — | — | — | — | — | never bundled | RESEARCH_ONLY (CAL_EVIDENCE_ONLY) |
| TalmudLab word-translation | no licence (Dicta/Sefaria/CAL data) | — | — | — | — | — | — | — | — | not used | RESEARCH_ONLY |

(Lexical columns: tokens of the true lexical gaps whose form the source lists — a lemma match, not a gloss.
Abbreviation columns: abbreviation tokens of the rows the source takes part in, by reader group.)

Hebrew Wiktionary: the nine categories already fetched are all used (Aramaic senses, idioms, abbreviations of the Jewish
bookshelf, Kabbalah, sages, blessings). An audit of further categories was not done in this pass.

## Coverage before → after (same working tree)

| CORPUS | ARAMAIC TOKENS | BEFORE | AFTER | GAIN | ABBREVIATIONS BEFORE | AFTER |
|---|---:|---:|---:|---:|---:|---:|
| Bavli | 507,656 | 62.0% | 62.0% | 0 | 49.8% | 62.9% |
| Zohar (+ Chadash) | 562,940 | 56.4% | 56.4% | 0 | 22.2% | 35.5% |
| Tikkunei Zohar | 66,933 | 59.5% | 59.5% | 0 | 15.3% | 15.7% |
| Onkelos | 76,881 | 52.5% | 52.5% | 0 | 18.8% | 20.3% |
| Yerushalmi | 160,342 | 52.2% | 52.2% | 0 | 6.0% | 26.8% |
| Biblical Aramaic | 4,672 | 47.5% | 47.5% | 0 | — | — |
| Siddur (liturgy) | 20,384 | 30.4% | 30.4% | 0 | 24.1% | 31.2% |
| Midrash | 303,896 | 53.3% | 53.3% | 0 | 23.6% | 39.9% |
| Mixed commentaries | 2,222,104 | 50.0% | 50.1% | +1,934 | 32.5% | 45.0% |
| Other (halacha, responsa, kabbalah …) | 1,950,726 | 42.9% | 42.9% | +684 | 30.2% | 43.2% |
| **Total** | **5,883,631** | **49.6%** | **49.6%** | **+2,618** | **31.1%** | **44.0%** (+586,912) |

Without Krupnik (`--exclude krupnik-1927`): Aramaic 29.7%; abbreviations 31.6% — the open layer alone now matches what
the shipped dictionary with Krupnik read before this pass (31.1%).

Token contribution of the abbreviation layer without double counting (593,732 decided tokens): Ben-Yehuda alone
337,619 · Jastrow alone 7,866 · Krupnik alone 4,193 · Wiktionary alone 547 · two sources or more 243,507.

## Accuracy
- Abbreviation layer: acceptance samples in four rounds (errors turned into rules); final round ≥ 98% by tokens,
  ≥ 99% by rows (ben-yehuda.md).
- Aramaic words: a fresh independent sample of this pass (seed 30930, `docs/dictionary/accuracy-fresh-3.tsv`, 300 tokens stratified: Bavli 60, Zohar 60,
  Onkelos 40, Yerushalmi 30, Biblical 30, liturgy 20, Midrash 20, commentaries 40): **290/300 = 96.7%** (Bavli 60/60,
  Zohar 57/60 with Chadash/Tikkunei, Onkelos 39/40, Yerushalmi 28/30, Biblical 30/30, liturgy 20/20, Midrash 19/20,
  commentaries 37/40). Every error was withheld afterwards (not re-measured): אימא/בר/זמין in the Zohar, ואייתי in
  Onkelos, בעי in the Yerushalmi, סגיא in the Midrash, פירשה/כדאיתא/מיאון in the commentaries. **Gate (≥ 98%): not
  met** — unchanged from pass 2 within the sample's error (the Aramaic word engine was not changed by this pass).

## Size and speed (Node 20, this machine; before → after)
- Module 182,947 → 225,676 bytes (48,492 → 56,961 gzip; its own lazy chunk, offline).
- Parse on load 2.7 → 4.3 ms; heap after load +1.5 → +2.0 MB; import 1.2 → 1.4 ms.
- Lookup (16,530 lookups): p50 0.0030 → 0.0030 ms, p95 0.0053 → 0.0052 ms.
- Reader groups are named "@talmud/@kabbalah/@rabbinic" in the module and expanded once at parse.

## Rights
Cleared and imported: jastrow-1903, he-wiktionary, morphhb, **ben-yehuda-rt (new)**. Pending: krupnik-1927 (unchanged,
release refused). Evaluated, not imported (recorded in the registry with the reason): oshb-lexicon, panlex,
wikidata-lexemes, kaikki-en-wiktionary-aramaic, arukh-lublin-1883, arukh-hashalem-kohut, meturgeman, tishbi-1541,
heilprin-erkhei-hakinuyim, ben-yehuda-assaf-sigla, cal, talmudlab-word-translation, sefaria-word-form, zohar-lexica,
klein-1987. Credit requested (not required): "Project Ben-Yehuda volunteers" on the sources page.

## Status
INCOMPLETE — CONTINUE LEXICAL REVIEW (fresh accuracy 96.7% < 98%; the lexical gains lie in the human review of the
gated candidates, the Meturgeman lookup list and the Daniel/Ezra queue) and RELEASE RIGHTS PENDING (Krupnik).
