# The Aramaic language engine of the word lookup

SURFACE → NORMALIZATION → FORM RESOLUTION → MORPHOLOGY → LEMMA → CONTEXT (profile) → VERIFIED LEXICON → SHORT HEBREW GLOSS

## Pieces
| Piece | File | Role |
|---|---|---|
| Corpus registry | `scripts/aramaic/corpora.mjs` | every text of the app → corpus + dialect; loader |
| Token classifier | `scripts/aramaic/classify.mjs` (v4), `scripts/aramaic/names.mjs` | ARAMAIC / HEBREW / NAME / ABBREVIATION / NUMBER / UNCERTAIN — independent of the dictionary |
| Coverage audit | `scripts/aramaic/audit-coverage.mjs` | per corpus and group: tokens, classes, coverage, bands, top unresolved, samples, regression snapshot |
| Lexicon parsers | `scripts/dictionary/lexica/{krupnik,jastrow,wiktionary}.mjs` | structured entries (senses, stems, forms, Hebrew equivalents, citations by corpus) |
| Lexicon | `scripts/dictionary/aramaic/lexicon.mjs` | lemmas, senses, printed forms, spelling aliases, phrases, abbreviations |
| Morphology | `scripts/dictionary/aramaic/{verbs,nominal,analyze}.mjs` | verb paradigms by root class (strong, I-nun, I-aleph, I-yod, hollow, III-weak, geminate, quadriliteral) + 8 reviewed irregular verbs (אמר, אתא, הוה, יהב, סלק, עלל, קום, יכל); noun states/number/possessives; proclitic splits (ו ד ב ל כ מ קא and 30 combinations) with constraints |
| Build | `scripts/dictionary/build-aramaic-engine.mjs` | rights gate → lexicon → candidates for every form of the app's texts → sense per profile → precision rules → data module, lemma table, report, manifest |
| Runtime | `src/services/wordLookup/engine.mjs` + `aramaic/{render,hebrewVerbs,pronominal,profiles}.mjs` | phrase → abbreviation → form → proclitic fallback; Hebrew rendering; reverse index |
| Reviewed data | `src/data/dictionary/reviewedAramaic.mjs`, `reviewed.mjs` | form glosses, lemma glosses, sense choices, identities, stem glosses, exclusions, phrases |

## Resolution order (runtime)
1. Phrase (2–4 words, the text around the tap must match; longest wins) — 165 phrases.
2. Abbreviation, by reader family (ת״ש only in the Gemara and its commentaries) — 1,397 entries.
3. The form: every form of the app's texts was analysed at build time and stored with its lemma sense, morphological
   tag and proclitics per profile (12,243 forms); rendered at tap time.
4. Proclitic fallback for forms the texts never had (online texts), profiles J Y T Z only, never for a form the build
   left unresolved (4,259 forms listed in NOFALLBACK).

Build-time order for a form (strength): reviewed form (110) → pronominal table (105) → exact headword (100) → reviewed
irregular paradigm (98) → spelling alias (94) → a form the dictionary prints under the lemma (92) → generated noun
inflection (72) / verb inflection (70); every proclitic −4. The strongest candidate decides; an ambiguous or
gloss-less strongest candidate leaves the form unresolved (no weaker analysis of another word is taken).

Precision rules (from the accuracy reviews):
- a generated inflection only on a form with an Aramaic morphological mark (־א ־יה ־ייהו ־נא ־ינן ־כון ־הון ־תון ־והי,
  JBA imperfect ל/נ + י, infinitive מי־, reflexive את/אית/אשת/אצט/אזד);
- a proclitic only on a base that is itself an Aramaic word of that corpus (≥5 uses, Aramaic majority);
- a possessive suffix only on a noun the corpus uses ≥20 times;
- more Jastrow homographs than Hebrew senses → ambiguous (unless the sense is cited from that corpus);
- a sense by evidence: the sense the dictionary cites from the profile's corpora, in the profile's order;
- a form used fewer than 10 times in its corpus (3 in Onkelos, Biblical Aramaic, the liturgy) is glossed only by a
  reviewed paradigm, the pronominal table, a reviewed choice, or a bare headword whose sense is cited from that corpus;
- "ch. same" glosses identical to the Aramaic word only for 54 reviewed words (אמר, כתב …); the Hebrew entry's own
  derived stems are never taken (השתכח, הגלה are false friends).

## Reviewed data (2026-09-30)
| Kind | Count |
|---|---:|
| Form glosses (with basis: lexical source + grammar) | 761 |
| Lemma glosses from the dictionaries' English (unambiguous words only) | 7 |
| Sense choices among the sources' own senses | 94 |
| Identity glosses ("ch. same") | 54 |
| Stem glosses (Af. from Jastrow's English) | 9 |
| Krupnik senses whose Hebrew is missing in the digitization | 2 |
| Excluded forms | 186 |
| Reviewed phrases / excluded dictionary phrases | 5 / 12 |
| Pronominal-preposition grammar table | 168 forms |
| Hebrew verb conjugation table (reviewed irregular Hebrew verbs; strong qal generated) | 54 |

Where a gloss is not literally printed by a source (the lemma/stem glosses, some form glosses), it renders a meaning the
source states in English (Jastrow) or in its English/German translation (Krupnik); each such entry names that source
and sense. These are reviewer decisions, not machine translation, and are counted above.

## Third-party-derived data (Phase 14)
- Glosses: Krupnik & Silbermann (Hebrew definitions, cut by fixed rules), Jastrow (only the Hebrew he prints), Hebrew
  Wiktionary (CC BY-SA 4.0 — the lines with source code 2 are shared under that licence; 6 senses), the reviewed data.
- Form → lemma mappings: our own — from the forms Jastrow and Krupnik print under their lemmas (public domain), the
  reviewed paradigms and rules of `scripts/dictionary/aramaic/*`, and the app's own texts (attestation). No curated
  mapping of another project is used: Sefaria's WordForm data is not used (no licence stated); Targum Molcho was not used.
- Proper names for the classifier: OSHB (CC BY 4.0, attributed on the sources page) and Jastrow; not shipped.
- The phrase table: Krupnik & Silbermann's multi-word headwords, Wiktionary idioms, the reviewed phrases.

## Sizes and performance (Node 26, this machine)
- `src/data/dictionary/wordDictionary.mjs`: 585,529 bytes (154,900 gzip); loaded as its own chunk, bundled (no network).
- Parse on load: 7.9 ms; heap after load: +3.8 MB.
- Lookup (16,500 lookups of the regression forms): median 0.0016 ms, p90 0.0030 ms, max 0.53 ms (first call).

## Accuracy review (Phase 8) — samples drawn by the audit (fixed seed) and judged by the reviewer
Judged against the underlying source sense and the context (a two-reading display counts as correct when one reading
fits). Samples: `docs/dictionary/accuracy-samples.json` (drawn from the build before the last fixes).

| Corpus | Sample | Correct | Accuracy | Main error types |
|---|---:|---:|---:|---|
| Bavli | 300 | 284 | 94.7% | rare nouns' wrong homograph sense; Hebrew words read as Aramaic; derived stems |
| Zohar | 200 | 187 | 93.5% | rare nouns' senses (כגוונא, קיומא, שערא); ד + noun |
| Onkelos | 150 | 136 | 90.7% | names (בעור, אדם); בכן; Targumic nouns |
| Yerushalmi | 100 | 96 | 96.0% | Galilean דמר; rare verbs |
| Other (Rashi/Tosafot 40, Midrash 30, liturgy 30, Biblical Aramaic 20, Tikkunei 20) | 140 | 129 | 92.1% | Biblical לימא/לקבל; לבושא |
| **Total** | **890** | **832** | **93.5%** | |

Gate (≥98%): **FAIL**. Every error found was corrected in the reviewed data (the corrections are in the current build);
the remaining error rate lies in the unreviewed long tail (forms ranked below ~1,000 in each corpus).
