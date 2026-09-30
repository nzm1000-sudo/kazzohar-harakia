# Project Ben-Yehuda public-domain dump — reference works and the abbreviation dictionary

## The dump
github.com/projectbenyehuda/public_domain_dump, version 2026-03, commit `5e4277fe`. About 876 MB. `txt/pNNN/mNNNNN.txt`
(with nikkud), `txt_stripped/`, `html/`, and `pseudocatalogue.csv` (26,455 works; genres: poetry 13,140, article 7,213,
prose 3,523, reference 1,192, lexicon 2). Licence file: "Public domain … free to make any use of them"; credit to
"Project Ben-Yehuda volunteers" requested, not required.

Reference works found (by title, genre and author search):

| ID | TITLE | AUTHOR | FULL TEXT | USE |
|---|---|---|---|---|
| **37578** | ספר ראשי תיבות | published under Avraham Yitzhak Stern; Ben-Yehuda: the work of Meir Halperin | yes, 30,275 lines | **imported: ABBREVIATION_EXPANSION** |
| 43775 | תקופת הגאונים וספרותה: קיצורים וראשי תיבות | Simcha Assaf | yes (~40 bibliographic sigla) | not imported (not word abbreviations) |
| 24412 | מילון העברית הישנה והחדשה | Eliezer Ben-Yehuda | no (243-byte stub; the site's own module is not in the dump) | — |
| 57601/57605/57609/57613 | מלון בן־יהודה: המבוא הגדול; רשימת ספרים | Hemda Ben-Yehuda; Tur-Sinai | prose/bibliography | — |
| 31405, 5420 | lexicon samples; Yellin's word lists | Sokolow; Yellin | samples | — |
| 4945/6560, 33344/33345 | proverbs; names | Tabyov | yes | — (not a lexicon) |

No Aramaic lexicon is in the dump.

## Halperin, הנוטריקון, הסימנים והכינויים (Vilna 1912)
The original is only a scan (HebrewBooks 52496). Work 37578, "ספר ראשי תיבות" (Sighet 1926), is identified by
Project Ben-Yehuda as Halperin's work ("שחיבר למעשה מאיר היילפרין"); its title page promises "about 16,000
abbreviations of the Babylonian and Jerusalem Talmud, the Midrashim, the Rishonim and Acharonim".

Rights (registry `ben-yehuda-rt`, CLEARED): the provider's public-domain dump; the author it identifies died 1923 (life
+ 70 ended 1993); published 1926 (US: public domain since 2022). Recorded for the owner: the name on the 1926 title page
(Stern) has no known death year; the provider's attribution is the basis.

Raw file: `sources/ben-yehuda/raw/abbreviations.txt.gz` (sha256 `8a3af69c…`, fetched by
`scripts/dictionary/fetch-ben-yehuda.mjs`, which re-reads the licence and the catalogue row).

## Parser (`parseBenYehudaAbbreviations`)
Paragraphs "KEY reading, reading, … ." from the first א״א to the volunteers' notes; every reading kept, none ranked;
"־X" continues the reading before it (אחד בתורה, ־בנביאים → אחד בנביאים); bracketed notes and footnote digits dropped.
**13,847 abbreviations, 29,359 readings** (letter check: strict 27,054 · truncation 685 · skip 44 · rejected 1,411).

## Fusion and the context engine (scripts/dictionary/aramaic/abbreviations.mjs)
Short abbreviations have dozens of readings here (א״א ~70). A reading is published only per reader group (talmud /
kabbalah / rabbinic) and only when:
- the words around the abbreviation in that group's texts look like the words around the reading written out (cosine of
  the words before/after, function words left out: בחי׳ ~ בחינת 0.83; וע״ש ~ "וערב שבת" 0.03) — ≥ 0.25, and every other
  reading seen in the texts at most 0.6 of it (a proclitic reading, ו + a reading of the rest, below it);
- and two independent sources agree, or — one source only — the key is not a numeral, a place reference (בפכ״א), a
  proclitic on a single letter (דר׳ = ד + ר׳), or a word with gershayim (ישרא״ל, הו״א); a word cut off with a geresh
  needs a strong context (0.4) or a clear share of the words so beginning.
- A proclitic on a decided abbreviation (ואח״כ, לבנ״י, דמתני׳) is read when its prefixed reading occurs written out in
  that group and its contexts agree.
Withheld keys go to `docs/dictionary/review/abbreviations-withheld.tsv` with every reading, its sources, its written-out
count and its context score; the reviewer's withholdings are in `reviewedAramaic.mjs` (ABBREVIATIONS_WITHHELD).

## Results (same working tree, before → after)

| GROUP | ABBREVIATION TOKENS | RESOLVED BEFORE | AFTER |
|---|---:|---:|---:|
| Bavli | 66,603 | 49.8% | 62.9% |
| Yerushalmi | 2,433 | 6.0% | 26.8% |
| Minor tractates | 7,743 | 34.6% | 47.2% |
| Zohar | 34,459 | 22.2% | 35.5% |
| Tikkunei Zohar | 8,386 | 15.3% | 15.7% |
| Midrash | 83,724 | 23.6% | 39.9% |
| Liturgy | 3,553 | 24.1% | 31.2% |
| Mixed commentaries | 1,726,025 | 32.5% | 45.0% |
| Other (halacha, responsa, kabbalah, chassidut …) | 2,627,433 | 30.2% | 43.2% |
| **Total** | **4,560,423** | **31.1%** | **44.0%** (+586,912 tokens) |

Ben-Yehuda takes part in rows reading 579,024 tokens (kabbalah 198,787 · rabbinic 329,769 · talmud 50,468); alone:
337,619. Rows: 863 new keys (842 group decisions + 583 proclitic), 4,791 key/group pairs withheld, 68 existing keys the
open sources read otherwise (listed as CONFLICT_WITH_EXISTING for review; the existing rows are unchanged).

## Acceptance samples (the reviewer, 2026-09-30)
Four rounds; each found errors that became rules (numerals, place references, the letter-name list, proclitic shadows,
the context engine). The final round, on the shipped rules:
- 120 decisions drawn uniformly: 119–120 correct (one uncertain: עה״ג "עבודת הגרשוני").
- 100 decisions drawn by token weight: 98–99 correct — או״א read "אחד ואחד" in the Lurianic texts (אבא ואמא, spelled
  אבא ואימא there) was withheld by review; וב״ש "וברוך שמו" confirmed by its context (ב״ה וב״ש).
Accuracy of the layer: ≥ 98% (token-weighted), ≥ 99% (by row).
