# Krupnik & Silbermann — removal impact (analysis only; production unchanged)

**Status: RELEASE RIGHTS PENDING.** The registry (`src/data/dictionary/sources.mjs`) records `rightsStatus: DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION`:
- Development builds use the source.
- A release build (`build-aramaic-engine.mjs --release`) is refused until one of the following is recorded in `releaseConfirmation`, or the source is removed (`--exclude krupnik-1927`):
  - `sefaria-written-confirmation`: written Sefaria confirmation covering redistribution and adaptation of this exact digitization in iOS/Android apps distributed in Israel and internationally.
  - `rights-holder-permission`: permission of the heirs of Baruch Krupnik (Karu, d. 1972) and of A. M. Silbermann (d. 1939).

**Why the gate stays on:**
- Sefaria lists *A Dictionary of the Talmud* among its "Texts Digitized by Sefaria", which it says may be copied, shared, printed and adapted.
- But the underlying joint work may still be protected in Israel, the UK and the EU until the end of 2042 (life + 70).
- The work's availability on Sefaria or GitHub does not settle that.
- The gate is tested in `tests/aramaicEngine.test.mjs`.

## Coverage with and without Krupnik

The analysis build: `build-aramaic-engine.mjs --exclude krupnik-1927 --out <dir>`, measured by `audit-coverage.mjs --dict <dir>/wordDictionary.mjs`. Same classifier (v5), same review gate, same reviewed data. Reviewed forms whose recorded basis is Krupnik alone leave with the source, and so do reviewed choices among his senses.

| CORPUS | WITH KRUPNIK (shipped) | WITHOUT | CONTRIBUTION |
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

## Provenance (clean removal)

- Every gloss in the data module carries its source code: 0 = krupnik-1927 (SENSES, PHRASES, ABBREVIATIONS).
- Reviewed glosses record their basis (`reviewedAramaic.mjs`). `--exclude krupnik-1927` drops the Krupnik senses, phrases and abbreviations, the reviewed forms whose basis names Krupnik alone (`krupnikOnlyBasis`), and the reviewed sense choices among his senses. Every other source stays.
- The Krupnik-free analysis build is complete (102 KB module) and passes the same resolution path.
