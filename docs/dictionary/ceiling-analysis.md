# The Aramaic engine — coverage ceilings (pass 2)

Where the unresolved Aramaic tokens go, by reason code (`scripts/aramaic/ceiling-analysis.mjs` over the build trace, `build-aramaic-engine.mjs --trace`). Every Aramaic token (classifier class ARAMAIC_LEXICAL) of a profile's corpora falls in one bucket:
- **REVIEW_CANDIDATE** — a complete analysis held back by the review gate.
- **MORPHOLOGY** — a known lemma with a Hebrew sense is reachable (proclitics, a printed or generated form), but a precision rule blocks it. This is an upper bound of what morphology could reach, not a proof.
- **MISSING_HEBREW_GLOSS** — the dictionaries know the word only in English, or Krupnik without Hebrew.
- **SENSE_CHOICE** — several senses or two lemmas.
- **HEBREW_EMBEDDED** and **PROPER_NAME** — the majority of the form's tokens there.
- **EXCLUDED_REVIEW** — a wrong source gloss.
- **FOREIGN_LOAN** — Jastrow marks it Greek, Latin or Persian.
- **TOKENIZER** — heuristic.
- **TRUE_LEXICAL_GAP** — no lexicon entry at all.

The counts are build-level (the audit's runtime numbers differ by the phrase layer, < 1 point).

## Now (the shipped pass-2 engine, classifier v5)


| PROFILE | ARAMAIC TOKENS | RESOLVED | REVIEW_CANDIDATE | MORPHOLOGY | MISSING_HEBREW_GLOSS | SENSE_CHOICE | HEBREW_EMBEDDED | PROPER_NAME | EXCLUDED_REVIEW | FOREIGN_LOAN | TOKENIZER | TRUE_LEXICAL_GAP | PHRASE-BOUND |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| J bavli | 507656 | 61.9% | 8.0% | 13.7% | 2.9% | 3.4% | 1.7% | 2.9% | 2.1% | 0.1% | 0.0% | 3.3% | 1.5% |
| Y yerushalmi | 160342 | 52.0% | 7.1% | 15.0% | 3.8% | 1.9% | 3.3% | 5.0% | 6.0% | 0.1% | 0.0% | 5.8% | 1.4% |
| M midrash | 303896 | 53.1% | 7.4% | 18.4% | 3.7% | 2.3% | 2.8% | 4.3% | 1.8% | 0.2% | 0.0% | 5.9% | 1.8% |
| T onkelos | 76881 | 52.4% | 9.7% | 22.5% | 6.3% | 4.4% | 0.0% | 0.1% | 0.7% | 0.1% | 0.0% | 3.8% | 0.5% |
| Z zohar | 629873 | 56.3% | 11.4% | 15.8% | 6.0% | 3.6% | 0.1% | 0.4% | 2.5% | 0.0% | 0.0% | 3.9% | 1.0% |
| B biblical-aramaic | 4672 | 47.5% | 5.7% | 27.7% | 7.3% | 3.8% | 0.0% | 0.2% | 0.7% | 0.1% | 0.0% | 7.2% | 0.7% |
| L liturgy | 20384 | 32.0% | 8.1% | 31.5% | 7.5% | 3.3% | 1.7% | 0.1% | 4.9% | 0.1% | 0.0% | 10.8% | 0.9% |
| X mixed | 3647773 | 43.8% | 5.4% | 24.9% | 5.9% | 4.3% | 4.6% | 0.8% | 2.3% | 0.1% | 0.0% | 8.0% | 2.7% |

## Unresolved tokens by the owner's grouping

| PROFILE | UNRESOLVED | CANDIDATE AWAITING REVIEW (complete analysis, below the gate) | DETERMINISTIC (morphology, tokenization) | LEXICAL (new gloss, sense choice, loan, gap) | NOT ARAMAIC (Hebrew, names) |
|---|---:|---:|---:|---:|---:|
| J bavli | 193496 (38.1%) | 21.1% | 35.9% | 30.7% | 12.3% |
| Y yerushalmi | 76919 (48.0%) | 14.8% | 31.3% | 36.6% | 17.2% |
| M midrash | 142546 (46.9%) | 15.9% | 39.3% | 29.6% | 15.3% |
| T onkelos | 36592 (47.6%) | 20.3% | 47.4% | 32.1% | 0.2% |
| Z zohar | 275205 (43.7%) | 26.1% | 36.2% | 36.6% | 1.1% |
| B biblical-aramaic | 2454 (52.5%) | 10.8% | 52.6% | 36.2% | 0.4% |
| L liturgy | 13857 (68.0%) | 12.0% | 46.4% | 39.0% | 2.6% |
| X mixed | 2051389 (56.2%) | 9.5% | 44.2% | 36.6% | 9.6% |

## Before (the pass-1 engine of c155362, classifier v4)


| PROFILE | ARAMAIC TOKENS | RESOLVED | MORPHOLOGY | MISSING_HEBREW_GLOSS | SENSE_CHOICE | HEBREW_EMBEDDED | PROPER_NAME | EXCLUDED_REVIEW | FOREIGN_LOAN | TOKENIZER | TRUE_LEXICAL_GAP | PHRASE-BOUND |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| J bavli | 507656 | 69.8% | 14.3% | 2.6% | 3.4% | 1.7% | 2.9% | 2.0% | 0.1% | 0.0% | 3.2% | 1.2% |
| Y yerushalmi | 161115 | 59.6% | 15.0% | 3.4% | 2.0% | 3.2% | 5.0% | 6.0% | 0.1% | 0.0% | 5.7% | 1.0% |
| M midrash | 303896 | 61.4% | 18.4% | 3.3% | 2.1% | 2.8% | 4.3% | 1.6% | 0.1% | 0.0% | 5.9% | 1.4% |
| T onkelos | 79535 | 61.4% | 22.2% | 5.6% | 6.0% | 0.0% | 0.1% | 0.9% | 0.1% | 0.0% | 3.8% | 0.2% |
| Z zohar | 629873 | 69.1% | 15.9% | 5.3% | 3.3% | 0.1% | 0.4% | 1.9% | 0.0% | 0.0% | 4.0% | 0.8% |
| B biblical-aramaic | 4822 | 52.6% | 28.2% | 7.4% | 3.4% | 0.0% | 0.6% | 0.1% | 0.1% | 0.0% | 7.5% | 0.3% |
| L liturgy | 22692 | 37.6% | 28.0% | 6.0% | 12.8% | 1.5% | 0.1% | 4.2% | 0.0% | 0.0% | 9.7% | 0.7% |
| X mixed | 3647773 | 49.6% | 25.2% | 5.2% | 4.5% | 4.6% | 0.8% | 2.0% | 0.1% | 0.0% | 8.0% | 2.3% |

## Unresolved tokens by the owner's grouping

| PROFILE | UNRESOLVED | DETERMINISTIC (morphology, tokenization) | LEXICAL (new gloss, sense choice, loan, gap) | NOT ARAMAIC (Hebrew, names) |
|---|---:|---:|---:|---:|
| J bavli | 153555 (30.2%) | 47.2% | 37.4% | 15.5% |
| Y yerushalmi | 65114 (40.4%) | 37.1% | 42.5% | 20.3% |
| M midrash | 117328 (38.6%) | 47.7% | 33.8% | 18.6% |
| T onkelos | 30664 (38.6%) | 57.5% | 42.3% | 0.2% |
| Z zohar | 194533 (30.9%) | 51.3% | 47.1% | 1.6% |
| B biblical-aramaic | 2285 (47.4%) | 59.5% | 39.1% | 1.4% |
| L liturgy | 14156 (62.4%) | 45.0% | 52.5% | 2.5% |
| X mixed | 1840288 (50.4%) | 50.0% | 39.3% | 10.7% |

## Onkelos: why 97% of the top 100 forms but 61% of the tokens (pass 1) → 52.5% now

- **The long tail.** Onkelos's 100 most frequent forms are only 26,781 of its 76,881 Aramaic tokens (35%). The first 1,000 forms are 65.5%. A third of the text is forms outside the top 1,000, and each of them occurs fewer than about 12 times. A top-100 band of 93–99% therefore says little about token coverage.
- **Names.** Pass 1 counted the Torah's names as Aramaic words: יעקב, יצחק, דמצרים, דמשה, and יי alone was 1,694 tokens, or 2.1%. Classifier v5 checks each name against the Hebrew verse Onkelos translates, and the denominator dropped by 2,654 tokens.
- **The top 1,000 unresolved Onkelos forms** now hold 16,777 tokens:
  - 31.4% are REVIEW candidates (282 forms) — a gloss exists, confirm or reject.
  - 32.6% are MORPHOLOGY (373 forms) — a known lemma is reachable, but its generated form lacks an Aramaic mark (ואמרו, עשו), a proclitic base is too rare, or a possessive noun is rare.
  - 16.4% are MISSING_HEBREW_GLOSS (157 forms), 11.7% SENSE_CHOICE (116), 4.8% TRUE_LEXICAL_GAP (56) and 2.7% EXCLUDED (13).
  - 0.1% are names or noise.
  - In the owner's terms: about 64% needs deterministic morphology plus confirmation, 33% needs a new lemma, gloss or sense decision, and 0.3% is Hebrew, names or noise.
- **Precision drop.** The pass-1 Onkelos analyses below 200 uses were 13% wrong (sample 1: 87.0%). The review gate holds them back unless the Hebrew verse confirms them. That confirmation keeps 52.5% of the tokens covered; the gate alone would leave 40%.

## Biblical Aramaic (Daniel, Ezra)

- **Now: 47.5%** of 4,672 tokens (pass 1: 54.4% under v5).
- **The top 1,000 unresolved forms** (1,901 tokens):
  - MORPHOLOGY 50.6%: most forms occur once or twice; a proclitic or a possessive on a rare base.
  - MISSING_HEBREW_GLOSS 13.8%, TRUE_LEXICAL_GAP 12.3% (Persian loans such as פרשגן and אדרגזריא), SENSE_CHOICE 7.8%.
  - REVIEW candidates 13.3%.
- A form here is published only when Onkelos publishes the same analysis. With 4,672 tokens, frequency is no evidence.

## Bavli: the 38% it does not gloss (193,496 of 507,656 Aramaic tokens)

| REASON | TOKENS | % OF UNRESOLVED | % OF ALL |
|---|---:|---:|---:|
| known lemma, analysis complete, held by the review gate (REVIEW candidate) | 40,853 | 21.1% | 8.0% |
| known lemma, inflection not reached (MORPHOLOGY: rule-blocked generated form, proclitic, possessive) | 69,410 | 35.9% | 13.7% |
| known lexicon entry, missing Hebrew gloss | 14,711 | 7.6% | 2.9% |
| sense choice needed (several senses / two lemmas) | 17,124 | 8.8% | 3.4% |
| phrase needed (word of a phrase, glossed only inside it — overlaps the rows above) | 7,578 | (3.9%) | (1.5%) |
| abbreviation (not in the Aramaic denominator: 66,603 abbreviation tokens, 49.8% resolved) | — | — | — |
| proper name (the form is a name in the majority of its uses) | 14,912 | 7.7% | 2.9% |
| Hebrew embedded in the Gemara | 8,814 | 4.6% | 1.7% |
| excluded by review (a wrong source gloss) | 10,703 | 5.5% | 2.1% |
| foreign loan (Greek/Latin/Persian) | 408 | 0.2% | 0.1% |
| true lexical gap (no entry) | 16,504 | 8.5% | 3.3% |
| tokenizer error (heuristic) | 57 | 0.0% | 0.0% |

Deterministic recoverable gap (REVIEW candidates + MORPHOLOGY + tokenizer): 57.0% of the unresolved, 21.7% of all Aramaic tokens. The REVIEW part is recoverable by confirming candidates; the MORPHOLOGY part is an upper bound. True lexical gap (missing gloss, sense choice, loans, exclusions, no entry): 30.7% of the unresolved, 11.7% of all.

## Zohar (with Zohar Chadash and Tikkunei): its own queue

- **Unresolved:** 43.7% of 629,873 Aramaic tokens.
  - REVIEW candidates: 26.1% of the unresolved.
  - MORPHOLOGY: 36.2%.
  - Missing Hebrew gloss: 13.6% (the Zohar's vocabulary that Krupnik and Jastrow give only in English, or not at all).
  - Sense choice: 8.2%. Excluded: 5.7%. No entry: 9.0%.
- **The Zohar's frequent formulas** (`docs/dictionary/review/zohar-phrases.tsv`, 205 sequences seen 150+ times): 181 are fully covered, meaning every word is glossed or is Hebrew there, or the phrase layer glosses the formula (תא חזי → בוא וראה, בר נש → אדם, מאי טעמא). 19 need review (for example כמה דאת אמר, where דאת is excluded).
- **Queue files:** `zohar-frequency.tsv` (the 3,000 most frequent Zohar forms with their state), `zohar-unresolved.tsv`, `zohar-top-unresolved.tsv` and `tikkunei-zohar-top-unresolved.tsv`.
