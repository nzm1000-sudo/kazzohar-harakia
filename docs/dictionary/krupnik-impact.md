# Krupnik & Silbermann — rights record and removal impact

**Status: CLEARED — Public Domain, for one version only (since 2026-10-01).** The registry (`src/data/dictionary/sources.mjs`) records `rightsStatus: CLEARED`, with:

- **The confirmation (internal record).** An official reply from Sefaria — Team Sefaria / Rachel Lieberman Buckman — to our permission request of 1 October 2026. Sefaria confirmed that each text's licence is per version, and sent the exact version details:
  - Text: A Dictionary of the Talmud
  - Authors: Baruch Krupnik / A. M. Silbermann
  - London, 1927
  - Source: National Library of Israel — nli.org.il
  - Digitization: Sefaria
  - License: Public Domain

  Recorded as `releaseConfirmation` (`kind: sefaria-written-confirmation`).
- **The scope: this version only.** The determination applies only to the version "Krupnik / Silbermann, London 1927, digitized by Sefaria, source NLI" (`clearedVersion`: Sefaria version title "A dictionary of the Talmud, London, 1927", language `he`, version source `https://www.nli.org.il/he/books/NNL_ALEPH990026160720205171/NLI`, digitized by Sefaria, Public Domain).
  - Public Domain status is **not** extended to any other version, edition, reprint or translation of the dictionary, nor to any other Sefaria text.
  - Another source needs its own clearance.
- **Enforcement.**
  - Every build (`build-aramaic-engine.mjs`, release or not) compares the fetch record (`sources/talmud-dictionary/raw/fetch.json`: index, version title, version source, digitized-by-Sefaria, licence) with `clearedVersion`, field by field. It also checks the record's hash against `contentHash`, and stops on any difference.
  - The fetcher (`fetch-krupnik.mjs`) refuses to store any version whose title, language, source or digitizer differ.
  - A Sefaria confirmation recorded without a named version is rejected by the gate.
  - Tests: `tests/aramaicEngine.test.mjs` ("rights", "provenance").
- **Now allowed.** Offline storage, indexing, search, entry extraction, normalisation, short Hebrew glosses and UI adaptation. The engine uses the source in release builds: `build-aramaic-engine.mjs --release` no longer refuses it.
- **Credit (sources page, `src/pages/AboutPage.jsx`, section מילון בלחיצה):** "A Dictionary of the Talmud — Baruch Krupnik & A. M. Silbermann, London 1927. Digitization: Sefaria. Source: National Library of Israel. Public Domain." The text is the registry's `attribution`, checked word for word by the test.

### Data layers and provenance

Each layer is kept apart (`dataLayers` in the registry):

- **Original:** `sources/talmud-dictionary/raw/entries.jsonl.gz`. Sefaria's entries are stored unaltered (`{ref, he}`) and pinned by `contentHash`; they are never edited.
- **Normalised (build time only):** the parser (`scripts/dictionary/lexica/krupnik.mjs`) derives headword keys, and each sense's Hebrew definition (`def`) with the markup stripped. None of this is shipped.
- **Adapted:** the shipped rows with source code 0 (SENSES, PHRASES, ABBREVIATIONS). Each is a short gloss cut from `def` by fixed rules (`cleanGloss`), or an expansion as printed (a proclitic ב/ד/ו/ל/מ/כ may be added by rule). Nothing is rewritten.
- **App-generated:** source code 3 (grammar) and source code 4 (reviewed). Every reviewed gloss records its basis, and `krupnikOnlyBasis` finds the ones that rest on Krupnik alone.
- **Traceability:** a test checks that every source-code-0 row traces back to a Krupnik sense or expansion.

### History: the earlier pending status (2026-09-30 → 2026-10-01)

- **The earlier status.** Until the confirmation, the registry recorded `rightsStatus: DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION`, by the owner's decision of 2026-09-30 (pass 2):
  - Development builds used the source.
  - A release build (`--release`) was refused until one of two things was recorded in `releaseConfirmation`, or the source was removed (`--exclude krupnik-1927`):
    - `sefaria-written-confirmation`: a written Sefaria confirmation for this exact digitization;
    - `rights-holder-permission`: permission of the heirs of Baruch Krupnik (Karu, d. 1972) and of A. M. Silbermann (d. 1939).
- **Why the gate was on.**
  - Sefaria listed the work among its "Texts Digitized by Sefaria".
  - By the authors' death years, the joint work was judged possibly protected under life + 70 in Israel, the UK and the EU until the end of 2042. In the US it has been public domain since 2023.
  - Its availability on Sefaria or GitHub was not considered to settle that.
- **How it was resolved.** Sefaria's written confirmation of 2026-10-01 is the first of the two ways out, and it was recorded with the version it names.

## Coverage with and without Krupnik

The analysis build: `build-aramaic-engine.mjs --exclude krupnik-1927 --out <dir>`, measured by `audit-coverage.mjs --dict <dir>/wordDictionary.mjs`. Same classifier (v5), same review gate, same reviewed data. Reviewed forms whose recorded basis is Krupnik alone leave with the source, and so do reviewed choices among his senses.

| CORPUS | WITH KRUPNIK (shipped; release builds since 2026-10-01) | WITHOUT | CONTRIBUTION |
|---|---:|---:|---:|
| Bavli | 62.0% | 40.1% | 21.9 points |
| Zohar (+ Chadash) | 56.4% | 39.1% | 17.3 points |
| Tikkunei Zohar | 59.5% | 41.1% | 18.4 points |
| Onkelos | 52.5% | 46.8% | 5.7 points |
| Yerushalmi | 52.2% | 40.9% | 11.3 points |
| Biblical Aramaic | 47.5% | 46.2% | 1.3 points |
| Midrash | 53.3% | 40.2% | 13.1 points |
| Liturgy | 30.4% | 24.5% | 5.9 points |
| Mixed commentaries | 45.7% | 25.9% | 19.8 points |
| **Total** | **48.0%** | **29.3%** | **18.7 points** |

## Production glosses that depend exclusively on Krupnik (the shipped data module)

| WHAT | TOTAL | KRUPNIK ONLY |
|---|---:|---:|
| glossed forms | 2,625 | 1,129 (43%) — every analysis of the form rests on a Krupnik sense or on a reviewed gloss whose basis is Krupnik alone; 36 more forms rest on him in some profiles |
| form analyses (per profile group) | 2,718 | 1,192 |
| senses (distinct Hebrew glosses) | 1,622 | 518 |
| reviewed form glosses (FORM_GLOSSES) | 751 | 151 (basis names Krupnik alone) |
| phrases | 169 | 149 |
| abbreviations | 1,397 | 896 |

## Provenance (clean removal, should it ever be needed)

- Every gloss in the data module carries its source code: 0 = krupnik-1927 (SENSES, PHRASES, ABBREVIATIONS).
- Reviewed glosses record their basis (`reviewedAramaic.mjs`). `--exclude krupnik-1927` drops the Krupnik senses, phrases and abbreviations, the reviewed forms whose basis names Krupnik alone (`krupnikOnlyBasis`), and the reviewed sense choices among his senses. Every other source stays.
- The Krupnik-free analysis build is complete (102 KB module) and passes the same resolution path.
