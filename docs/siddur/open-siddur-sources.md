# Open Siddur Project: candidate verification and completion sources

Research only. No text was imported. The machine-readable version of this list is
`docs/siddur/open-siddur-sources.json`: 33 records, each with a `usableAs` value and the reason for it.

**Checked:** 2026-09-28.

**How the pages were read.** opensiddur.org returns HTTP 403 (a Cloudflare challenge) to curl and WebFetch, as
`sources/opensiddur-chabad/README.md` already notes. Every Open Siddur page below was therefore read from its most
recent Wayback Machine copy (`id_` mode). Each table gives the page's own `article:modified_time`, so you can see how
old that copy is. Hebrew Wikisource transcription status was read live from each Index page (`מפתח:`), counting page
links by proofreading level.

**How licences are quoted.** Each licence is quoted from three places on the page: the `dc.license` metadata, the
byline ("Shared on: … under the … license") and the footer banner ("is shared through the Open Siddur Project with
a … license"). Where these disagree, the table says **conflicting**. The copyright basis stated in the page body
(non-renewal, age, §108 library copy, and so on) is quoted in the JSON `licenseEvidence` field. Nothing here is a legal
clearance (see `docs/content-licenses.md`).

**What `usableAs` means.**
- `import`: machine-readable Hebrew under a licence on the app allowlist (`CC0`, `Public Domain`, `CC-BY`,
  `CC-BY-SA`), in the right rite.
- `reference-only`: scans, the wrong minhag, or an unclear licence. Useful for checking text by eye.
- `not-usable`: in copyright, not the rite, or not found.

Open Siddur is mostly a scan archive. Almost every classic siddur there is page images on the Internet Archive,
tagged "Needing Transcription". The machine-readable texts that matter are elsewhere: some are linked Hebrew
Wikisource transcriptions, and the rest are a few born-digital uploads.

## Ashkenaz

The app's Ashkenaz edition (Sefaria "Siddur Ashkenaz", the Metsudah siddur) is Eastern (Polish/Lithuanian-American)
Ashkenaz. Several Open Siddur items are the Western (German) rite. That is marked below.

| Resource | Minhag | Compiler, year | Licence as stated | Text | Transcription status | usableAs |
|---|---|---|---|---|---|---|
| [HaSiddur HaShalem (Ashkenaz)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/hasiddur-hashalem-by-paltiel-birnbaum-1949/) | Not stated on the page. Wikisource says it is the Ashkenaz nusach of English-speaking countries | Paltiel Birnbaum, Hebrew Publishing Co., 1949 | CC0 1.0. PD by non-renewal | Scans only | "Needing Transcription" | reference-only |
| ↳ [Hebrew Wikisource transcription of the same book](https://he.wikisource.org/wiki/מפתח:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_(The_Daily_Prayer_Book,1949).pdf) | same | same | CC BY-SA 4.0 (Wikisource terms) | **Machine-readable** | Of 815 pages: 133 validated, 274 proofread, 408 "without text" (the English even pages, which are not edited there). **All Hebrew pages are proofread** | **import** |
| [Singer, Authorised Daily Prayer Book](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/authorised-daily-prayer-book-aka-the-singer-siddur/) | "Minhag Poland". Hebrew based on Baer | Simeon Singer, 1890 (scan: 9th ed. 1912) | CC0 1.0 | Hebrew: scans only. The TXT/HTML is the **English** Bloch 1915 text (no Hebrew letters) | English notes on en.wikisource: 47 validated, 17 proofread of 976 | reference-only |
| [Singer, 2nd revised ed.](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/the-authorised-daily-prayer-book-of-the-united-hebrew-congregations-of-the-british-commonwealth-of-nations-2nd-revised-edition-1962/) | British | Singer, Brodie, Hertz, 1962 | CC0 badge, but the body says "entirety … Public Domain in the year 2029" and that it is shared under §108(h) | Scans | none | not-usable |
| [Seder Tefilot Kol haShanah (Hertz)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-tefilot-kol-hashanah-by-joseph-herman-hertz-1942-1945/) | "Minhag Poland" | J. H. Hertz, 1942–45, 3 volumes | CC0 1.0 | Scans | none | reference-only |
| [Siddur Kol Bo](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-kol-bo-ashkenaz-compiled-by-the-hebrew-publishing-company-1906/) | Nusaḥ Ashkenaz (no minhag stated) | Hebrew Publishing Co., 1906 | CC0 1.0 | Scans (IA automatic OCR, not proofread) | "first complete imaging" | reference-only |
| [Seder Avodat Yisroel](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-avodat-yisroel-by-r-seligman-baer-1868/) | German (Rödelheim), critical text | I. S. Baer, 1868 (1901 ed.) | **Conflicting**: CC BY-SA 4.0 (byline and metadata) vs CC0 (footer) | Mostly scans | he.wikisource: 2 validated, 19 proofread, 81 not proofread, 810 not started, of 913 | reference-only |
| [Shabbat Shacharit from Seder Avodat Yisrael](https://opensiddur.org/compilations/liturgical/siddurim/shabbat-siddur/shabbat-shaharit-from-seder-avodat-yisrael-seligman-baer-1868/) | German (Frankfurt/Rödelheim) | Baer text, transcribed by Gabriel Wasserman, 2009 | **Conflicting**: CC BY-SA 4.0 vs CC0 | **Machine-readable** (HTML) | Full service, no proofreading status given | reference-only |
| [Tefiloh Sefas Yisroel (Siddur Bnei Ashkenaz)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-bnei-ashkenaz-a-german-rite-siddur-prepared-by-r-rallis-wiesenthal/) | **German rite**, minhag Bad Homburg | Rallis Wiesenthal, 2010 | CC BY-SA 4.0 on the page. A 2011 admin comment says CC BY-SA 3.0 Unported, with PD-derived content under CC0 | **Machine-readable**: 16 TXT/XHTML/ODT/PDF sections | Born-digital, complete | reference-only (wrong minhag for the app's Ashkenaz) |
| [Magil's linear siddur](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/magils-complete-linear-prayer-book-by-yosef-mogilnitski-second-improved-edition-1908/) | Ashkenaz | Joseph Magil, 1908 | CC0 1.0 | Scans | none | reference-only |
| [Siddur Tefilat Yeshurun (Glazer)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-tefilat-yeshurun-translated-by-simon-glazer-1934/) | Ashkenaz (Hebrew from Sefah Berurah 1928) | Simon Glazer, 1934 (Maimon Publ. Co. of **Asher Scharfstein**) | CC0 1.0 | Scans | none | reference-only |
| Tefilatenu (Scharfstein) | — | — | — | **Not found** on opensiddur.org, by site search or in the full Wayback URL index | — | not-usable |
| [Tefilot Yisrael (Filipowski)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/tefilot-yisrael-a-bilingual-hebrew-english-prayerbook-by-tsvi-hirsch-filipowsski-1862/) | Anglo-Ashkenaz | 1862/1872 | CC0 1.0 | Scans | "Needing Transcription/Proofreading" | reference-only |
| [Modlitewnik (Schorr)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/modlitewnik-na-wszystkie-dni-w-roku-a-bilingual-hebrew-polish-prayerbook-translated-and-arranged-by-mojzes-schorr-1936/) | "Minhag Poland" | Mojżesz Schorr, 1936 | CC0 1.0 | Scans | "Needing Transcription" | reference-only |
| [Séder haThephiloth, rite allemand](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-hathephiloth-ou-rituel-prieres-journalieres-a-lusage-des-israelites-durite-allemand-1869/) | German rite (France) | E. Durlacher, 1869 | CC0 1.0 | Scans | "Needing Transcription" | reference-only |
| [Ha-Siddur ha-Metsuyan](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/hasiddur-hametsuyan-a-bilingual-hebrew-english-prayerbook-compiled-and-translated-by-solomon-schonfeld-1973/) | British Ashkenaz | S. Schonfeld, 1973 | CC BY-SA 4.0 badge, but the body claims §108 (in copyright) | Scans | none | not-usable |

## Chassidic Sefard

| Resource | Minhag | Compiler, year | Licence as stated | Text | Transcription status | usableAs |
|---|---|---|---|---|---|---|
| [HaSiddur HaShalem, Ḥassidic-Sefardic edition](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/hasiddur-hashalem-hassidic-sefardic-by-paltiel-birnbaum-1969/) | Chassidic "Sfard". The page is titled "(Sephardic)" and tagged "Nusaḥ Sefaradi", but its description says Ḥassidic-Sefardic | Paltiel Birnbaum, Hebrew Publishing Co., 1969 | CC0 1.0. PD by non-registration | Scans only | "Needing Transcription". Wikisource only *plans* a Sefard version, to be derived from its Ashkenaz transcription | reference-only |
| [Siddur Tifereth David](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-tifereth-david-arranged-by-hayyim-alter-segal-1951/) | Nusaḥ Ha-Ari ("Sephardic-Ḥassidic"). Hebrew = Tiferet Yehudah (1912) Sfard | Ḥ. A. Segal, 1951 | CC0 1.0. PD by non-renewal | Scans | "Needing Transcription" | reference-only |
| [Siddur Ḳorban Minḥah](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-korban-minhah-1897/) | Nusaḥ Ha-Ari, Chassidic, with Yiddish | Vilna, 1897 | CC0 1.0 | Scans | none | reference-only |

Hebrew Wikisource warns that in the 1969 Birnbaum Sefard edition "some of the prayers remained in Nusach Ashkenaz".
Keep this in mind before using it to check Sefard wording.

## Chabad

| Resource | Minhag | Compiler, year | Licence as stated | Text | Transcription status | usableAs |
|---|---|---|---|---|---|---|
| [Siddur Torah Or / Nusaḥ Ha-Ari, new transcription (post 1260)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-torah-or-nusah-haari-zl/) | Chabad. The files say "consistent with … Siddur Tehillat Hashem"; the page names the 1940 Shulzinger Torah Ohr | Shmuel Gonzales, 2010–2015 (v3.0–3.82) | Page: CC BY 4.0. Files: transcription CC0, instructions CC BY | **Machine-readable** TXT/ODT/PDF | Transcriber's versions. The Chanukah file has no archived copy | **import: already imported** as "Siddur Tehillat Hashem" |
| [Siddur Torah Ohr (Shulzinger 1940)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-torah-ohr-according-to-the-text-of-r-schneur-zalman-of-liadi/) and [he.wikisource סידור תורה אור](https://he.wikisource.org/wiki/סידור_תורה_אור) | Chabad (Alter Rebbe) | anonymous editors, 1940 | Scan: PD book. Wikisource text CC BY-SA. The 2010 Open Siddur page has no licence metadata | Wikisource main-namespace text | Page-level Index: 29 proofread, 6 problematic, 65 not proofread, 446 not created, of 548 | **import: already in use** via Sefaria ("Wikisource") |
| [Tehillat Hashem Yedaber Pi](https://opensiddur.org/compilations/liturgical/siddurim/weekday-siddur/tehillat-hashem-yedaber-pi-by-zalman-schachter-shalomi-2009/) | Jewish Renewal, interpretive | Z. Schachter-Shalomi, 2009 | CC BY-SA 4.0 | TXT/ODT/PDF | born-digital | not-usable (not a Chabad text) |

## Edot HaMizrach

Open Siddur has no Edot HaMizrach siddur as such. What it has is other Sephardi rites: Oriental, Egyptian, Corfiote,
Ottoman/Ladino and Bene Israel.

| Resource | Minhag | Compiler, year | Licence as stated | Text | Transcription status | usableAs |
|---|---|---|---|---|---|---|
| [Seder Tefilat Yeshurun (Sefaradi)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-tefilat-yeshurun-translated-by-menahem-ben-mosheh-yehezqel-1935/) | "Sephardim in the Orient and elsewhere" | M.-G. Glenn, Hebrew Publishing Co., 1935 | CC0 1.0. PD by non-renewal | Scans | none | reference-only |
| [Siddur Farḥi](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/transcribing-arabic-translation-siddur-ca-1913/) | Minhag Egypt | Hillel Farḥi, 1913/1917 | **Conflicting**: CC BY-SA 4.0 (metadata) vs CC0 (footer) | Mostly scans | he.wikisource: 1 proofread, 4 problematic, 32 not proofread, 494 not started, of 531 | reference-only |
| [Seder Tefilot (Corfu)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-tefilot-kminhag-kk-sefaradim-meturgamot-yevanit-1885/) | Minhag Corfu | Yosef Naḥmuli, 1885 | CC0 1.0. Wikisource text CC BY-SA 4.0 | **Machine-readable** on he.wikisource | 1 validated, 213 proofread, 221 without text (presumably the Greek pages), of 436 | reference-only (not Edot HaMizrach) |
| [Seder Tefilat Kol Peh](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-tefilat-kol-peh-a-bilingual-hebrew-ladino-prayerbook-1891/) | Eastern Sefaradim, Ottoman | 1891 | **Conflicting**: CC0 (byline) vs CC BY-SA 4.0 (footer) | Scans | none | reference-only |
| [The Daily Prayers (Marathi)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/the-daily-prayers-translated-from-hebrew-in-marathi-by-joseph-ezekiel-rajpurkar-1889/) | Bene Israel, Eastern Sefaradim | J. E. Rajpurkar, 1889 | CC0 1.0 | Scans | he.wikisource: 1 proofread of 782 | reference-only |
| [Siddur Or uMasoret](https://opensiddur.org/compilations/liturgical/siddurim/weekday-siddur/siddur-or-umasoret-2023/) | Sefaradi, "traditional egalitarian" | A. Zagoria-Moffet, I. Montagu (Izzun), 2019/2023 | CC BY-SA 4.0 | PDF only | born-digital | reference-only |
| [Ritual de Oraciones (Edery)](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/ritual-de-oraciones-para-todo-el-ano-a-bilingual-hebrew-spanish-siddur-compiled-and-translated-by-mordechai-edery-1965/) | Unclear: title "(אשכנז)", tag "Sefaradi". Conservative | M. Edery, 1965 | CC BY-SA 4.0. PD basis is US-only (URAA) | Scans | none | not-usable |
| [Tefillat Matsliaḥ](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/sidur-tefillat-masliah-a-bilingual-hebrew-portuguese-prayerbook-compiled-and-translated-by-meir-matsliah-melamed/) | Sefaradi (Brazil) | M. M. Melamed, 1966 | CC BY-SA 4.0 badge, but "under copyright … until January 2060" | Scans | none | not-usable |
| [Tefilat Daniel](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/seder-hatefilot-tefilat-daniel-a-bilingual-hebrew-bulgarian-siddur-by-daniel-solomon-zion-1946/) | Bulgarian Sefaradi | D. S. Ẓion, 1946 | CC BY-SA 4.0 badge, but "under copyright … until 2053" (§108) | Scans | none | not-usable |
| [Maariv, ancient Persian rite](https://opensiddur.org/compilations/liturgical/siddurim/shabbat-siddur/maariv-for-the-sabbath-evening-according-to-the-ancient-persian-rite/) | Old Persian rite (reconstructed from MS) | I. Gantwerk Mayer, 2020 | CC BY-SA 4.0 | HTML | one service | not-usable (historic rite) |
| [Siddur Tefilot l'Ḥayyal](https://opensiddur.org/compilations/liturgical/siddurim/kol-bo/siddur-tefilot-lhayyal-by-shlomo-goren-idf-1963/) | IDF Nusach Achid | S. Goren, 1963 | PD claim (foreign government edict); CC0 footer | Scans | none | not-usable (unified rite) |

## Notes

1. **The one new import-grade source is the Hebrew Wikisource transcription of Birnbaum's HaSiddur HaShalem (1949,
   Ashkenaz).** Every Hebrew page is proofread or validated. Its section list includes texts that `notes-ashkenaz.md` lists as
   source gaps in the Metsudah pack: במה מדליקין and פרקי אבות. Whether its Shabbat Torah service has אב הרחמים and
   על הכל has not been checked page by page. It could
   also serve as a second witness for checking the whole Ashkenaz pack.
   - Take the text from the `עמוד:` (Page:) namespace only. The compiled `הסידור_השלם_(בירנבוים)/אשכנז` pages are an
     adapted edition: its instructions are translated into Hebrew, Eretz Yisrael customs are added, and the text
     has "textual improvements".
   - The licence is CC BY-SA 4.0, so attribution and share-alike are required. Record it in `manifest.mjs` the way
     Torah Or is recorded.
2. **Open Siddur has no machine-readable Chassidic Sefard or Edot HaMizrach siddur.** The best Sefard witnesses are
   the Birnbaum 1969 and Tifereth David 1951 scans (both CC0 / PD). The only Edot HaMizrach-type witness is the 1935
   *Seder Tefilat Yeshurun* scan. These can be used only for checking by eye.
3. **Chabad is already covered by Open Siddur's own contribution.** The Gonzales files are the app's Tehillat Hashem
   pack. Nothing further on the site improves on it; the Chanukah file is still unrecoverable.
4. **German vs Polish/Lithuanian Ashkenaz.** Baer (1868), the Wasserman Shabbat Shacharit, Tefiloh Sefas Yisroel and
   Durlacher are the German rite. Singer, Hertz and Schorr are tagged "Minhag Poland". Birnbaum and Kol Bo carry no
   minhag tag.
5. **Licence inconsistencies on Open Siddur pages.** The Baer, Wasserman, Farḥi and Kol Peh pages give different
   licences in the byline or metadata and in the footer. For Public Domain source books this matters only for
   Open Siddur's own additions, but a human reviewer should decide which statement to rely on.
6. **Tefilatenu (Scharfstein) is not on Open Siddur.** The only Scharfstein link found is Asher Scharfstein's Maimon
   Publishing Co., the publisher of Glazer's *Siddur Tefilat Yeshurun* (1934). That page also discusses *Hebrew
   Publishing Co. v. Scharfstein* (1942).
7. **Not examined in detail.** These Western Sephardi and Reform/Liberal books on the site are out of scope for the
   four rites: de Sola Pool, de Sola/Gaster, Pereira Mendes, Nieto, Einhorn, Wise, Union Prayer Book and others. The
   opensiddur GitHub repository (`opensiddur-sources`, marked deprecated) holds only Singer's **English** text as
   liturgy source.
