# Aramaic corpus inventory (Phase 0)

Every text the app ships, assigned to a corpus and a dialect profile. The machine-readable registry is
`scripts/aramaic/corpora.mjs` (pack/work → corpus rules); the CI test `tests/aramaicEngine.test.mjs` fails with
**NEW ARAMAIC CORPUS NOT EVALUATED** when a library pack or work is not claimed by a rule. The downloadable search
packs (`public/torah-packs/*`: midrash, chassidut, responsa, machshava) carry search indexes only
(`textIncluded: false`); their works are the library packs below. Online texts opened from Sefaria in the Source reader
are not part of the app's corpus: they are served by the same engine (and its proclitic fallback), unevaluated.

Tokens: word tokens of the tokenizer the tap uses (Hebrew-letter words; plus Latin words and digit runs).
ARAMAIC tokens: the independent classifier (`scripts/aramaic/classify.mjs`, v4) — see `coverage-baseline.md`.

| Group | Corpus id | Works | Location | Dialect profile | Tokens | Aramaic tokens | Uncertain |
|---|---|---|---|---|---:|---:|---:|
| Bavli | bavli | Talmud Bavli, 37 tractates (Vilna via Wikisource, CC BY-SA) | `public/library/packs/wikisource-talmud-cc-by-sa` | JBA | 1,858,033 | 507,656 | 9,494 |
| Yerushalmi | yerushalmi | Talmud Yerushalmi, 37 tractates (Guggenheimer, CC BY) | `sefaria-collection-talmud-cc-by/Jerusalem_Talmud_*` | JPA | 804,278 | 161,115 | 6,063 |
| Minor tractates | minor-tractates | Avot DeRabbi Natan A/B, Avadim, Derekh Eretz Rabbah/Zuta, Gerim, Kallah, Kallah Rabbati, Semachot, Soferim | `sefaria-collection-talmud-public-domain` | MIXED_RABBINIC | 126,109 | 7,097 | 1,503 |
| Zohar | zohar | Zohar (Wikisource, CC BY-SA) | `wikisource-zohar-cc-by-sa/Zohar` | ZOHARIC | 861,440 | 464,266 | 3,357 |
| Tikkunei Zohar | tikkunei-zohar | Tikkunei Zohar | `sefaria-collection-kabbalah-public-domain/Tikkunei_Zohar` | ZOHARIC | 148,287 | 66,933 | 371 |
| Zohar Chadash | zohar-chadash | Zohar Chadash | `sefaria-collection-kabbalah-public-domain/Zohar_Chadash` | ZOHARIC | 215,898 | 98,674 | 1,265 |
| Onkelos | onkelos | Targum Onkelos on the Torah (Shnayim Mikra) | `shnayim-mikra-sefaria-pd (field targum)` | TARGUMIC | 82,922 | 79,535 | 0 |
| Biblical Aramaic | biblical-aramaic | Daniel 2:4b–7:28, Ezra 4:8–6:18, 7:12–26, Jeremiah 10:11, Genesis 31:47 (UXLC 2.5) | `uxlc-2.5` | BIBLICAL_ARAMAIC | 5,006 | 4,822 | 0 |
| Midrash | midrash | 18 Midrash works incl. Ein Yaakov, Eikhah Rabbah, Ruth Rabbah, Shemot Rabbah, Tanchuma, Pesikta DeRav Kahana, Sifrei, Yalkut Shimoni | `sefaria-collection-midrash-*` | JPA | 2,798,865 | 303,896 | 28,678 |
| Liturgical | liturgy | All siddurim (Edot HaMizrach, Ashkenaz, Birnbaum, Sefard ×2, Chabad ×3), festival liturgy, zemirot, weekday mincha pack, Haggadah (de-duplicated paragraphs) | `src/data/nusach, siddurOffline, liturgy/, prayerPacks, tefillah pack` | LITURGICAL_ARAMAIC | 376,498 | 22,692 | 5,915 |
| Mixed commentaries | talmud-commentary | Rashi (58), Tosafot (60), Rif (25) on the Talmud | `sefaria-talmud-commentary-*` | MIXED_RABBINIC | 4,884,307 | 1,146,828 | 36,840 |
| Mixed commentaries | other-commentary | Commentaries on the Tanakh, Mishnah, Shulchan Arukh and the Zohar (Nefesh David, Yahel Ohr, Beur HaGra) | `sefaria-(tanakh|mishnah|shulchan-arukh)-commentary-*, wikisource-*-commentary, wikisource-zohar commentaries` | MIXED_RABBINIC | 7,217,478 | 543,122 | 67,256 |
| Other | other | Halacha, responsa, Kabbalah (Ramchal, Ari, Bahir, Yetzirah …), Chassidut, Machshava, Mussar, Mitzvot, reference, Ong Shabbat, legacy books (booksOffline) | `sefaria-collection-*, sefaria-shulchan-arukh-pd, author-permission-ong-shabbat, src/data/booksOffline.mjs` | MIXED_RABBINIC | 27,649,213 | 1,950,726 | 451,987 |

Hebrew reference (not evaluated as Aramaic; the classifier's Hebrew yardstick): the Hebrew chapters of the Tanakh
(UXLC 2.5), the Mishnah (Torat Emet 357), the Mishneh Torah (Torat Emet 363) — pointed, counted in their consonantal
and plene spellings — and the unpointed Shulchan Arukh (4 parts), Kitzur Shulchan Arukh and Chayei Adam (for forms
without a strong Aramaic mark only).

## Corpora the plan names that the app does not contain
- Other Targumim (Jonathan on the Prophets, Targum Yerushalmi/Pseudo-Jonathan, Targum to the Writings): not in the app.
- Babylonian minor tractates are present (above); the Yerushalmi is complete (37 tractates as in the edition).
- Liturgical Aramaic lives inside the siddurim (Kaddish, Brikh Shmeh, Yekum Purkan, Kol Chamira, Ha Lachma Anya,
  Pitach Eliyahu, Kegavna, Atkinu Seudata, Aramaic zemirot, Chad Gadya …); it is found by the token classifier, not by
  a list of passages.
- Embedded Aramaic in Hebrew works (Rashi, Tosafot, halacha, responsa, Chassidut): token level, the MIXED_RABBINIC
  profile.

## Dialect profiles (runtime: `src/services/wordLookup/aramaic/profiles.mjs`)
| Profile | Dialect | Corpora | Reader family → profile | Sense evidence order |
|---|---|---|---|---|
| J | JBA | Bavli | talmud (Bavli_* or the Talmud reader) | bavli, mishnah, tosefta |
| Y | JPA (Galilean) | Yerushalmi | talmud + Jerusalem_Talmud_* | yerushalmi, midrash, targum |
| M | JPA | Midrash | midrash | midrash, yerushalmi, targum, bavli |
| T | TARGUMIC | Onkelos | targum | targum, tanakh |
| Z | ZOHARIC | Zohar, Tikkunei Zohar, Zohar Chadash | zohar; kabbalah + Tikkunei_Zohar/Zohar_Chadash | zohar, targum, bavli, midrash |
| B | BIBLICAL_ARAMAIC | Daniel/Ezra Aramaic | biblical-aramaic (Daniel, Ezra) | tanakh, targum |
| L | LITURGICAL_ARAMAIC | siddurim, Haggadah | liturgy (prayer blocks, the Haggadah) | targum, bavli, zohar |
| X | MIXED_RABBINIC | commentaries, halacha, responsa, later works, minor tractates | everything else | bavli, yerushalmi, midrash |

**Pass 2 (classifier v5):** the divine name יי is a name everywhere; Onkelos's names are checked against the Hebrew verse; Daniel/Ezra's bare names are recognised. The Aramaic tokens changed as follows (the audit in `coverage-current.md` has the current counts):

| CORPUS | ARAMAIC TOKENS (v4) | ARAMAIC TOKENS (v5) |
|---|---:|---:|
| Onkelos | 79,535 | 76,881 |
| Biblical Aramaic | 4,822 | 4,672 |
| Liturgy | 22,692 | 20,384 |
| Yerushalmi | 161,115 | 160,342 |
