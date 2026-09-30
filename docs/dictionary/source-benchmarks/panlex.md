# PanLex (CC0) — benchmark

- **Availability (2026-09-30):** api.panlex.org and db.panlex.org no longer resolve; panlex.org is a static site. The
  monthly database snapshots (2019-05 … 2024-10-01, ~1.27 GB CSV zip each) are in the archive.org item
  `panlex-database` (CC0) but every zip returns HTTP 403. vocab.panlex.org still lists the varieties.
- **Varieties:** Hebrew heb-000 (heb-001…003); Biblical Hebrew hbo-000…004; Aramaic arc-000 (arc-001…003: Achaemenid,
  Christian Palestinian, Imperial script); Jewish Babylonian Aramaic tmr-000/001; Jewish Palestinian Aramaic
  jpa-000/001; Old Aramaic oar-*; Samaritan sam-*; Syriac syc-*/syr-000; Mandaic myz-*. No Targumic variety.
- **Offline subset actually obtainable:** the ACoLi per-language export of the 2019-10 dump (CC0,
  acoli-repo/acoli-dicts): arc→heb 184 unique pairs (119 in Hebrew script, 63 in Syriac script, many place names:
  ܦܪܐܓ→פראג; a few words: ביתא→בית, מטרא→גשם, אלהא→אלוהים); tmr 1 pair and jpa 2 pairs (the languages' own names);
  sam and oar English only. Pair lineage cannot be traced (ACoLi's source ids do not match PanLex's).
- PanLex's source list (4,877) includes Dalman's JPA grammar (#3145, German/English), Tal's Samaritan dictionary (#141),
  Udvari (#542), Sabar (#250): none with Hebrew glosses, and none imported into the jpa/tmr data.

## Against the app's texts (the true lexical gaps, docs/dictionary/source-benchmarks/unresolved-classes.md)

| PROFILE | GAP TOKENS | PANLEX FORM MATCHES |
|---|---:|---:|
| Bavli | 31,680 | 5 |
| Yerushalmi | 15,589 | 0 |
| Midrash | 29,731 | 7 |
| Onkelos | 7,843 | 88 |
| Zohar | 62,518 | 46 |
| Biblical Aramaic | 678 | 3 |
| Liturgy | 3,753 | 8 |
| Mixed | 553,524 | 51 |

Correct-sample rate: not measurable in a meaningful way (208 matching tokens in all; most matches are common words the
engine already knows elsewhere). Projected token gain: < 0.01%. **Decision: not imported (registry `panlex`,
EVIDENCE_ONLY).**
