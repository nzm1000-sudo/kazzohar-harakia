# Torah library — corpus gap report

Branch `feature/smart-prayer-engine`, audited 2026-09-29. Nothing was imported, removed or changed in app code by this audit.
**This report is not a legal clearance.** Licences are quoted **as the provider records them for that exact version**. Where the provider's record looks doubtful, the doubt is written next to it.

## How this was measured

- **Repository:** `src/data/library/{registry,packIndex,collectionIndex,collectionReports,legacyMetadata}.mjs`, `public/library/packs/*/manifest.json`, `scripts/library/{build-library,build-collection,collection-plan}.mjs`, `src/services/{talmud,sefaria,contentCache,bookCorpus}.mjs`, `src/services/library/{packs,integrity}.mjs`, `src/pages/{LibraryPage,TalmudPage,BooksPage}.jsx` and the built bundles `dist-native/` and `ios/App/App/public/`.
- **Sefaria licences:** `https://www.sefaria.org/api/texts/versions/<Title>` for 840 index titles, queried live on 2026-09-29. The titles came from `https://www.sefaria.org/api/index` (the Rashi, Ramban, Ibn Ezra, Sforno, Or HaChaim, Kli Yakar, Malbim, Radak, Ralbag, Metzudot, Abarbanel, Baal HaTurim, Bartenura, Tosafot Yom Tov, Bavli, Rashi/Tosafot/Rif/Rosh/Ran/Maharsha/Ramban/Rashba/Ritva/Meiri, Shulchan Arukh commentaries and Zohar categories).
- **Sizes and coverage:** every **Hebrew version with a known open or NC licence** of those titles was downloaded in full: 1,017 versions (445 MB of raw JSON). The source was Sefaria's full-version export, `https://www.sefaria.org/download/version/<Title> - he - <versionTitle>.json`. For each version the audit counted the non-empty segments, then measured the size of an app-style pack built from it. That pack is a JSON array of `{id, text}` with the HTML stripped, gzip level 6. This matches how `scripts/library/build-collection.mjs` writes `*.json.gz`.
  - The estimate was calibrated on packs that already exist. For Zohar Chadash it gives 745 KB against 733 KB actual; for Tikkunei Zohar, 490 KB against 478 KB actual. Expect about ±3%, plus about 5% for the `n` and node wrappers.
- **Wikisource:** checked through the MediaWiki API (`https://he.wikisource.org/w/api.php`) and raw page text. Every page footer reads *"הטקסט מוגש בכפוף לרישיון Creative Commons ייחוס-שיתוף זהה 4.0"* (CC BY-SA 4.0).
- **Not used, per the rules:** Otzaria metadata or scripts, Tashma, Mercava, Zayit fonts or any restricted asset. Sefaria versions recorded as `unknown` were measured only for comparison and are never proposed for redistribution.

---

## 1. What exists now

### 1.1 Packaged packs (`public/library/packs/`, shipped inside the iOS/Android bundle)

There are 30 packs, **102.8 MB** on disk (the apparent size in `ios/App/App/public/library` is the same).

Pack format:
- Each pack has `manifest.json` plus one file per work. The file is `*.json.gz` for collection packs. The older `build-library.mjs` packs use plain `*.json` (see §7.2).
- Chunk shape: `{workId, editionId, packId, nodes:[{id, n, units:[{id, n, text}]}]}`.

| Pack | Category | Licence (pack) | Works | Size |
|---|---|---|---|---|
| `uxlc-2.5` | tanakh | UXLC free use (tanach.us) | 39 | 6.35 MB (plain JSON) |
| `shnayim-mikra-sefaria-pd` | tanakh + Onkelos | Public Domain (tanach.us via Sefaria; Onkelos "Torat Emet") | 5 | 2.97 MB (plain JSON) |
| `sefaria-torat-emet-357-mishnah` | mishnah | Public Domain (Torat Emet 357) | 63 | 3.26 MB (plain JSON) |
| `sefaria-mishneh-torah-torat-emet-363` | rambam | Public Domain (Torat Emet 363) | 79 | 12.46 MB (plain JSON) |
| `sefaria-shulchan-arukh-pd` | halacha | Public Domain (TE 363 / TE 357 / Lemberg 1898) | 4 (OC, YD, CM PARTIAL) | 10.55 MB (plain JSON) |
| `sefaria-collection-halacha-public-domain` | halacha | Public Domain | 20 | 7.55 MB |
| `sefaria-collection-halacha-cc-by-sa` | halacha | CC-BY-SA | 2 (Maaseh Rav, Chafetz Chaim) | 0.15 MB |
| `sefaria-collection-halacha-cc-by-nc` | halacha | **CC-BY-NC** | 1 (Shulchan Arukh HaRav, Kehot) | 1.46 MB |
| `sefaria-collection-midrash-public-domain` | midrash | Public Domain | 17 | 4.45 MB |
| `sefaria-collection-midrash-cc-by` | midrash | CC-BY | 2 (Sifrei Devarim, Pesikta DeRav Kahana) | 0.34 MB |
| `sefaria-collection-midrash-cc-by-sa` | midrash | CC-BY-SA | 1 (Sifrei Bamidbar) | 0.12 MB |
| `sefaria-collection-midrash-cc-by-nc` | midrash | **CC-BY-NC** | 1 (Yalkut Shimoni on Torah, "Torat Emet") | 2.89 MB |
| `sefaria-collection-talmud-cc-by` | talmud | CC-BY | 38 (Yerushalmi, every tractate, Guggenheimer) | 2.45 MB |
| `sefaria-collection-talmud-public-domain` | talmud | Public Domain | 10 (minor tractates, ARN A+B) | 0.32 MB |
| `sefaria-collection-mitzvot-public-domain` | mitzvot | Public Domain | 5 | 1.99 MB |
| `sefaria-collection-machshava-public-domain` | machshava | Public Domain | 12 | 3.09 MB |
| `sefaria-collection-machshava-cc-by` | machshava | CC-BY | 2 | 0.50 MB |
| `sefaria-collection-machshava-cc-by-sa` | machshava | CC-BY-SA | 3 (Kuzari, Maamar HaIkarim, Milot HaHigayon) | 0.21 MB |
| `sefaria-collection-machshava-cc-by-nc` | machshava | **CC-BY-NC** | 2 (Tiferet Yisrael [Hartman], Parashat Derakhim [Jerusalem 2005]) | 0.70 MB |
| `sefaria-collection-mussar-public-domain` | mussar | Public Domain | 9 | 0.97 MB |
| `sefaria-collection-mussar-cc-by` | mussar | CC-BY | 1 (Kav HaYashar, Metsudah 2007) | 0.36 MB |
| `sefaria-collection-mussar-cc-by-sa` | mussar | CC-BY-SA | 1 (Iggeret HaRamban) | 0.003 MB |
| `sefaria-collection-mussar-cc-by-nc` | mussar | **CC-BY-NC** | 1 (Reshit Chokhmah, Hamesorah 2005) | 1.05 MB |
| `sefaria-collection-kabbalah-public-domain` | kabbalah | Public Domain | 18 | 4.55 MB |
| `sefaria-collection-kabbalah-cc-by-sa` | kabbalah | CC-BY-SA | 1 (Derech Etz Chayim) | 0.02 MB |
| `sefaria-collection-chassidut-public-domain` | chassidut | Public Domain | 28 | 15.97 MB |
| `sefaria-collection-chassidut-cc-by-nc` | chassidut | **CC-BY-NC** | 7 (Tanya, Likkutei Torah, Torah Ohr, Derekh Mitzvotekha — Kehot; Bat Ayin; Chayyim VaChesed; Ohr LaShamayim) | 4.01 MB |
| `sefaria-collection-responsa-public-domain` | responsa | Public Domain | 19 | 13.41 MB |
| `sefaria-collection-reference-public-domain` | reference | Public Domain | 4 | 0.60 MB |
| `sefaria-collection-tefillah-public-domain` | tefillah | Public Domain | 1 (Pesach Haggadah) | 0.02 MB |

**Registry totals** (`registryAudit()` in `src/data/library/registry.mjs`):
- 466 works in total, 455 of them public.
- Coverage: FULL 318, PARTIAL 103, REMOTE_ONLY 45.
- Primary categories:

  | Category | Works |
  |---|---|
  | tanakh | 39 |
  | mishnah | 63 |
  | talmud | 48 packed + 37 remote Bavli |
  | rambam | 79 |
  | halacha | 27 packed + 4 remote |
  | midrash | 21 |
  | mitzvot | 5 |
  | machshava | 19 |
  | mussar | 12 packed + 13 legacy |
  | kabbalah | 19 |
  | chassidut | 35 packed + 9 legacy |
  | responsa | 19 |
  | reference | 4 + 1 legacy |
  | tefillah | 1 |
  | **tanakh-commentary** | **0** |
  | **mishnah-commentary** | **0** |
  | **talmud-commentary** | **0** |

**Kabbalah as packaged:**
- Sefer Yetzirah, Sefer HaBahir.
- Tikkunei Zohar ("Tikkunei Zohar - Vocalized", Torat Emet, PD, PARTIAL).
- Zohar Chadash (Torat Emet, PD, FULL).
- Sha'arei Orah, Sha'arei Kedusha, Sha'ar HaHakdamot, Sha'ar HaGilgulim, Sha'ar HaMitzvot, Sha'ar Ruach HaKodesh, **Sha'ar Ma'amarei Rashbi (FULL, 368 KB)**, Sha'ar Ma'amarei Razal, Pri Etz Chaim.
- Ohr Ne'erav, Maggid Meisharim, Chesed LeAvraham, Shekel HaKodesh, Asarah Perakim, Derech Etz Chayim.
- **The main Zohar is absent.** Collection-plan skips include "Sha'ar HaPesukim" and others (`COLLECTION_REPORTS.skipped`).

### 1.2 Other bundled text outside the packs

| Item | Where | Size | Notes |
|---|---|---|---|
| Legacy "flat" books (`BOOK_CATALOG`) | `src/data/booksOffline.mjs` → `dist-native/assets/booksOffline-*.js` | **49.7 MB** | 31 entries. See §3 for the unknown and NC ones. |
| Yalkut Yosef (Kitzur SA, 2007 ed.) | `src/data/yalkutYosef.mjs` (in the JS bundle) | 14 MB | Torat Emet, CC BY-NC-SA 2.5 |
| Tanakh (UXLC) second copy | `src/data/tanakh.json` (6.0 MB), `torahText.mjs` (1.4 MB), `haftarotText.mjs` | ~7.5 MB | Same UXLC 2.5 text as `uxlc-2.5` |
| Tehillim | `src/data/tehillim.json` | 0.3 MB | "Tanach with Nikkud" via Sefaria, PD |

**The whole iOS web payload is 193.9 MB** (`ios/App/App/public`). It breaks down as:

| Part | Size |
|---|---|
| Packs | 102.8 MB |
| `booksOffline` chunk | 49.7 MB |
| Main `index-*.js` (includes Yalkut Yosef and the siddurim) | 29.7 MB |
| Remaining siddur chunks | ~8 MB |

### 1.3 Remote-only (fetched at runtime from Sefaria)

- **Talmud Bavli, 37 tractates** (`src/services/talmud.mjs`, `BASE = 'https://www.sefaria.org/api'`). `loadAmud(tractate, amud)` fetches three things:
  - `/texts/<Tractate> <amud>`: the default version, which is William Davidson Vocalized Aramaic, **CC-BY-NC**.
  - `/texts/Steinsaltz on <Tractate> <amud>`: **CC-BY-NC**.
  - `/links/<ref>`: every `category === 'Commentary'` link, grouped by anchor segment.

  `loadCommentary(ref)` then fetches each commentary text on demand (Rashi, Tosafot, and so on). `pinTalmudDaf()` stores a daf plus all its commentaries in localStorage (`contentCache.mjs`, limits `{talmud:5, commentary:60}`).
  - `talmudCatalog.mjs` records the base version licence as `unknown` for **Menachot** and **Chullin**. Those are `Bavli_Menachot` and `Bavli_Chullin` in `registryAudit().unknownLicenses`.
- **Halacha works** from `src/data/halachaLibrary.mjs`, fetched remotely:
  - Beit Yosef OC (PD).
  - Kaf HaChayim OC (PD).
  - Peninei Halakhah (**CC-BY-NC**).
  - Yalkut Yosef (local copy, CC BY-NC-SA 2.5).
  - SA ×4 and Ben Ish Hai: superseded by packs and hidden.

---

## 2. Commentary coverage, translations and duplicates

### 2.1 Commentaries

| Layer | Packaged | Remote at runtime | Absent |
|---|---|---|---|
| Tanakh commentary | none (`tanakh-commentary` is empty). The only Tanakh-adjacent content is Onkelos in `shnayim-mikra-sefaria-pd` and legacy *Tzafnat Pa'neach* (unknown licence, hidden). | none: the Tanakh reader (`LibraryReader` in `src/pages/LibraryPage.jsx`) shows the UXLC text only | Rashi, Ramban, Ibn Ezra, Sforno, Or HaChaim, Kli Yakar, Malbim, Radak, Ralbag, Metzudot, Abarbanel, Baal HaTurim |
| Mishnah commentary | none (`mishnah-commentary` is empty). The Mishnah reader is the same `LibraryReader` over `sefaria-torat-emet-357-mishnah`, text only. | none | Bartenura, Tosafot Yom Tov, Ikar TYT, Tiferet Yisrael, etc. |
| Talmud commentary | none (`talmud-commentary` is empty) | **Everything Sefaria links as `Commentary` on the amud** (Rashi, Tosafot, Rif, Rosh, Maharsha, Ritva, …), fetched per ref. Steinsaltz is excluded from the tabs and shown separately (`COMMENTARY_EXCLUDED` in `talmud.mjs`). | No local layer at all. Offline only works for up to 5 pinned dapim. |
| Zohar commentaries | Sha'ar Ma'amarei Rashbi only | none | Yahel Ohr, Ketem Paz, Mikdash Melekh, Or HaChamah, Nefesh David, Or Yakar |
| Halachic commentaries | Tur (PD, PARTIAL), Kitzur SA, Chayyei Adam, Ben Ish Hai, … | Kaf HaChayim OC, Beit Yosef (remote) | Mishnah Berurah (skipped: best Sefaria edition covers 74.1%), Magen Avraham, Taz, Shach, Be'er Heitev, Arukh HaShulchan |

### 2.2 Translations present

- **Targum Onkelos** ("Onkelos (Torat Emet)", PD): parallel to the Torah in the Shnayim Mikra pack.
- **Steinsaltz Hebrew on the Bavli:** remote only, CC-BY-NC.
- **Medieval Hebrew translations of Judeo-Arabic works:**
  - Guide for the Perplexed (Ibn Tibbon, PD).
  - Kuzari ("Sefer haKuzari - Project Ben-Yehuda", CC-BY-SA).
  - Duties of the Heart (legacy, "Vocalized Edition", PD).
  - Emunot veDeot was *skipped* (96% coverage).
- **No translation of the Zohar** is present in any form.

### 2.3 The same work in several copies

| Work | Copies |
|---|---|
| Tanakh (UXLC 2.5) | `uxlc-2.5` pack; `src/data/tanakh.json`; `torahText.mjs` + `haftarotText.mjs` (generated from tanakh.json); `shnayim-mikra-sefaria-pd` (tanach.us via Sefaria, with cantillation); `tehillim.json` (tanach.us via Sefaria); legacy `booksOffline["Tanakh"]` ("Miqra according to the Masorah", **CC-BY-SA**, 134 KB fragment) |
| Mishnah (Torat Emet 357) | `sefaria-torat-emet-357-mishnah` pack **and** `booksOffline["Mishnah"]` (1.7 MB, same edition; UI dedup covered by `tests/booksDedupMishnah.test.mjs`) |
| Shulchan Arukh ×4, Ben Ish Hai | pack + hidden remote entry (`supersededBy`) |
| Tikkunei Zohar | Sefaria also carries "Constantinople, 1740" (**CC-BY-NC**, Margalya); the app uses the PD Torat Emet vocalized edition. Good. |
| Kitzur Shulchan Arukh | the pack's Torat Emet 357 edition, and a separate Yalkut Yosef *Kitzur SA* (a different work) |

---

## 3. Licence flags (stated neutrally; nothing was removed)

`scripts/library/build-collection.mjs` states: *"non-commercial (CC-BY-NC / -SA) only where no free edition carries the work — approved by the user (2026-09-27) for this non-commercial app"*. The tests enforce this design:
- `tests/libraryCollection.test.mjs:28` accepts `cc-by-nc` and `cc-by-nc-sa`.
- `tests/contentCache.test.mjs:23` asserts `canCacheContent({license:'CC-BY-NC'}) === true`.

**If the App Store build is ever paid, carries ads or in-app purchases, or is published by a commercial entity, every item below needs permission or removal from the store build. If the app stays free and non-commercial, NC terms may be satisfiable; that is for a rights reviewer to decide.**

### 3.1 CC-BY-NC / CC BY-NC-SA content packaged or bundled

| Item | Licence as recorded | Size | Where |
|---|---|---|---|
| Tanya, Likkutei Torah, Torah Ohr, Derekh Mitzvotekha (Kehot Publication Society) | CC-BY-NC | 2.99 MB | `sefaria-collection-chassidut-cc-by-nc` |
| Bat Ayin (Jerusalem 2001), Chayyim VaChesed (Hamesorah c.2005), Ohr LaShamayim (Jerusalem 2013) | CC-BY-NC | 1.02 MB | same pack |
| Shulchan Arukh HaRav (Kehot) | CC-BY-NC | 1.46 MB | `sefaria-collection-halacha-cc-by-nc` |
| Reshit Chokhmah (Hamesorah 2005) | CC-BY-NC | 1.05 MB | `sefaria-collection-mussar-cc-by-nc` |
| Yalkut Shimoni on Torah ("Torat Emet") | CC-BY-NC | 2.89 MB | `sefaria-collection-midrash-cc-by-nc` |
| Tiferet Yisrael (Maharal, Hartman annotations), Parashat Derakhim (Jerusalem 2005) | CC-BY-NC | 0.70 MB | `sefaria-collection-machshava-cc-by-nc` |
| Ben Porat Yosef (Eichen ed., Jerusalem 2011) | CC-BY-NC | 0.6 MB | `booksOffline.mjs` (legacy, public) |
| Yalkut Yosef, Kitzur SA (2007 ed.) | CC BY-NC-SA 2.5 (Torat Emet) | 14 MB | `src/data/yalkutYosef.mjs` |
| Talmud Bavli base (William Davidson) + Steinsaltz | CC-BY-NC | remote | cached/pinned offline by `contentCache.mjs`. Note: the regex `/(cc0\|cc-by\|public domain…)/` in `canCacheContent` also matches `cc-by-nc` (by design, per the test). |
| Peninei Halakhah | CC-BY-NC | remote | `halachaLibrary.mjs` |

The packaged NC total is **12 works, about 10.1 MB**, plus Yalkut Yosef (14 MB) and Ben Porat Yosef.

### 3.2 `unknown` licence

**Hidden from the Library listing (`public:false`), but the text is still shipped in the bundle.** It sits in `booksOffline.mjs` (loaded by `loadBookCorpus()`), and `getText()` in `src/services/sefaria.mjs:115` serves it for any matching ref:

| Work | Stored version |
|---|---|
| Tzafnat Pa'neach on Torah | Jerusalem 1960 |
| Likkutei Etzot | rabenubook.com |
| Chiddushei HaRim on Torah | no version recorded |
| Yesod HaTeshuvah | "Machzor Rosh Hashanah, Sefaria ed." |
| Otzar La'azei Rashi | Jerusalem 1988 |
| Seder HaDorot | Warsaw 1878–82, recorded `unknown` |

**Remote:** the Bavli base version for Menachot and Chullin (`talmudCatalog.mjs`).

### 3.3 "Public Domain" as recorded, but worth a second look before a commercial release

- **Modern editorial work recorded PD:**
  - The Maharal volumes "with footnotes and annotations by Rabbi Yehoshua D. Hartman": Gevurot Hashem, Netivot Olam, Netzach Yisrael, Be'er HaGolah, Ner Mitzvah. They are recorded PD, while Tiferet Yisrael from the same series is CC-BY-NC.
  - Arvei Nachal (Jerusalem 1991).
  - Agra DeKala (Brooklyn 1993, legacy).
- **Sefaria versions whose `versionSource` is he.wikisource.org but which are recorded "Public Domain":**
  - Packed: Eight Chapters, Iggeret HaGra, Ben Ish Hai (partly), Shem HaGedolim (Wikisource edition).
  - Proposed below: Malbim (several books), Ibn Ezra on Lamentations and Ecclesiastes, Biur Halacha, Yahel Ohr, Beur HaGra on Sifra DeTzniuta.
  - Wikisource's own terms for transcriptions are **CC BY-SA 4.0**. The conservative course is to attribute Wikisource and honour share-alike for these.
- **"Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929–1934"** (the proposed Rashi on Torah edition) is recorded PD. Volumes published 1930–34 are not yet US public domain by age alone. The fallback "On Your Way" (PD) covers all five books.
- **Chiddushei HaRashba, "Gerlitz edition, published by Oraita"** (18 of 19 Rashba titles) is recorded PD, but it is a modern critical edition. Treat it as **verify before redistribution** (see §6).
- **CC-BY-SA packs** carry share-alike obligations. These are Sifrei Bamidbar, Maaseh Rav, Chafetz Chaim, Kuzari, Maamar HaIkarim, Milot HaHigayon, Iggeret HaRamban and Derech Etz Chayim, plus legacy Orchot Tzadikim, Ohr HaTzafun and Miqra al pi ha-Masorah. They already appear in `docs/content-licenses.md` for the Birnbaum siddur; the same App Store ↔ CC BY-SA compatibility question applies to them.

---

## 4. Missing high-value works (owner priority)

| Priority | Work | Status in app | Best open source found |
|---|---|---|---|
| (a) | **Zohar** (Aramaic, vol/daf/amud, parasha) | absent | he.wikisource "ספר הזהר", Mantua 1558 pagination — CC BY-SA 4.0 |
| (a) | **Zohar Hebrew translation** | absent | he.wikisource `ביאור:זוהר מתורגם` — partial (~10%), CC BY-SA 4.0 |
| (a) | Yahel Ohr (Gra) | absent | Sefaria "Vilna 1882" — `PD` |
| (a) | Or Yakar (Ramak) | absent | **no open edition** (not on Sefaria; Wikisource has only a stub page) |
| (a) | Sha'ar Ma'amarei Rashbi | **present** (PD, FULL) | — |
| (a) | Ketem Paz | absent | Sefaria "Livorno, 1795" — Public Domain |
| (a) | Mikdash Melekh | absent | Sefaria "Zholkva, 1864" — Public Domain (two indexes) |
| (a) | Or HaChamah | absent | Sefaria "Ohr Hachama, Peremyshl, 1896-1898" — Public Domain |
| (a) | Nefesh David (Radal) | absent | Sefaria version `unknown` → use he.wikisource "נפש דוד (רד"ל)" (Vilna 1882 appendix), CC BY-SA 4.0 |
| (b) | Rashi, Ramban, Ibn Ezra, Sforno, Or HaChaim, Kli Yakar, Malbim | absent | Sefaria PD editions (details in §5.2; Ramban Exodus has no open edition) |
| (b) | Radak, Ralbag, Metzudot, Abarbanel, Baal HaTurim | absent | Ralbag and Metzudot open; Radak on Nach and Abarbanel on Nach are `unknown`; Baal HaTurim open only on Wikisource |
| (c) | Bartenura, Tosafot Yom Tov | absent | Sefaria PD ("On Your Way"; "Mishnah, ed. Romm, Vilna 1913") |
| (d) | Talmud Rashi, Tosafot, Rif | remote only | Sefaria "Vilna Edition" — Public Domain |
| (d) | Rosh, Maharsha, Ran, Ramban, Rashba, Ritva, Meiri | remote only | Vilna / old prints PD. Rashba needs verification; Meiri is `unknown`. |
| (e) | Mishnah Berurah, Magen Avraham, Taz, Shach, Be'er Heitev, Kaf HaChaim, Aruch HaShulchan | absent (Kaf HaChaim OC remote) | PD prints on Sefaria; Mishnah Berurah complete on Wikisource |

---

## 5. Proposed imports — exact editions, licences, coverage and size

The following apply to every row in this section:
- **Licence** is as recorded by the provider for that version.
- **Units** are non-empty segments counted in the downloaded version.
- **Size** is the estimated pack `*.json.gz` (raw JSON in brackets).
- **Choice rule:** Public Domain > CC0 > CC-BY > CC-BY-SA. NC is never proposed where an open edition exists; `unknown` is never proposed. Where a PD edition covered less than 90% of the largest open version, the larger one was chosen.
- **Sefaria version URL pattern:** `https://www.sefaria.org/api/texts/versions/<Title>`.
- **Full export pattern:** `https://www.sefaria.org/download/version/<Title> - he - <versionTitle>.json`.

### 5.1 (a) Zohar

**Zohar — Aramaic source**

- Source: **he.wikisource.org**.
  - Index page: https://he.wikisource.org/wiki/ספר_הזהר
  - Daf pages: https://he.wikisource.org/wiki/זהר_חלק_א_ב_א
  - Parasha pages: https://he.wikisource.org/wiki/זוהר_חלק_א
- Licence: CC BY-SA 4.0, from the page footer. The underlying text is the Mantua 1558 print (public domain). The Wikisource page states that Mantua pagination is the basis of its daf numbering.
- Coverage:
  - **1,633 amud pages** (vol I 501 / vol II 535 / vol III 597 non-redirect pages `זהר חלק X <daf> <amud>`). Each transcludes a `<קטע התחלה=דף X Y/>` section of the 30 parasha pages `זוהר חלק א…ל`, which contain 1,641 section markers.
  - Plus `זוהר השמטות` (omissions). Tikkunei Zohar and Zohar Chadash are already packed.
  - Unvocalized (`קטגוריה:זהר ללא ניקוד`).
  - Contains editorial variant notes `{{הערה|נ"א …}}` (CC BY-SA). Strip them or keep them attributed.
- Size: wikitext 8.81 MB; plain text 8.13 MB; **≈2.05 MB gz**.
- Recommendation: **bundle**.
- Do **not** use Sefaria's "Zohar": all three of its Hebrew versions are `unknown` (§6).

**Zohar — Hebrew translation (partial)**

- Source: **he.wikisource.org** `ביאור:זוהר מתורגם`: https://he.wikisource.org/wiki/ביאור:זוהר_מתורגם
- Licence: CC BY-SA 4.0.
- Coverage:
  - 138 non-redirect pages: the Hakdama (one page, 289 KB) plus vol I 15a–83a, page by page.
  - About **165 of 1,633 amudim, ≈10%**. Each page transcludes the Aramaic and adds `==תרגום לעברית==`.
- Caution: this is a **volunteer translation, not a transcription of a print**. Check before import that it was not copied from a protected translation (Sulam, Matok MiDvash, etc.).
- Size: 1.05 MB wikitext; **≈0.25 MB gz**.
- Recommendation: **bundle**, labelled PARTIAL, as `relationType: translation`.
- Sefaria also has an English "Sefaria Community Translation" (CC0) and "The Zohar; London, Soncino Press, 1933" (English, PD, partial). Neither is Hebrew; they are noted only.

**Zohar commentaries** (all on Sefaria, `base_text_titles: ["Zohar"]`, structured Volume/Daf/Paragraph, so they align with the Mantua pagination):

| Work | Index / versionTitle | Licence | Units | Size gz (raw) | Recommend |
|---|---|---|---|---|---|
| Yahel Ohr (Gra) | `Yahel Ohr on Zohar` / "Vilna 1882" (source: he.wikisource `יהל_אור`) | `PD` (conservatively CC BY-SA, since the source is Wikisource) | 5,761 | 0.55 MB (2.20) | bundle |
| Nefesh David (Radal) | he.wikisource `נפש_דוד_(רד"ל)` (9 pages, Vilna 1882 appendix to Yahel Ohr). The Sefaria version is `unknown` and not used. | CC BY-SA 4.0 | ~0.42 MB wikitext | ≈0.1 MB | bundle |
| Beur HaGra on Sifra DeTzniuta | `Beur HaGra on Sifra DeTzniuta` / "Wikisource" | Public Domain (source Wikisource) | 297 | 0.16 MB (0.64) | bundle |
| Ketem Paz | `Ketem Paz on Zohar` / "Livorno, 1795" | Public Domain | 2,101 | 1.31 MB (4.88) | download |
| Mikdash Melekh | `Mikdash Melekh on Zohar` / "Zholkva, 1864" | Public Domain | 9,639 | 1.16 MB (4.61) | download |
| Mikdash Melekh, RaMaZ commentary | `Mikdash Melekh, RaMaZ Commentary on Zohar` / "Zholkva, 1864" | Public Domain | 3,209 | 0.90 MB (3.32) | download |
| Or HaChamah | `Ohr HaChammah on Zohar` / "Ohr Hachama, Peremyshl, 1896-1898" | Public Domain | 19,757 | 4.53 MB (17.45) | download |
| Sha'ar Ma'amarei Rashbi | already packed | PD | — | 0.37 MB | present |
| Or Yakar (Ramak) | not on Sefaria; he.wikisource `אור יקר (רמ"ק)` is a stub | — | — | — | PERMISSION_REQUIRED (§6) |

### 5.2 (b) Tanakh commentaries

| Work | Chosen edition(s) (Sefaria versionTitle) | Licence | Coverage | Units | Size gz (raw) |
|---|---|---|---|---|---|
| **Rashi** | Torah: "Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934" (4) + "…corrected vocalization" (1). Fallback "On Your Way" (PD). Nach: "On Your Way" (25) + "Sefaria vocalized edition" (7, the PD-recorded ones) + "On Your Way -- new" (2). | Public Domain ×39 | 39/39 books | 28,188 | **1.72 MB** (6.83); Torah 0.67 MB |
| **Ramban** | Genesis "On Your Way"; Leviticus "On Your Way New"; Numbers "Vocalized Edition"; Deuteronomy "On Your Way new" | Public Domain | **4/5 Torah books.** Exodus has only `unknown` versions; Job is CC-BY-NC only (Mossad Harav Kook 1963). | 1,648 | 0.73 MB (2.92) |
| **Ibn Ezra** | Torah: "Piotrkow, 1907-1911" (Gen, Ex) + "Prague, 1840" (HaKatzar Ex) + "On Your Way" (Lev–Deut). Nach: Daat / Friedlander 1877 / Wikisource / Kol Sason 1840 / London 1850. | Public Domain ×31 | 31/31 indexes (Torah, 12 Nach, 12 Ketuvim) | 20,842 | 1.20 MB (4.80) |
| **Sforno** | "Vocalized Edition" (Gen, Ex) + "On Your Way" (Lev–Deut) + "Chamesh Megillot, Warsaw 1875" (Song of Songs) | Public Domain | 6/6 | 4,215 | 0.37 MB (1.58) |
| **Or HaChaim** | "Vocalized Edition" (Torah ×5) + "Jerusalem, 1915" (9 Nach/Ketuvim titles) | Public Domain | 14/14 | 5,990 | 1.69 MB (7.83); Torah 1.58 MB |
| **Kli Yakar** | "Vocalized Edition" ×5 | Public Domain | 5/5 | 2,158 | 1.08 MB (4.99) |
| **Malbim** | "Mikraei Kodesh, Vilna, 1891" / "Malbim on … -- Wikisource" / "On Your Way" / "Malbim, Vilna Romm, 1892" | Public Domain (several sourced from Wikisource, see §3.3) | **50/54.** Missing (`unknown` only): Malbim on I Samuel, Malbim on Isaiah, Ayelet HaShachar, Beur HaMilot on Psalms. | 24,268 | 5.20 MB (19.72); Torah 2.58 MB |
| **Radak** | Genesis "Presburg : A. Schmid, 1842"; Psalms "Derekh Mesilah, Furth 1843" or "The Psalms with Qimchi's Longer Commentary, Leipzig, 1883" | Public Domain | **2/25.** All 21 Nach titles are "Radak on Nach" = `unknown`; Chronicles is CC-BY-NC only (Berger 2003/2007). he.wikisource has only fragments (311 pages / 0.7 MB, mostly Psalms). | 5,425 | 0.42 MB (1.65) |
| **Ralbag** | "On Your Way" (12) + "Perush al Hamesh Megillot, Konigsberg, 1860" (4) + "Ralbag on Torah, Venice, 1547" | Public Domain | 17/17 | 7,423 | 1.35 MB (5.51) |
| **Metzudat David / Metzudat Zion** | "On Your Way" ×31 each | Public Domain | 31/31 + 31/31 | 28,829 + 17,995 | 1.33 + 0.46 MB |
| **Abarbanel** | Torah: "Torah Commentary of Yitzchak Abarbanel, Warsaw 1862" | Public Domain | **Torah only.** All 21 Nach titles are "Abarbanel, Tel Aviv 1960" = `unknown`. he.wikisource `אברבנאל על …` has the Torah (~10 MB wikitext) and only fragments of Nach. | 3,512 | 2.53 MB (10.02) |
| **Baal HaTurim** | he.wikisource `בעל הטורים על התורה/<ספר>/<פרק>`: 186 chapter pages (Bereshit 49, Shemot 40, Vayikra 27, Bamidbar 36, Devarim 34), ~0.70 MB wikitext. Sefaria's only open version ("Wikisource Mikraot Gedolot", CC-BY-SA) holds just 6 segments; the others are `unknown`. | CC BY-SA 4.0 | ~186/187 chapters | — | ≈0.2 MB |
| (Kitzur Baal HaTurim) | `Kitzur Ba'al HaTurim on Genesis…` / "On Your Way" | Public Domain | 5 books | not measured | small |

### 5.3 (c) Mishnah commentaries

| Work | Chosen edition | Licence | Coverage | Units | Size gz (raw) |
|---|---|---|---|---|---|
| **Bartenura** | "On Your Way" (62) + "ToratEmet" (1, Nezikin) | Public Domain | 63/63 (62 tractates + Avot) | 21,204 | **1.40 MB** (5.97) |
| **Tosafot Yom Tov** (full) | "Mishnah, ed. Romm, Vilna 1913" | Public Domain | 64/64 (63 + intro index) | 15,585 | **2.65 MB** (10.43) |
| Ikar Tosafot Yom Tov (abridged, alternative) | "On Your Way" | Public Domain | 63/63 | 12,078 | 0.89 MB (3.57) |

The "Torat-Emet" versions of Bartenura and Ikar TYT are recorded **CC-BY-NC**; do not use them.

### 5.4 (d) Talmud (canonical local layer + commentaries)

| Work | Chosen edition | Licence | Coverage (of 37 Bavli tractates) | Units | Size gz (raw) |
|---|---|---|---|---|---|
| **Bavli base text (open alternative to William Davidson)** | "Wikisource Talmud Bavli" (source https://he.wikisource.org/wiki/תלמוד_בבלי) | **CC-BY-SA** | 37/37. **The same segmentation as "William Davidson Edition - Aramaic"** (81,793 segments each), so existing anchors and `/links` refs line up. | 81,793 | **4.19 MB** (19.54) |
| **Rashi** | "Vilna Edition" (35) + Sanhedrin "Vilna Edition" (the only version, recorded CC-BY-SA, source Wikisource) | Public Domain ×35, CC-BY-SA ×1 | 36/37 (no Tamid index) | 115,700 | **5.90 MB** (25.36) |
| **Tosafot** | "Vilna Edition" | Public Domain ×35, CC-BY-SA ×1 (Sanhedrin) | 36/37 (no Tamid) | 25,168 | **5.38 MB** (22.26) |
| **Rif** | "Vilna Edition" | Public Domain | all 25 Sefaria Rif titles (the Rif's own scope, incl. Halakhot Ketanot) | 10,061 | **1.14 MB** (4.91) |
| Rosh | "Vilna Edition" | Public Domain | 27 tractates | 5,505 | 2.39 MB (9.84) |
| Ran on Rif + Ran on Nedarim | "Vilna Edition" | Public Domain | 14 + 1 | 13,811 + 1,977 | 2.06 + 0.25 MB |
| Maharsha — Chidushei Halachot / Agadot | "Vilna Edition" | Public Domain | 31/31 and 36/37 (Agadot on Rosh Hashanah is `unknown`) | 13,045 + 7,157 | 1.90 + 1.48 MB |
| Chiddushei HaRamban | "Chiddushei HaRamban, Jerusalem 1928-29" | Public Domain | 26/27 (Hilkhot HaRamban on Nedarim is `unknown`) | 3,964 | 2.22 MB (8.91) |
| Ritva | Old prints (Amsterdam 1729, Munkatch 1908, Warsaw 1864, Konigsberg 1858, Berlin 1860, Lvov 1861, Livorno 1792) | Public Domain | 17/18 (Ritva on Nedarim is `unknown`) | 11,397 | 3.53 MB (14.51) |
| Rashba | "Gerlitz edition, published by Oraita" (18) + "Warsaw, 1861" (1) | Public Domain *as recorded*, but a modern critical edition (see §3.3) | 19 | 11,047 | 4.60 MB (19.58) — **verify first; remote until then** |
| Meiri (Beit HaBechirah) | Sefaria: "Meiri on Shas" = `unknown` (28), "Wikisource" = `unknown`; only Eruvin "Warsaw 1914" is PD | — | 1/30 open | — | **PERMISSION_REQUIRED / remote.** he.wikisource `מאירי על הש"ס` is marked `{{בעבודה}}`, covers only Berakhot, Eruvin, Shevuot, Makkot, Avot and a few Mishnah chapters, and its print source is not stated. |

### 5.5 (e) Halachic commentaries

| Work | Chosen edition | Licence | Coverage | Units | Size gz (raw) |
|---|---|---|---|---|---|
| **Mishnah Berurah** | **he.wikisource** `משנה_ברורה_על_אורח_חיים_<סימן>`: 697/697 simanim, 7.15 MB wikitext | CC BY-SA 4.0 | FULL | 697 simanim | ≈1.7 MB (est.) |
| (alternative) | Sefaria `Mishnah Berurah` / "On Your Way" | Public Domain | PARTIAL, 74.1% of the structure (`COLLECTION_REPORTS.skipped`) | 12,912 | 1.24 MB |
| **Biur Halacha** | Sefaria "Biur Halacha" (source Wikisource) = Public Domain as recorded; or directly he.wikisource `ביאור_הלכה_על_אורח_חיים_<סימן>` (526 pages, 4.2 MB wikitext) | PD as recorded / CC BY-SA 4.0 | — | 3,468 | 1.01 MB |
| **Magen Avraham** | `Magen Avraham` / "Magen Avraham" (NLI 001722045) | Public Domain | OC | 6,433 | 0.83 MB (3.17) |
| **Taz** | "Maginei Eretz: Shulchan Aruch Orach Chaim, Lemberg, 1893"; "Ashlei Ravrevei … Yoreh Deah, Lemberg, 1888"; "Apei Ravrevei … Even HaEzer, Lemberg, 1886"; "Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898" | Public Domain | 4/4 parts | 9,591 | 2.96 MB (OC 0.97, YD 0.94, EH 0.56, CM 0.50) |
| **Shach** | "Ashlei Ravrevei … Yoreh Deah, Lemberg, 1888" + "Shulhan Arukh, Hoshen ha-Mishpat; Lemberg, 1898" | Public Domain | YD + CM | 12,217 | 2.65 MB (YD 1.00, CM 1.65) |
| **Be'er Heitev** | "Torat Emet 357" | Public Domain | 4/4 parts | 18,691 | 2.17 MB (OC 0.54, YD 0.57, EH 0.26, CM 0.79) |
| **Kaf HaChaim (R. Y. Ch. Sofer)** | OC: "Kaf Hachayim, Orach Chayim vol. I-IV, Jerusalem 1910-1933" **+** "…vol. V-VIII…" (the two versions split the work; both are needed). YD: "Kaf Hachayim, Yoreh Deah, Jerusalem 1936-1957". | Public Domain | OC complete (two versions), YD | 12,490 + 17,405 + 8,648 | OC 4.62 MB + YD 1.28 MB |
| **Aruch HaShulchan** | OC: "Arukh HaShulchan, Orach Chayim -- Wikisource" (**CC-BY-SA**, 8,119). YD + EH: "Aruch HaShulchan, Vilna 1923-29" (PD, 4,940 + 4,102). CM: "Aruch HaShulchan, Choshen Mishpat. Vilna 1923-29" (PD, 5,566). | PD / CC-BY-SA (OC) | 4/4 parts | 22,727 | ≈7.3 MB (OC 2.60, YD+EH 2.81, CM 1.89) |

---

## 6. PERMISSION_REQUIRED queue (never import)

| Work | Why |
|---|---|
| Zohar, Sefaria versions "Vocalized Zohar, Israel 2013", "Sulam Edition, Jerusalem 1945", "Hebrew Translation" (`versionTitleInHebrew` "זוהר בתרגום עברי", source toratemetfreeware.com; the Hebrew translation the owner refers to as R. David Sarig's) | all recorded `unknown` |
| Sulam on Zohar ("Zohar with Sulam commentary, Jerusalem 1945") | `unknown` (and a 20th-century work) |
| Idra Zuta, Sefaria: "Zohar Menukad", "Zohar Sulam Aramaic Text", "Hebrew translation according to the Sulam" | `unknown` |
| Or Yakar (Ramak) | only modern editions from manuscript (20th century); no open edition found |
| Nefesh David, Sefaria version | `unknown`. The open Wikisource transcription is proposed instead (§5.1). |
| Meiri / Beit HaBechirah (Sefaria "Meiri on Shas", Wikisource version) | `unknown`. Wikisource provenance is unstated; the modern critical editions are protected. |
| Chiddushei HaRashba, "Gerlitz edition, published by Oraita" | recorded PD but a modern critical edition. **Verify** with Sefaria or the publisher. |
| Radak on Nach ("Radak on Nach"), Radak on Chronicles (Berger, CC-BY-NC) | `unknown` / NC |
| Abarbanel on Nach ("Abarbanel, Tel Aviv 1960") | `unknown` |
| Ramban on Exodus (all versions), Ramban on Job (Mossad Harav Kook, CC-BY-NC) | `unknown` / NC |
| Malbim on I Samuel, Malbim on Isaiah, Ayelet HaShachar, Beur HaMilot on Psalms | `unknown` |
| Hilkhot HaRamban on Nedarim, Ritva on Nedarim ("Vilna, 1884"), Chidushei Agadot on Rosh Hashanah ("Vilna Edition - new") | `unknown` |
| Summary of Taz / Summary of Shakh on YD | no Hebrew version listed |
| Talmud Bavli William Davidson + Steinsaltz Hebrew | CC-BY-NC (remote today; see §3.1) |
| Tikkunei Zohar "Constantinople, 1740" (Margalya) | CC-BY-NC (not needed; the PD edition is packed) |
| Yabia Omer, Yechaveh Daat, Chazon Ovadia, Halichot Olam, Yalkut Yosef (current editions) | modern protected works (already in `ACQUISITION_QUEUE`) |
| Birkei Yosef, Chaim Sheal, Yosef Ometz, Moed LeKol Chai, Kaf HaChaim (Palagi), Rav Pealim (as a separate import) | `NOT_FOUND` in `ACQUISITION_QUEUE`, unchanged |

---

## 7. Package size and offline

### 7.1 Current state

- **iOS web payload: 193.9 MB.** Packs are 102.8 MB; `booksOffline` JS is 49.7 MB; the main JS is 29.7 MB, including Yalkut Yosef (14 MB).
- **Downloading packs does not work on native today.**
  - `packsBundledWithApp()` in `src/services/library/packs.mjs` returns true on Capacitor, and `downloadState()` then always reports `current`.
  - The code comment explains why: *"iOS serves from capacitor://, which Cache Storage rejects"*.
  - So a pack is either **in the binary** or **remote only**. An "optional on-device download" tier needs new native storage, for example the Capacitor Filesystem API writing into the app's Documents directory, read by `loadEditionChunk()` before its `fetch(packUrl)`.
- **Decompression needs `DecompressionStream`.** `packBytesToText()` depends on it for `.gz` packs (iOS Safari/WKWebView 16.4+).

### 7.2 Space that can be freed without dropping content

The five `build-library.mjs` packs are shipped as **plain JSON**. Gzipping them, which `packBytesToText()` already supports, saves about **28 MB**:

| Pack | Plain | Gzipped |
|---|---|---|
| `uxlc-2.5` | 6.35 MB | 1.54 MB |
| `sefaria-torat-emet-357-mishnah` | 3.25 MB | 0.64 MB |
| `sefaria-shulchan-arukh-pd` | 10.55 MB | 2.11 MB |
| `sefaria-mishneh-torah-torat-emet-363` | 12.45 MB | 2.28 MB |
| `shnayim-mikra-sefaria-pd` | 2.97 MB | 0.65 MB |

**The checksum is computed over the decompressed text**, so the manifests stay valid. The duplicate UXLC copy in `src/data/tanakh.json` and friends (~7.5 MB) and the duplicate Mishnah in `booksOffline` (1.7 MB) are further candidates.

### 7.3 What each proposal adds, and where it should live

| Group | gz size | Recommendation |
|---|---|---|
| Zohar Aramaic (Wikisource) + Hebrew translation (partial) | 2.3 MB | **Bundle** |
| Yahel Ohr + Nefesh David + Beur HaGra on SdT | 0.8 MB | **Bundle** |
| Ketem Paz, Mikdash Melekh ×2, Or HaChamah | 7.9 MB | Download (remote-only until native download exists) |
| Rashi on Tanakh | 1.7 MB | **Bundle** |
| Ramban (4 books), Ibn Ezra, Sforno, Or HaChaim, Kli Yakar | 5.1 MB | **Bundle** |
| Malbim, Ralbag, Metzudot, Abarbanel (Torah), Radak (partial), Baal HaTurim (Wikisource) | 11.5 MB | Download (Metzudot 1.8 MB is a reasonable bundle candidate for Nach readers) |
| Bartenura + Tosafot Yom Tov | 4.05 MB | **Bundle** (or Bartenura + Ikar TYT = 2.3 MB) |
| Bavli base (Wikisource) + Rashi + Tosafot + Rif | 16.6 MB | **Bundle as the canonical local layer**, paid for by §7.2. If the owner prefers a smaller binary: download per seder (Moed ≈ 5 MB, Nezikin ≈ 4 MB). |
| Rosh, Ran, Maharsha ×2, Chiddushei Ramban, Ritva | 13.8 MB | Download / remote |
| Rashba (after verification) | 4.6 MB | Remote until verified |
| Mishnah Berurah + Biur Halacha | ≈2.7 MB | **Bundle** |
| Be'er Heitev OC, Kaf HaChaim OC | 5.2 MB | **Bundle** (Sephardic OC focus of the halacha module) |
| Magen Avraham, Taz ×4, Shach ×2, Be'er Heitev YD/EH/CM, Kaf HaChaim YD, Aruch HaShulchan ×4 | ≈16.5 MB | Download / remote |

Totals:
- **Recommended bundle additions: ≈39 MB.** After the ≈28 MB gzip saving, the net growth of the binary is **≈11 MB**.
- **Download tier: ≈54 MB.**
- **All proposals together: ≈93 MB gz.**

Until native download exists, the download tier keeps working exactly as today through Sefaria remote fetches, marked `REMOTE_ONLY`.

---

## 8. Implementation order and content model

### 8.1 Order (owner priority)

1. **Zohar source + open Hebrew translation.**
   - Build a Wikisource importer. It should:
     - read `זוהר חלק א…ל` raw wikitext;
     - cut at `<קטע התחלה=דף X Y/>`;
     - map parasha headings to amud ranges using `{{דפי הזהר לפרשה|vol|daf|amud|daf|amud}}` on `זהר חלק א/ב/ג`;
     - pin revision ids (the way `sources/birnbaum-ashkenaz/provenance.json` does).
   - Import the translation pages `ביאור:זוהר מתורגם/חלק א/<daf> <amud>` as a PARTIAL `translation` of the same nodes.
   - Then add Yahel Ohr, Nefesh David and Beur HaGra (bundle), and Ketem Paz, Mikdash Melekh and Or HaChamah (download tier). Their Volume/Daf/Paragraph structure maps straight onto the Zohar nodes.
2. **Tanakh major commentaries:** Rashi, Ramban (4 books; Exodus stays PERMISSION_REQUIRED), Ibn Ezra, Sforno, Or HaChaim, Kli Yakar, Malbim (50/54). Then Ralbag, Metzudot, Abarbanel (Torah), Baal HaTurim (Wikisource), Radak (Genesis, Psalms).
3. **Mishnah Bartenura + Tosafot Yom Tov**, anchored to `sefaria-torat-emet-357-mishnah` units.
4. **Talmud canonical local layer:** Bavli base (Wikisource CC-BY-SA) + Rashi + Tosafot + Rif. `loadAmud()` should then prefer local chunks and fall back to Sefaria, keeping Steinsaltz remote.
5. **Halachic commentaries:** Mishnah Berurah + Biur Halacha (Wikisource), Kaf HaChaim OC, Be'er Heitev, then Magen Avraham, Taz, Shach, Aruch HaShulchan.
6. **Others:** Rosh, Ran, Maharsha, Chiddushei Ramban, Ritva; Rashba after verification.

### 8.2 Facts an implementer needs about the current format

- **Unit ids:** `integrity.mjs` requires `^[A-Z][A-Za-z_]*(?:\.\d+)+$`. Ids are **numeric only**, so a Talmud amud such as `2a` must become an integer node. `amudToIndex()` in `talmud.mjs` gives `2a→2, 2b→3`; a Zohar `vol/daf/amud` gets a running node number, and the printed label goes in `nodeTitles`.
- **Unit text** may not contain `<` or `>`. `cleanText()` in `build-collection.mjs` strips tags and turns stray brackets into ‹ ›.
- **Structure:** packs are two levels (`nodes → units`). `leavesOf()` already splits depth-3 works (the Yerushalmi) into one part per chapter. Depth >3 throws.
  - A Talmud commentary is depth 3 (Daf/Line/Comment). The natural mapping is node = amud, unit = comment, plus an **anchor** to the base line (see 8.3).
  - Zohar: node = amud (1,633), unit = paragraph. `work.sections` (`[{title, from, to}]`, already used by `LibraryReader`) holds the parashiyot, and `nodeTitles` holds `חלק א · דף ב ע״א`.
- **Manifest and index fields:**
  - Per work: `workId, title, heTitle, group, editionTitle, versionSource, license, nodeLabel, unitLabel, nodeTitles, sections, status, missingUnits, file, bytes, rawBytes, checksum, nodes, expected`.
  - Pack-level: `packId, category, license, source, sourceUrl, retrievedAt, structure, policy, edition{…}`.
  - Packs are split **by licence** (`sefaria-collection-<category>-<licence>`). Keep that convention: for example `wikisource-zohar-cc-by-sa`, `sefaria-tanakh-commentary-public-domain`, `sefaria-talmud-commentary-public-domain`, `wikisource-talmud-cc-by-sa`.
- **Readers:**
  - Tanakh, Mishnah and every pack: `LibraryReader` in `src/pages/LibraryPage.jsx`, via `loadEditionChunk(edition)` (`src/services/library/packs.mjs`; checksum-verified, gz-aware).
  - Talmud: `TalmudPage.jsx` with `loadAmud` / `loadCommentary` / `pinTalmudDaf` in `src/services/talmud.mjs`. Commentary tabs group by `commentatorName(link)` per anchor segment.
  - To keep the remote reader lined up with a local Wikisource base, request `/texts/<ref>?vhe=Wikisource Talmud Bavli`. It has the same segmentation.
- **Registry:**
  - `src/data/library/registry.mjs` builds `WORKS` from `PACK_INDEX` + `COLLECTION_INDEX` + legacy + remote. `TAXONOMY` already has `tanakh-commentary`, `mishnah-commentary` and `talmud-commentary`. `ACQUISITION_QUEUE` already uses `PERMISSION_REQUIRED` / `AVAILABLE_OPEN` / `NOT_FOUND`.
  - `COVERAGE` in `src/services/library/integrity.mjs` has FULL / PARTIAL / METADATA_ONLY / REMOTE_ONLY / SCAN_ONLY / UNAVAILABLE. Add `PERMISSION_REQUIRED` and `BLOCKED`.
  - `licenseIdFor()` maps provider strings. Note that Sefaria also returns `"PD"` (Yahel Ohr), which it already handles.
- **Builders:**
  - `scripts/library/build-collection.mjs` picks editions from `/api/texts/versions`, fetches text through `/api/v3/texts/<ref>?version=hebrew|<versionTitle>&return_format=text_only`, and validates against `/api/shape`.
  - `scripts/library/build-library.mjs` builds the older packs.
  - A commentary builder can reuse `cleanText`, `validateWorkChunk` and `checksum`. Get anchors from `/api/links/<commentary ref>` or from the commentary ref itself (`Rashi on Berakhot 2a:3:1` → base `Berakhot 2a:3`).

### 8.3 Proposed relationship model (fits the existing manifest)

Add a `relation` block per work entry (manifest `works[]` / `COLLECTION_INDEX`):

```json
{
  "workId": "Rashi_on_Berakhot",
  "heTitle": "רש״י על ברכות",
  "editionTitle": "Vilna Edition",
  "versionSource": "https://www.nli.org.il/he/books/NNL_ALEPH001300957",
  "license": "public-domain",
  "relation": {
    "relationType": "commentary",
    "baseWorkId": "Bavli_Berakhot",
    "anchorScheme": "sefaria-ref",
    "anchorsFile": "Rashi_on_Berakhot.anchors.json.gz"
  },
  "coverage": { "expectedUnits": 0, "importedUnits": 0, "missingUnits": [], "coveragePercent": 100, "coverageStatus": "FULL" }
}
```

`relationType` values:
- `commentary`
- `supercommentary` (for example Siftei Chakhamim → Rashi; Ran → Rif)
- `translation` (Zohar Hebrew; Onkelos)
- `parallel` (Yerushalmi ↔ Bavli)
- `quotation`
- `halachic-descendant` (Tur → Beit Yosef → Shulchan Arukh → Mishnah Berurah)

The link records live in an anchors file per commentary, one per unit, so the reader never has to load the whole commentary to decide which tabs to show:

```json
{ "workId": "Rashi_on_Berakhot", "editionId": "sefaria-talmud-commentary-public-domain:Rashi_on_Berakhot",
  "relationType": "commentary", "baseWorkId": "Bavli_Berakhot",
  "unitId": "Rashi_on_Berakhot.2.7", "anchorRef": "Bavli_Berakhot.2.3", "canonicalRef": "Rashi on Berakhot 2a:3:1",
  "source": "sefaria", "license": "public-domain" }
```

For the Zohar:
- `anchorRef` is the running amud node (`Zohar.3.<paragraph>`).
- `canonicalRef` keeps both schemes: `"Zohar 1:2a"` (Mantua) and the Sefaria ref (`"Zohar, Introduction 1:1"`). Sefaria's `Daf` alt-struct in `https://www.sefaria.org/api/v2/raw/index/Zohar` maps one to the other; it is index metadata, not text.

**Coverage metadata:**
- `expectedUnits` comes from `/api/shape/<Title>` or Wikisource page counts.
- `importedUnits` comes from `validateWorkChunk()`.
- `missingUnits` lists unit ids.
- `coveragePercent` = imported / expected.
- `coverageStatus`:
  - `FULL` (proven by `validateWorkChunk`)
  - `PARTIAL` (published with the gaps listed, ≥97% as `build-collection` requires; lower only with an explicit "partial" label, as for the Zohar translation at ~10%)
  - `REMOTE_ONLY`
  - `PERMISSION_REQUIRED`
  - `BLOCKED` (for example a licence recorded PD that looks doubtful, until verified)

---

## 9. Implementation status — first content pack (Zohar), 2026-09-29

- **Built:** `wikisource-zohar-cc-by-sa` (3.01 MB gz) — the Zohar, 1,632 Mantua amudim (1,630 with text; III 116a–b are
  title pages), 17,660 paragraphs, PARTIAL only because the transcription marks 22 pages with `{{להשלים}}`; Yahel Ohr
  (5,761 of 5,763 segments), Beur HaGra on Sifra DeTzniuta (297/297), Nefesh David (1,189 paragraphs, all 7 Wikisource
  pages). Every commentary unit is anchored to its Zohar page (`docs/library/content-model.md`).
- **Remote only:** Ketem Paz, Mikdash Melekh, Mikdash Melekh RaMaZ, Or HaChamah — live from Sefaria in the named PD
  edition, offered in the reader's מפרשים tab on the pages they reach.
- **Not shipped:** the Wikisource Hebrew translation (BLOCKED: the translator states parts follow the Sulam). The reader
  says "טרם קיים תרגום פתוח לקטע זה" on every page.
- **§7.2 done:** the five older packs are gzip-compressed (35.56 MB → 7.03 MB, −28.5 MB), verified byte-for-byte through
  the real loader; a JavaScript inflater covers WebViews without `DecompressionStream`. `public/library`: 102.8 MB →
  77.3 MB including the new pack.
- **Next:** זוהר השמטות and the Vilna supplement page as their own section; on-device download for the remote tier;
  Tanakh commentaries (§8.1 step 2) on the same relation/anchor model.

### 9.2 Second content stage — Tanakh and Mishnah commentaries, 2026-09-29

Built by `scripts/library/build-commentary.mjs` on the same relation/anchor/coverage model (`content-model.md`). Every
edition is one exact Sefaria version per book; its licence was re-read live from `/api/texts/versions/<Title>` at build
time and recorded in `sources/sefaria-commentaries/provenance.json`. Coverage counts every comment position in Sefaria's
`/api/shape` of the work; nothing missing was filled from another edition.

| Commentator | Books | Comments (present / expected) | Status | Notes |
|---|---|---|---|---|
| רש״י | 39 / 39 | 28,163 / 28,252 (99.7%) | PARTIAL | Torah: "On Your Way" — **not** Rosenbaum–Silbermann (recorded PD, but the 1930–34 volumes are not US PD by age; see §3.3). Ecclesiastes lacks 40 comments in the open edition. |
| רמב״ן | 4 / 6 | 1,648 / 1,648 (100%) | PARTIAL | **Exodus** has only `unknown` versions; **Job** is CC-BY-NC only (Mossad Harav Kook 1963). Both stay out. |
| אבן עזרא | 31 / 31 | 20,842 / 21,020 (99.2%) | PARTIAL | Habakkuk: the only open version has 4 of 140 comments. Lamentations and Ecclesiastes are Wikisource-sourced → shipped CC BY-SA 4.0 with attribution. |
| ספורנו | 6 / 6 | 4,215 / 4,215 | FULL | |
| אור החיים (+ ראשון לציון) | 14 / 14 | 5,990 / 6,005 (99.8%) | PARTIAL | The Genesis introduction (14 places in Sefaria's shape) is empty in the open edition. |
| כלי יקר | 5 / 5 | 2,158 / 2,158 | FULL | |
| ברטנורא | 63 / 63 | 21,204 / 21,212 | PARTIAL | "On Your Way" (62) + "ToratEmet" (Avot, recorded PD). Bikkurim ch. 4 (19 comments) is kept but unanchored: the Mishnah edition in the library has 3 chapters. |
| תוספות יום טוב | 64 / 64 | 15,585 / 15,586 | PARTIAL | "Mishnah, ed. Romm, Vilna 1913" throughout, with the introduction as its own book. |

- **Packs** (gzip, checksum per file, one file per book or tractate plus its anchors file):
  `sefaria-tanakh-commentary-public-domain` 7.21 MB (6.68 MB text + 0.53 MB anchors, 97 books),
  `sefaria-tanakh-commentary-cc-by-sa` 0.06 MB (2 books), `sefaria-mishnah-commentary-public-domain` 4.40 MB
  (4.14 MB text + 0.26 MB anchors, 127 books). `public/library`: 77.27 MB → 89.01 MB (+11.75 MB). The generated
  indexes (`src/data/library/corpus/{tanakh,mishnah}Commentary.mjs`) add 0.56 MB of JS source to the registry.
- **Anchors:** every comment on a verse or mishnah carries `anchorRef` (`Genesis.1.1`), `canonicalRef`
  (`Rashi on Genesis 1:1:1`) and `baseCanonicalRef` (`Genesis 1:1`); introductions and chapters absent from the base
  edition are kept as readable, unanchored units and counted.
- **Remote only** (download tier, live from Sefaria in one PD edition, not sourced from Wikisource): Malbim 14 books,
  Ralbag 21, Metzudat David 31, Metzudat Zion 31, Abarbanel on the Torah 5, Radak on Genesis and Psalms.
- **Reader:** Tanakh `מקרא | מפרשים`, Mishnah `משנה | מפרשים`; each commentator's block is grouped by verse, the opening
  words in bold, with a source/licence line; a verse in the address narrows the block to that verse.
- **Not done, and why:**
  - `מקורות` (Tanakh) and `מקבילות` (Mishnah → Gemara / Mishneh Torah) tabs: Sefaria publishes no licence for its link
    data, so there is no open, verifiable link source yet. The reader supports the tabs; they appear only when such a
    layer exists.
  - Wikisource-sourced Malbim (most of Nach, and Genesis/Leviticus in full) and Baal HaTurim: need a bundled, attributed
    Wikisource import (`wikisource.mjs`), not a remote Sefaria layer.
  - Radak on Nach and Abarbanel on Nach: no open version (`unknown`), unchanged in §6.
- **Next:** Talmud canonical local layer (§8.1 step 4) on the same builder pattern (`sefaria-ref` anchors to the amud
  line); Baal HaTurim and the Wikisource Malbim through the Wikisource importer; on-device download for the remote tier.

### 9.3 Third content stage — the Talmud's canonical local layer, 2026-09-29

Built by `scripts/library/build-talmud.mjs` (content model: `content-model.md` § The Talmud). Every edition is one exact
Sefaria version per tractate; its licence was re-read live from `/api/texts/versions/<Title>` at build time and recorded
in `sources/sefaria-talmud/provenance.json`. Nothing missing was filled from another edition.

| Layer | Tractates | Units (present / expected) | Status | Notes |
|---|---|---|---|---|
| Gemara — "Wikisource Talmud Bavli" | 37 / 37 | 81,793 / 81,793 segments | FULL | CC BY-SA 4.0 with attribution. Grid equal to Sefaria's shape and the app catalog, amud by amud. |
| רש״י — "Vilna Edition" | 36 / 37 | 115,700 / 115,729 comments | PARTIAL | No Tamid index in Sefaria. Rosh Hashanah: "WikiSource Rashi" (the Vilna version has no recorded licence). Bava Batra: 55 of 350 amudim (Rashi ends at 29a; the Rashbam continues, live). 7 tractates Wikisource-sourced → CC BY-SA. |
| תוספות — "Vilna Edition" | 36 / 37 | 25,168 / 25,258 | PARTIAL | No Tamid. Thin by amudim: Sanhedrin (174/224, none 90a–113b), Horayot (14/25), Keritot (34/54), Sotah (82/96), Nedarim (161/180). 6 tractates CC BY-SA. |
| רי״ף — "Vilna Edition" | 25 / 25 titles | 10,061 / 10,061 | FULL | On the Rif's own pages, a book per tractate (incl. Halakhot Ketanot); not anchored to the Gemara (no licensed link data). |
| Remote only | Rosh 27, Ran 15 (14 on the Rif + Nedarim), Maharsha 67 (Chidushei Halachot 30 + an alternate Yevamot, Chidushei Agadot 36), Chiddushei HaRamban 26, Ritva 17 | counted from each edition | REMOTE_ONLY | One registered PD edition each; the reader fetches it with `vhe=` and refuses any other. |

- **Packs:** `wikisource-talmud-cc-by-sa` 4.24 MB, `sefaria-talmud-commentary-public-domain` 11.76 MB (anchors 0.43 MB),
  `sefaria-talmud-commentary-cc-by-sa` 1.44 MB (anchors 0.06 MB); one file per tractate and per commentary, largest
  file 0.42 MB (Rashi on Shabbat). `public/library`: 89.19 MB → 106.64 MB (+17.45 MB). The generated index
  (`src/data/library/corpus/talmud.mjs`) adds 0.67 MB of JS source (95 KB gzip) to the registry.
- **Reader:** the Talmud reader reads the Gemara, Rashi and Tosafot from the device; Steinsaltz and the other linked
  commentaries are added live (same segmentation). Offline an amud opens with a notice. Default text: the Wikisource
  transcription; the William Davidson vocalized text is a live-only choice. Pinning saves only the live layers.
- **Not done, and why:** the Rashbam on Bava Batra (PD, would complete the Rashi column) is not bundled — outside this
  stage's scope, reachable live; the Rashba stays BLOCKED (Gerlitz is a modern critical edition) and the Meiri
  PERMISSION_REQUIRED — neither is registered, though the reader keeps listing Sefaria's live links as before; the Rif,
  the Rosh and the Ran on the Rif are not placed on the Gemara's amud (Sefaria's link data has no published licence).


### 9.4 Fourth content stage — the Shulchan Arukh's nosei kelim, 2026-09-29

Built by `scripts/library/build-shulchan-arukh-commentary.mjs` (content model: `content-model.md` § The Shulchan Arukh).
Sefaria licences were re-read live from `/api/texts/versions/<Title>` at build time; Wikisource's from its siteinfo
(CC BY-SA 4.0); every Wikisource page is pinned by oldid in `sources/shulchan-arukh-commentaries/provenance.json`.
Nothing missing was filled from another edition.

| Layer | Edition | Licence | Comments (present / expected) | Seif-anchored | Status |
|---|---|---|---|---|---|
| משנה ברורה | he.wikisource, 697 pages (https://he.wikisource.org/wiki/משנה_ברורה) | CC BY-SA 4.0 | 17,362 / 17,435 (99.6%) | 17,278 | PARTIAL — siman 36 is marked incomplete on the site (67 s"k); 6 single gaps. 37 comments where the page's seif and the Lemberg markers disagree claim no seif (99.8% agree) |
| ביאור הלכה | he.wikisource, 526 pages | CC BY-SA 4.0 | 3,463 / 3,484 (99.4%) | 3,446 | PARTIAL — siman 36 (משנת סופרים) is kept as its own part |
| באר היטב (או״ח) | Sefaria "Torat Emet 357" | Public Domain | 5,485 / 5,485 | 5,468 | FULL (5 simanim whose markers do not match stay on the siman) |
| כף החיים (או״ח) | Sefaria "Kaf Hachayim, Orach Chayim vol. I-IV" + "vol. V-VIII, Jerusalem 1910-1933" — one edition (one NLI record), halves 1–318 / 319–697, no overlap | Public Domain | 29,267 / 29,398 (99.6%) | 29,267 | PARTIAL — siman 32 and a few others are thin in the digitization |
| Remote | Magen Avraham; Taz ×4; Shach YD, CM; Be'er Heitev YD, EH, CM; Kaf HaChaim YD; Aruch HaShulchan ×4 (OC Wikisource CC-BY-SA; YD/EH/CM Vilna 1923-29 PD) | PD / CC-BY-SA (AH OC) | 15 layers, 71,589 comments counted from each edition | 44,957 by printed markers | REMOTE_ONLY |

- **Also:** 17 introductions of the Mishnah Berurah to a siman (הקדמה לסימן רנ״ג…) and משנת סופרים are their own parts,
  shown beside their siman; the site editors’ notes (6 sections, 6 footnotes) are not imported.
- **Packs:** `wikisource-shulchan-arukh-commentary-cc-by-sa` 2.82 MB (9 range files + anchors), `sefaria-shulchan-arukh-
  commentary-public-domain` 5.28 MB (17 range files + anchors + remote seif maps 23 KB); every file gzip with its checksum,
  largest 0.34 MB. `public/library`: 106.64 MB → 114.75 MB (+8.11 MB). Generated index
  `src/data/library/corpus/shulchanArukhCommentary.mjs`: 0.32 MB JS (89 KB gzip).
- **Library:** the four works are books under הלכה › שולחן ערוך ונושאי כליו, after the Shulchan Arukh. Kaf HaChaim OC is
  listed once (the local book; the former remote entry is kept, not listed). No אחרונים or תפילה shelf.
- **Reader:** the Shulchan Arukh opens with `מקור | מפרשים` where any layer reaches the siman; under each seif, a line
  names the commentaries on it and opens them on that seif.
- **Halacha Engine:** its Shulchan Arukh / Mishnah Berurah references (`halachaQuestions` sources) now open the local book
  at the seif when it exists; עונג שבת's 57 Shulchan Arukh links already did, and now reach the commentaries too.
- **Not done, and why:** Sha'ar HaTziyun (not on Wikisource); the Mishnah Berurah's general introductions; Taz on CM has
  no printed markers in the Lemberg 1898 edition, so it is grouped by siman only; Aruch HaShulchan keeps its own seifim
  (anchored by siman); on-device download of the remote tier (native storage) is still the open item from §7.1. Other
  Halacha-area links (chat answers, SourceDepth, the halacha/b book browser) still open Sefaria.


### 9.5 Fifth content stage — the Beit Yosef (four parts), halacha typography and numbering, titled contents, 2026-09-30

Built by `scripts/library/build-beit-yosef.mjs` and `scripts/library/build-halacha-topics.mjs`. Sefaria licences were
re-read live from `/api/texts/versions/Beit Yosef` at build time. Nothing missing was filled from another edition.

| Part | Edition (Sefaria versionTitle) | Licence | Units (present / expected) | Status |
|---|---|---|---|---|
| הקדמה | "Tur Orach Chaim, Vilna, 1923" (the author's introduction) | Public Domain | 16 / 16 | FULL |
| אורח חיים | "Tur Orach Chaim, Vilna, 1923" | Public Domain | 5,996 / 6,044 | PARTIAL — simanim 34 and 486 empty in the digitization; 45 empty segments |
| יורה דעה | "Tur Yoreh Deah, Vilna, 1923" | Public Domain | 5,852 / 5,885 | PARTIAL — siman 169 empty |
| אבן העזר | "Tur Even HaEzer, Vilna, 1923" | Public Domain | 2,858 / 2,858 | FULL |
| חושן משפט | "Tur Choshen Mishpat: Vilna, 1923" | Public Domain | 3,717 / 3,718 (by the Tur's seifim) | PARTIAL — siman 411 empty |

- **One print:** all four versions name the same NLI record (NNL_ALEPH001935970) as the Tur already in the library; the
  build refuses anything else. Not used: "בית יוסף, אורח חיים, נה, יג" (CC-BY-SA, one segment from Wikisource), "hi"
  (licence unknown), the English and French translations.
- **Pack:** `sefaria-beit-yosef-public-domain`, 26 files split by siman range inside each part, 7.26 MB gzip (31.4 MB
  raw), largest file 0.33 MB, every file checksummed. Bundled (the owner wants the halacha offline; 7 MB is in line with
  §7.2). `public/library`: +7.26 MB. The built-in search index grows from 22.06 MB to 23.79 MB (18,439 more places).
- **Relation:** a commentary layer of the Tur, anchored by siman (the same simanim in every part, checked per part);
  Choshen Mishpat units carry the seif of the Tur they explain. The Tur's reader shows `מקור | מפרשים`.
- **בדק הבית:** the author's additions, printed in smaller type (`<small>(ב"ה) …</small>`, 1,160 of them), are kept as
  ranges on the unit and shown at the same reading size in a quieter ink.
- **The Tur:** already complete in its four parts (Sefaria "<part>, Vilna, 1923", Public Domain): 5,965 / 6,090 units,
  PARTIAL — the Orach Chayim introduction (8 units) is not in the digitization; the other 117 are seifim the digitization
  lacks, listed in `missingUnits`. The "Warsaw 1861" version is thinner in every part; nothing was mixed in.
- **Reading size:** the source reader classified halacha paragraphs with the siddur's roles (an unanchored "(עיין",
  "(שו"ע", "(ברכות" anywhere in a seif, or a closing "סימן"/"ז"ל", made it a "source" line at 0.62 em; "יש אומרים",
  "אם שכח" an instruction at 0.68 em). Halacha texts are now one continuous text (`readingParagraphs`, hebrewText.mjs);
  the siddur is unchanged. The packs themselves carry no size markup (tags are stripped at import).
- **Titled contents** (Sefaria index `alt_structs.Topic` of each book): Kitzur Shulchan Arukh — the name of each of its
  221 simanim ("סימן קל״ט · הלכות חנכה", the bracketed numeral checked); groups of simanim for the Shulchan Arukh ×4
  (29/61/8/36), the Tur and the Beit Yosef (134 each), Biur Halacha (29), Chayei Adam (15), Ben Ish Hai (98 parashot),
  Shibbolei HaLeket (24), Sefer HaTerumah (14); Mishnah Berurah, Be'er Heitev and Kaf HaChaim on Orach Chayim follow the
  Shulchan Arukh's groups (they have no structure of their own at the provider). Mateh Efrayim, Shulchan Arukh HaRav,
  Keset HaSofer, Baalei HaNefesh and Chafetz Chaim have none at the provider and keep numbered contents.
- **Mishnah Berurah's commentaries:** none open. Sefaria has no Sha'ar HaTziyun (no index; the "Mishnah Berurah"
  category holds only Mishnah Berurah and Biur Halacha, and no index has Mishnah Berurah as its base text). he.wikisource
  has שער הציון for 7 of 697 simanim (א–ד, קכג, רב, רלג), without markers in the Mishnah Berurah pages to anchor its notes
  to a seif katan; not imported.
