# Nikud audit of the bundled library (2026-10-01)

The owner's request: find which books in the library can be read **vocalized (מנוקד) from editions that already exist**.
Explicitly *not* to vocalize anything ourselves. So the rule of this work is:

- Only an existing vocalized edition, under a licence the library accepts (Public Domain, CC0, CC-BY, CC-BY-SA, and —
  under the owner's non-commercial policy for this free app, with attribution — CC-BY-NC / CC-BY-NC-SA).
- It must be **the same text** as the bundled edition, in the **same structure** (same units, ids and anchors), and complete.
- The app never adds nikud. No automatic vocalization (Dicta Nakdan or similar) is run by us, ever.

Tools: `node scripts/library/nikud-audit.mjs` (the measurement; it rewrites the table at the end of this page) and
`npx -y node@20 scripts/library/build-vocalized.mjs` (the gate and the import; `--report` only prints the verdicts).

## 1. Summary

| | before | after |
|---|---|---|
| bundled works measured | 792 | 792 |
| vocalized (≥ 0.5 vowel points per letter) | 269 | **319** |
| unvocalized (< 0.08) | 523 | 473 |
| partially vocalized | 0 | 0 |

Already vocalized before this work: the whole Tanakh (UXLC), the Mishnah and Pirkei Avot (Torat Emet 357), the Mishneh
Torah (Torat Emet 363), the Shulchan Arukh OC/YD/EH (Torat Emet), Kitzur Shulchan Arukh, the Jerusalem Talmud
(Guggenheimer), Rashi on seven of Trei Asar, Or HaChaim, Kli Yakar, Sforno on Genesis/Exodus, Ramban on Numbers,
Bartenura on Avot, Ruth/Eikhah Rabbah, Tanchuma, Pirkei DeRabbi Eliezer, Ein Yaakov, Tikkunei Zohar, Zohar Chadash, the
Tanya, Kuzari, Chafetz Chaim, Kav HaYashar, Bechinat Olam and a few more (see the table).

**Imported now: Bartenura on 50 tractates of the Mishnah**, Torat Emet's vocalized edition (Sefaria "Torat-Emet",
toratemetfreeware.com, recorded **CC-BY-NC**). The bundled "On Your Way" edition (Public Domain) is kept untouched as
the fallback edition of each tractate. Size: +1.36 MB compressed (50 files, 7.1 MB raw) in the new pack
`public/library/packs/sefaria-vocalized-cc-by-nc/`; the same tractates unvocalized are 1.08 MB, so the vocalized text
costs ≈ 29% more bytes than the plain one.

## 2. How a candidate is verified

`scripts/library/build-vocalized.mjs`, per work:

1. **Licence** re-read live from `/api/texts/versions/<Title>`; the export's licence must agree.
2. **Same structure.** Each unit of the bundled pack is located in the bundled edition's own Sefaria export (its anchor
   address; its words must be identical), and the vocalized export must have text at the same address. The new file
   keeps every node and unit id, `v` (the mishnah it explains) and the order; the anchors stay in the original pack.
   A comment the vocalized edition lacks fails the work.
3. **Same words.** Compared without nikud, te'amim and the letters ו/י (vocalized editions write ktiv chaser):
   per unit, beyond abbreviations the vocalizing editor opened (ר״ע → רבי עקיבא, ב״ד → בית דין, י״ד → ארבעה עשר; each
   may become up to 3 words), at most max(2 words, 10%) may differ on either side. Where an edition moved the border
   between two neighbouring comments (a sentence printed as the next comment's bold opening words), the pair is judged
   together. Over the work, ≥ 95% of the words must agree.
4. **Vocalized:** ≥ 0.5 vowel points per letter over the new text.

The accepted Bartenura tractates agree 95.4–99.1% word for word (median ≈ 98.3%); the remaining differences, reviewed by
sampling the largest ones, are opened abbreviations and numbers, ktiv male/chaser (טבלא/טבלה), and a few editorial
cross-references in parentheses that Torat Emet adds (e.g. "(כדלעיל פ"ד מי"א)"). Every accepted and refused edition is
recorded with its numbers in `sources/vocalized/provenance.json`.

Search: the normaliser ignores nikud and te'amim (and the engine already matches plene/defective spellings), so an
unpointed query finds the vocalized comment (`tests/vocalizedEditions.test.mjs`). Opened abbreviations make the text
easier to find by its full words; a query typed as the abbreviation (ר״ה) no longer matches the opened form in these
50 tractates.

## 3. Candidates found, by work

| work(s) | candidate edition | source | licence | coverage | same text? | decision |
|---|---|---|---|---|---|---|
| Bartenura, 50 tractates | "Torat-Emet" (vocalized) | Sefaria ← toratemetfreeware.com | CC-BY-NC | complete | yes (95–99%, abbreviations opened) | **imported**, default; PD "On Your Way" kept as fallback |
| Bartenura: Sheviit, Terumot, Shabbat, Sukkah, Beitzah, Oholot | "Torat-Emet" | Sefaria | CC-BY-NC | 1–2 comments missing each | — | refused: incomplete |
| Bartenura: Kilayim, Bikkurim, Pesachim, Zevachim, Middot | "Torat-Emet" | Sefaria | CC-BY-NC | complete | one or more comments with added/different text (Kilayim 3:1 adds 300 words of diagrams' explanation) | refused |
| Bartenura on Mikvaot | "Torat-Emet" | Sefaria | **unknown** | complete | — | refused: licence |
| Ramban on Genesis | "Vocalized Edition" | Sefaria | CC-BY | 707/709 (two colophons) | no: verse quotations expanded, "חסלת פרשת" markers dropped, several comments differ by 20–70 words | refused |
| Rashi on Joshua | "The Book of Joshua, Metsudah Publications, 1997" | Sefaria | CC-BY | complete | no: inserts editorial labels "(תַּרְגּוּם:)" and asterisks | refused |
| Rashi on I–II Kings, Ruth, Song of Songs, Ecclesiastes, Esther, Lamentations | Metsudah Tanach / Metsudah Five Megillot | Sefaria | CC-BY | complete | no: 84–96% agreement, rewritten and reorganised comments | refused |
| Rashi on the Torah | Rosenbaum–Silbermann (1929–1934) | Sefaria | recorded PD | complete | — | refused: already BLOCKED in the registry (1930–34 volumes not PD by age) |
| Rashi on the Torah | "Rashi Chumash, Metsudah Publications, 2009" | Sefaria | CC-BY | — | only the opening words are vocalized (0.11 points/letter) | not vocalized |
| Rashi on the Torah, Nach, Megillot | "רש״י מנוקד על המקרא" | he.wikisource | CC BY-SA 3.0 | complete | no: Torah based on the Silbermann edition (blocked) with added Onkelos quotations and completed citations; Megillot from Metsudah with explanations added; Nach from Sefaria's unknown-licence edition | refused |
| Rashi on Judges … II Chronicles (17 books) | "Sefaria vocalized edition" | Sefaria | **unknown** | — | — | refused: licence |
| Ramban on Leviticus, Deuteronomy; Sforno on Leviticus–Deuteronomy | "Vocalized Edition" | Sefaria | **unknown / empty** | — | — | refused: licence |
| Sforno on Leviticus, Numbers, Deuteronomy | "… -- Da'at" | Sefaria ← daat.ac.il | PD | 4% of comments | — | refused: fragment |
| Sifrei Devarim | "Vocalized Edition" | Sefaria | CC-BY-NC | complete | no: drops the 321 "סליק פיסקא" lines, adds verse references | refused |
| Talmud Bavli (37 tractates) | "William Davidson Edition – Vocalized Aramaic" | Sefaria (Koren/Steinsaltz) | CC-BY-NC (Menachot, Chullin: unknown) | complete | no: a different text (Berakhot: 92% agreement with the Vilna/Wikisource text) | refused; the Talmud reader already offers it live from Sefaria on request |
| Shulchan Arukh, Choshen Mishpat | "Torat Emet 363" | Sefaria | **unknown** | — | — | refused: licence |
| Shemot Rabbah | "Midrash Rabbah -- TE" | Sefaria | **unknown** | — | — | refused: licence |
| Ohr Yisrael | "Ohr Yisrael haMenukad, Jerusalem 1997" | Sefaria | **unknown** | — | — | refused: licence |
| Zohar | "Vocalized Zohar, Israel 2013", "Hebrew Translation" | Sefaria | **unknown** | — | — | refused (already PERMISSION_REQUIRED in the acquisition queue) |
| Tur | "טור מנוקד" | he.wikisource | CC BY-SA | 217 pages of ≈ 1,700 simanim | — | refused: incomplete |
| Mishnah Berurah, Biur Halacha | — | Sefaria, he.wikisource | — | — | no vocalized edition exists | — |

The other 379 unvocalized works have **no vocalized Hebrew version at all** on Sefaria (every Hebrew version was
sampled and measured); for the Wikisource-based packs (Zohar, Mishnah Berurah, Bavli) none exists on Wikisource either.
Not researched further: Dicta's vocalized corpora (machine vocalization — the owner asked for ready editions, not
automatic nikud), Open Siddur (liturgy, out of scope).

## 4. What remains unvocalized, and why

- **No vocalized edition exists in an open source** (most of the library): Talmud commentaries (Rashi, Tosafot, Rif),
  the Tosafot Yom Tov, Beit Yosef, Tur, Mishnah Berurah, Kaf HaChaim, Be'er Heitev, the responsa, most Kabbalah,
  Chassidut, Machshava, Midrash halakha and the later midrashim.
- **Exists, licence unknown**: Rashi on Nach (17 books), Ramban on Leviticus/Deuteronomy, Sforno on Leviticus–
  Deuteronomy, Shulchan Arukh Choshen Mishpat, Shemot Rabbah, Ohr Yisrael, the vocalized Zohar, Bartenura on Mikvaot.
  These could be imported by the same script if Sefaria/the publisher confirm an open licence.
- **Exists, but not the same text or not complete**: the 11 Bartenura tractates above, Ramban on Genesis, Metsudah's
  Rashi, Wikisource's Rashi, Sifrei Devarim, the vocalized Bavli.
- **Out of scope**: עונג שבת (the author's own edition, used by permission).

## 5. The table

<!-- nikud-audit:begin (generated by scripts/library/nikud-audit.mjs) -->

Measured 792 bundled works (the edition the app reads): **yes 319**, partial 0, **no 473**.
Sample: up to 200,000 Hebrew letters per work; vowel points U+05B0–U+05BC, U+05C1–U+05C2, U+05C7 (te'amim not counted)
per Hebrew letter. yes ≥ 0.5 (fully vocalized text is ≈ 0.8–0.9), partial 0.08–0.5, no < 0.08.

| work | workId | pack | edition read | licence | points/letter | nikud | fallback (unvocalized) |
|---|---|---|---|---|---|---|---|
| ספר הזהר | `Zohar` | `wikisource-zohar-cc-by-sa` | Hebrew Wikisource transcription, Mantua pagination | cc-by-sa | 0.00 | no |  |
| יהל אור (הגר״א) | `Yahel_Ohr_on_Zohar` | `wikisource-zohar-cc-by-sa` | Vilna 1882 | cc-by-sa | 0.00 | no |  |
| ביאור הגר״א על ספרא דצניעותא | `Beur_HaGra_on_Sifra_DeTzniuta` | `wikisource-zohar-cc-by-sa` | Wikisource | cc-by-sa | 0.00 | no |  |
| נפש דוד (הרד״ל) | `Nefesh_David_on_Zohar` | `wikisource-zohar-cc-by-sa` | Hebrew Wikisource transcription (Vilna 1882 appendix to Yahel Ohr) | cc-by-sa | 0.00 | no |  |
| רש״י על בראשית | `Rashi_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על שמות | `Rashi_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על ויקרא | `Rashi_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על במדבר | `Rashi_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על דברים | `Rashi_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על יהושע | `Rashi_on_Joshua` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על שופטים | `Rashi_on_Judges` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על שמואל א | `Rashi_on_I_Samuel` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על שמואל ב | `Rashi_on_II_Samuel` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על מלכים א | `Rashi_on_I_Kings` | `sefaria-tanakh-commentary-public-domain` | On Your Way -- new | public-domain | 0.00 | no |  |
| רש״י על מלכים ב | `Rashi_on_II_Kings` | `sefaria-tanakh-commentary-public-domain` | On Your Way -- new | public-domain | 0.00 | no |  |
| רש״י על ישעיהו | `Rashi_on_Isaiah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על ירמיהו | `Rashi_on_Jeremiah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על יחזקאל | `Rashi_on_Ezekiel` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על הושע | `Rashi_on_Hosea` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על יואל | `Rashi_on_Joel` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.79 | yes |  |
| רש״י על עמוס | `Rashi_on_Amos` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על עובדיה | `Rashi_on_Obadiah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על יונה | `Rashi_on_Jonah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על מיכה | `Rashi_on_Micah` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.80 | yes |  |
| רש״י על נחום | `Rashi_on_Nahum` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.79 | yes |  |
| רש״י על חבקוק | `Rashi_on_Habakkuk` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.80 | yes |  |
| רש״י על צפניה | `Rashi_on_Zephaniah` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.79 | yes |  |
| רש״י על חגי | `Rashi_on_Haggai` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.82 | yes |  |
| רש״י על זכריה | `Rashi_on_Zechariah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על מלאכי | `Rashi_on_Malachi` | `sefaria-tanakh-commentary-public-domain` | Sefaria vocalized edition | public-domain | 0.81 | yes |  |
| רש״י על תהילים | `Rashi_on_Psalms` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על משלי | `Rashi_on_Proverbs` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על איוב | `Rashi_on_Job` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על שיר השירים | `Rashi_on_Song_of_Songs` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על רות | `Rashi_on_Ruth` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על איכה | `Rashi_on_Lamentations` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על קהלת | `Rashi_on_Ecclesiastes` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על אסתר | `Rashi_on_Esther` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על דניאל | `Rashi_on_Daniel` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על עזרא | `Rashi_on_Ezra` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על נחמיה | `Rashi_on_Nehemiah` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על דברי הימים א | `Rashi_on_I_Chronicles` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רש״י על דברי הימים ב | `Rashi_on_II_Chronicles` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| רמב״ן על בראשית | `Ramban_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.02 | no |  |
| רמב״ן על ויקרא | `Ramban_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | On Your Way New | public-domain | 0.00 | no |  |
| רמב״ן על במדבר | `Ramban_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.80 | yes |  |
| רמב״ן על דברים | `Ramban_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | On Your Way new | public-domain | 0.00 | no |  |
| אבן עזרא על בראשית | `Ibn_Ezra_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Piotrkow, 1907-1911 | public-domain | 0.01 | no |  |
| אבן עזרא על שמות | `Ibn_Ezra_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Piotrkow, 1907-1911 | public-domain | 0.00 | no |  |
| אבן עזרא הקצר על שמות | `Ibn_Ezra_HaKatzar_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Prague, 1840 | public-domain | 0.00 | no |  |
| אבן עזרא על ויקרא | `Ibn_Ezra_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| אבן עזרא על במדבר | `Ibn_Ezra_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| אבן עזרא על דברים | `Ibn_Ezra_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| אבן עזרא על ישעיהו | `Ibn_Ezra_on_Isaiah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Isaiah, by M. Friedlander; Society of Hebrew Literature, London 1877 | public-domain | 0.00 | no |  |
| אבן עזרא על הושע | `Ibn_Ezra_on_Hosea` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Hosea -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על יואל | `Ibn_Ezra_on_Joel` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Joel -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על עמוס | `Ibn_Ezra_on_Amos` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Amos -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על עובדיה | `Ibn_Ezra_on_Obadiah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Obadiah -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על יונה | `Ibn_Ezra_on_Jonah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Jonah -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על מיכה | `Ibn_Ezra_on_Micah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Micah -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על נחום | `Ibn_Ezra_on_Nahum` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Nahum -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על חבקוק | `Ibn_Ezra_on_Habakkuk` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Habakkuk -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על צפניה | `Ibn_Ezra_on_Zephaniah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Zephaniah -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על חגי | `Ibn_Ezra_on_Haggai` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Haggai -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על זכריה | `Ibn_Ezra_on_Zechariah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Zecharia -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על מלאכי | `Ibn_Ezra_on_Malachi` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Malachi -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על תהילים | `Ibn_Ezra_on_Psalms` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Psalms -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על משלי | `Ibn_Ezra_on_Proverbs` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Proverbs -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על איוב | `Ibn_Ezra_on_Job` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Job -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על שיר השירים | `Ibn_Ezra_on_Song_of_Songs` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra's commentary on the Canticles | public-domain | 0.00 | no |  |
| אבן עזרא על רות | `Ibn_Ezra_on_Ruth` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Ruth -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על אסתר | `Ibn_Ezra_on_Esther` | `sefaria-tanakh-commentary-public-domain` | Kol Sason, Krotoschin, 1840 | public-domain | 0.00 | no |  |
| אבן עזרא על אסתר (נוסח שני) | `Second_Version_of_Ibn_Ezra_on_Esther` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra's Commentary on the Book of Esther, London, 1850. | public-domain | 0.00 | no |  |
| אבן עזרא על דניאל | `Ibn_Ezra_on_Daniel` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Daniel - Daat | public-domain | 0.00 | no |  |
| אבן עזרא על עזרא | `Ibn_Ezra_on_Ezra` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Ezra -- Daat | public-domain | 0.00 | no |  |
| אבן עזרא על נחמיה | `Ibn_Ezra_on_Nehemiah` | `sefaria-tanakh-commentary-public-domain` | Ibn Ezra on Nehemiah -- Daat | public-domain | 0.00 | no |  |
| ספורנו על בראשית | `Sforno_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| ספורנו על שמות | `Sforno_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| ספורנו על ויקרא | `Sforno_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ספורנו על במדבר | `Sforno_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ספורנו על דברים | `Sforno_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ספורנו על שיר השירים | `Sforno_on_Song_of_Songs` | `sefaria-tanakh-commentary-public-domain` | Chamesh Megillot, Warsaw 1875 | public-domain | 0.00 | no |  |
| אור החיים על בראשית | `Or_HaChaim_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.81 | yes |  |
| אור החיים על שמות | `Or_HaChaim_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.81 | yes |  |
| אור החיים על ויקרא | `Or_HaChaim_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| אור החיים על במדבר | `Or_HaChaim_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| אור החיים על דברים | `Or_HaChaim_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.81 | yes |  |
| ראשון לציון לבעל אור החיים על יהושע | `Rishon_LeTzion_on_Joshua` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על שופטים | `Rishon_LeTzion_on_Judges` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על שמואל א | `Rishon_LeTzion_on_I_Samuel` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על שמואל ב | `Rishon_LeTzion_on_II_Samuel` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על ישעיהו | `Rishon_LeTzion_on_Isaiah` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על משלי | `Rishon_LeTzion_on_Proverbs` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על שיר השירים | `Rishon_LeTzion_on_Song_of_Songs` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על איכה | `Rishon_LeTzion_on_Lamentations` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| ראשון לציון לבעל אור החיים על אסתר | `Rishon_LeTzion_on_Esther` | `sefaria-tanakh-commentary-public-domain` | Jerusalem, 1915 | public-domain | 0.00 | no |  |
| כלי יקר על בראשית | `Kli_Yakar_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.81 | yes |  |
| כלי יקר על שמות | `Kli_Yakar_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.81 | yes |  |
| כלי יקר על ויקרא | `Kli_Yakar_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| כלי יקר על במדבר | `Kli_Yakar_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| כלי יקר על דברים | `Kli_Yakar_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Vocalized Edition | public-domain | 0.82 | yes |  |
| רשב״ם על בראשית | `Rashbam_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | daat | public-domain | 0.00 | no |  |
| רשב״ם על שמות | `Rashbam_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Rashbam on Torah -- Daat | public-domain | 0.01 | no |  |
| רשב״ם על ויקרא | `Rashbam_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Rashbam on Leviticus - Daat | public-domain | 0.00 | no |  |
| רשב״ם על במדבר | `Rashbam_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Rashbam on Numbers -- Daat | public-domain | 0.01 | no |  |
| רשב״ם על דברים | `Rashbam_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Rashbam on Deuteronomy -- Daat | public-domain | 0.01 | no |  |
| רבינו בחיי על בראשית | `Rabbeinu_Bahya_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878 | public-domain | 0.00 | no |  |
| רבינו בחיי על שמות | `Rabbeinu_Bahya_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878 | public-domain | 0.00 | no |  |
| רבינו בחיי על ויקרא | `Rabbeinu_Bahya_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878 | public-domain | 0.00 | no |  |
| רבינו בחיי על במדבר | `Rabbeinu_Bahya_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878 | public-domain | 0.00 | no |  |
| רבינו בחיי על דברים | `Rabbeinu_Bahya_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878 | public-domain | 0.00 | no |  |
| טור הארוך על בראשית | `Tur_HaArokh_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Perush al ha-Torah, Hanover, 1838 | public-domain | 0.00 | no |  |
| טור הארוך על שמות | `Tur_HaArokh_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Perush al ha-Torah, Hanover, 1838 | public-domain | 0.00 | no |  |
| טור הארוך על ויקרא | `Tur_HaArokh_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Perush al ha-Torah, Hanover, 1838 | public-domain | 0.00 | no |  |
| טור הארוך על במדבר | `Tur_HaArokh_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Perush al ha-Torah, Hanover, 1838 | public-domain | 0.00 | no |  |
| טור הארוך על דברים | `Tur_HaArokh_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Perush al ha-Torah, Hanover, 1838 | public-domain | 0.00 | no |  |
| שפתי חכמים על בראשית | `Siftei_Chakhamim_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Siftei Hakhamim | public-domain | 0.00 | no |  |
| שפתי חכמים על שמות | `Siftei_Chakhamim_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Siftei Hakhamim | public-domain | 0.00 | no |  |
| שפתי חכמים על ויקרא | `Siftei_Chakhamim_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Siftei Hakhamim | public-domain | 0.00 | no |  |
| שפתי חכמים על במדבר | `Siftei_Chakhamim_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Siftei Hakhamim | public-domain | 0.00 | no |  |
| שפתי חכמים על דברים | `Siftei_Chakhamim_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Siftei Hakhamim | public-domain | 0.00 | no |  |
| העמק דבר על בראשית | `Haamek_Davar_on_Genesis` | `sefaria-tanakh-commentary-public-domain` | Sefer Torat Elohim, Vilna 1879 | public-domain | 0.00 | no |  |
| העמק דבר על שמות | `Haamek_Davar_on_Exodus` | `sefaria-tanakh-commentary-public-domain` | Sefer Torat Elohim, Vilna 1879 | public-domain | 0.00 | no |  |
| העמק דבר על ויקרא | `Haamek_Davar_on_Leviticus` | `sefaria-tanakh-commentary-public-domain` | Sefer Torat Elohim, Vilna 1879 | public-domain | 0.00 | no |  |
| העמק דבר על במדבר | `Haamek_Davar_on_Numbers` | `sefaria-tanakh-commentary-public-domain` | Sefer Torat Elohim, Vilna 1879 | public-domain | 0.00 | no |  |
| העמק דבר על דברים | `Haamek_Davar_on_Deuteronomy` | `sefaria-tanakh-commentary-public-domain` | Sefer Torat Elohim, Vilna 1879 | public-domain | 0.00 | no |  |
| אבן עזרא על איכה | `Ibn_Ezra_on_Lamentations` | `sefaria-tanakh-commentary-cc-by-sa` | Ibn Ezra on Lamentations -- Wikisource | cc-by-sa | 0.01 | no |  |
| אבן עזרא על קהלת | `Ibn_Ezra_on_Ecclesiastes` | `sefaria-tanakh-commentary-cc-by-sa` | Wikisource | cc-by-sa | 0.00 | no |  |
| ברטנורא על משנה ברכות | `Bartenura_on_Mishnah_Berakhot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה פאה | `Bartenura_on_Mishnah_Peah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה דמאי | `Bartenura_on_Mishnah_Demai` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה כלאים | `Bartenura_on_Mishnah_Kilayim` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה שביעית | `Bartenura_on_Mishnah_Sheviit` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה תרומות | `Bartenura_on_Mishnah_Terumot` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה מעשרות | `Bartenura_on_Mishnah_Maasrot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מעשר שני | `Bartenura_on_Mishnah_Maaser_Sheni` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה חלה | `Bartenura_on_Mishnah_Challah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה ערלה | `Bartenura_on_Mishnah_Orlah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה ביכורים | `Bartenura_on_Mishnah_Bikkurim` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה שבת | `Bartenura_on_Mishnah_Shabbat` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה עירובין | `Bartenura_on_Mishnah_Eruvin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה פסחים | `Bartenura_on_Mishnah_Pesachim` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה שקלים | `Bartenura_on_Mishnah_Shekalim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה יומא | `Bartenura_on_Mishnah_Yoma` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה סוכה | `Bartenura_on_Mishnah_Sukkah` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה ביצה | `Bartenura_on_Mishnah_Beitzah` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה ראש השנה | `Bartenura_on_Mishnah_Rosh_Hashanah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה תענית | `Bartenura_on_Mishnah_Taanit` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מגילה | `Bartenura_on_Mishnah_Megillah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מועד קטן | `Bartenura_on_Mishnah_Moed_Katan` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה חגיגה | `Bartenura_on_Mishnah_Chagigah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.81 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה יבמות | `Bartenura_on_Mishnah_Yevamot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה כתובות | `Bartenura_on_Mishnah_Ketubot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה נדרים | `Bartenura_on_Mishnah_Nedarim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה נזיר | `Bartenura_on_Mishnah_Nazir` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.80 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה סוטה | `Bartenura_on_Mishnah_Sotah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה גיטין | `Bartenura_on_Mishnah_Gittin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה קידושין | `Bartenura_on_Mishnah_Kiddushin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה בבא קמא | `Bartenura_on_Mishnah_Bava_Kamma` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה בבא מציעא | `Bartenura_on_Mishnah_Bava_Metzia` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה בבא בתרא | `Bartenura_on_Mishnah_Bava_Batra` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה סנהדרין | `Bartenura_on_Mishnah_Sanhedrin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.80 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מכות | `Bartenura_on_Mishnah_Makkot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.81 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה שבועות | `Bartenura_on_Mishnah_Shevuot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה עדיות | `Bartenura_on_Mishnah_Eduyot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה עבודה זרה | `Bartenura_on_Mishnah_Avodah_Zarah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה אבות | `Bartenura_on_Pirkei_Avot` | `sefaria-mishnah-commentary-public-domain` | ToratEmet | public-domain | 0.84 | yes |  |
| ברטנורא על משנה הוריות | `Bartenura_on_Mishnah_Horayot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.81 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה זבחים | `Bartenura_on_Mishnah_Zevachim` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה מנחות | `Bartenura_on_Mishnah_Menachot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה חולין | `Bartenura_on_Mishnah_Chullin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה בכורות | `Bartenura_on_Mishnah_Bekhorot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה ערכין | `Bartenura_on_Mishnah_Arakhin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה תמורה | `Bartenura_on_Mishnah_Temurah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה כריתות | `Bartenura_on_Mishnah_Keritot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מעילה | `Bartenura_on_Mishnah_Meilah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה תמיד | `Bartenura_on_Mishnah_Tamid` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מדות | `Bartenura_on_Mishnah_Middot` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה קינים | `Bartenura_on_Mishnah_Kinnim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה כלים | `Bartenura_on_Mishnah_Kelim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה אהלות | `Bartenura_on_Mishnah_Oholot` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה נגעים | `Bartenura_on_Mishnah_Negaim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה פרה | `Bartenura_on_Mishnah_Parah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה טהרות | `Bartenura_on_Mishnah_Tahorot` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מקואות | `Bartenura_on_Mishnah_Mikvaot` | `sefaria-mishnah-commentary-public-domain` | On Your Way | public-domain | 0.00 | no |  |
| ברטנורא על משנה נדה | `Bartenura_on_Mishnah_Niddah` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה מכשירין | `Bartenura_on_Mishnah_Makhshirin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה זבים | `Bartenura_on_Mishnah_Zavim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה טבול יום | `Bartenura_on_Mishnah_Tevul_Yom` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.83 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה ידים | `Bartenura_on_Mishnah_Yadayim` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.84 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| ברטנורא על משנה עוקצים | `Bartenura_on_Mishnah_Oktzin` | `sefaria-vocalized-cc-by-nc` | Torat-Emet | cc-by-nc | 0.82 | yes | On Your Way (sefaria-mishnah-commentary-public-domain) |
| הקדמת תוספות יום טוב | `Tosafot_Yom_Tov_Introduction_to_the_Mishnah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ברכות | `Tosafot_Yom_Tov_on_Mishnah_Berakhot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה פאה | `Tosefot_Yom_Tov_on_Mishnah_Peah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה דמאי | `Tosafot_Yom_Tov_on_Mishnah_Demai` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה כלאים | `Tosafot_Yom_Tov_on_Mishnah_Kilayim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה שביעית | `Tosafot_Yom_Tov_on_Mishnah_Sheviit` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה תרומות | `Tosafot_Yom_Tov_on_Mishnah_Terumot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מעשרות | `Tosafot_Yom_Tov_on_Mishnah_Maasrot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מעשר שני | `Tosafot_Yom_Tov_on_Mishnah_Maaser_Sheni` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה חלה | `Tosafot_Yom_Tov_on_Mishnah_Challah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ערלה | `Tosafot_Yom_Tov_on_Mishnah_Orlah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ביכורים | `Tosafot_Yom_Tov_on_Mishnah_Bikkurim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה שבת | `Tosafot_Yom_Tov_on_Mishnah_Shabbat` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה עירובין | `Tosafot_Yom_Tov_on_Mishnah_Eruvin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה פסחים | `Tosafot_Yom_Tov_on_Mishnah_Pesachim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה שקלים | `Tosafot_Yom_Tov_on_Mishnah_Shekalim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה יומא | `Tosafot_Yom_Tov_on_Mishnah_Yoma` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה סוכה | `Tosafot_Yom_Tov_on_Mishnah_Sukkah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ביצה | `Tosafot_Yom_Tov_on_Mishnah_Beitzah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ראש השנה | `Tosafot_Yom_Tov_on_Mishnah_Rosh_Hashanah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה תענית | `Tosafot_Yom_Tov_on_Mishnah_Taanit` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מגילה | `Tosafot_Yom_Tov_on_Mishnah_Megillah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מועד קטן | `Tosafot_Yom_Tov_on_Mishnah_Moed_Katan` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה חגיגה | `Tosafot_Yom_Tov_on_Mishnah_Chagigah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה יבמות | `Tosafot_Yom_Tov_on_Mishnah_Yevamot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה כתובות | `Tosafot_Yom_Tov_on_Mishnah_Ketubot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה נדרים | `Tosafot_Yom_Tov_on_Mishnah_Nedarim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה נזיר | `Tosafot_Yom_Tov_on_Mishnah_Nazir` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה סוטה | `Tosafot_Yom_Tov_on_Mishnah_Sotah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה גיטין | `Tosafot_Yom_Tov_on_Mishnah_Gittin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה קידושין | `Tosafot_Yom_Tov_on_Mishnah_Kiddushin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה בבא קמא | `Tosafot_Yom_Tov_on_Mishnah_Bava_Kamma` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה בבא מציעא | `Tosafot_Yom_Tov_on_Mishnah_Bava_Metzia` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה בבא בתרא | `Tosafot_Yom_Tov_on_Mishnah_Bava_Batra` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה סנהדרין | `Tosafot_Yom_Tov_on_Mishnah_Sanhedrin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מכות | `Tosafot_Yom_Tov_on_Mishnah_Makkot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה שבועות | `Tosafot_Yom_Tov_on_Mishnah_Shevuot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה עדיות | `Tosafot_Yom_Tov_on_Mishnah_Eduyot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה עבודה זרה | `Tosafot_Yom_Tov_on_Mishnah_Avodah_Zarah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה אבות | `Tosafot_Yom_Tov_on_Pirkei_Avot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה הוריות | `Tosafot_Yom_Tov_on_Mishnah_Horayot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה זבחים | `Tosafot_Yom_Tov_on_Mishnah_Zevachim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מנחות | `Tosafot_Yom_Tov_on_Mishnah_Menachot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה חולין | `Tosafot_Yom_Tov_on_Mishnah_Chullin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה בכורות | `Tosafot_Yom_Tov_on_Mishnah_Bekhorot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ערכין | `Tosafot_Yom_Tov_on_Mishnah_Arakhin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה תמורה | `Tosafot_Yom_Tov_on_Mishnah_Temurah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה כריתות | `Tosafot_Yom_Tov_on_Mishnah_Keritot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מעילה | `Tosafot_Yom_Tov_on_Mishnah_Meilah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה תמיד | `Tosafot_Yom_Tov_on_Mishnah_Tamid` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מדות | `Tosafot_Yom_Tov_on_Mishnah_Middot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה קינים | `Tosafot_Yom_Tov_on_Mishnah_Kinnim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה כלים | `Tosafot_Yom_Tov_on_Mishnah_Kelim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה אהלות | `Tosafot_Yom_Tov_on_Mishnah_Oholot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה נגעים | `Tosafot_Yom_Tov_on_Mishnah_Negaim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה פרה | `Tosafot_Yom_Tov_on_Mishnah_Parah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה טהרות | `Tosafot_Yom_Tov_on_Mishnah_Tahorot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מקואות | `Tosafot_Yom_Tov_on_Mishnah_Mikvaot` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה נדה | `Tosafot_Yom_Tov_on_Mishnah_Niddah` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה מכשירין | `Tosafot_Yom_Tov_on_Mishnah_Makhshirin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה זבים | `Tosafot_Yom_Tov_on_Mishnah_Zavim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה טבול יום | `Tosafot_Yom_Tov_on_Mishnah_Tevul_Yom` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה ידים | `Tosafot_Yom_Tov_on_Mishnah_Yadayim` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| תוספות יום טוב על משנה עוקצים | `Tosafot_Yom_Tov_on_Mishnah_Oktzin` | `sefaria-mishnah-commentary-public-domain` | Mishnah, ed. Romm, Vilna 1913 | public-domain | 0.00 | no |  |
| עונג שבת | `Oneg_Shabbat` | `author-permission-ong-shabbat` | Oneg Shabbat, first edition 5773 (2013) | author-permission | 0.00 | no |  |
| עונג שבת · מקורות וטעמים | `Oneg_Shabbat_Notes` | `author-permission-ong-shabbat` | Oneg Shabbat, first edition 5773 (2013) | author-permission | 0.00 | no |  |
| תלמוד בבלי · ברכות | `Bavli_Berakhot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · שבת | `Bavli_Shabbat` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · עירובין | `Bavli_Eruvin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · פסחים | `Bavli_Pesachim` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · ראש השנה | `Bavli_Rosh_Hashanah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · יומא | `Bavli_Yoma` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · סוכה | `Bavli_Sukkah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · ביצה | `Bavli_Beitzah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · תענית | `Bavli_Taanit` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · מגילה | `Bavli_Megillah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · מועד קטן | `Bavli_Moed_Katan` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · חגיגה | `Bavli_Chagigah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · יבמות | `Bavli_Yevamot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · כתובות | `Bavli_Ketubot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · נדרים | `Bavli_Nedarim` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · נזיר | `Bavli_Nazir` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · סוטה | `Bavli_Sotah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · גיטין | `Bavli_Gittin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · קידושין | `Bavli_Kiddushin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · בבא קמא | `Bavli_Bava_Kamma` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · בבא מציעא | `Bavli_Bava_Metzia` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · בבא בתרא | `Bavli_Bava_Batra` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · סנהדרין | `Bavli_Sanhedrin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · מכות | `Bavli_Makkot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · שבועות | `Bavli_Shevuot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · עבודה זרה | `Bavli_Avodah_Zarah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · הוריות | `Bavli_Horayot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · זבחים | `Bavli_Zevachim` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · מנחות | `Bavli_Menachot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · חולין | `Bavli_Chullin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · בכורות | `Bavli_Bekhorot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · ערכין | `Bavli_Arakhin` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · תמורה | `Bavli_Temurah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · כריתות | `Bavli_Keritot` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · מעילה | `Bavli_Meilah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · תמיד | `Bavli_Tamid` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| תלמוד בבלי · נדה | `Bavli_Niddah` | `wikisource-talmud-cc-by-sa` | Wikisource Talmud Bavli | cc-by-sa | 0.00 | no |  |
| רש״י על ברכות | `Rashi_on_Berakhot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על שבת | `Rashi_on_Shabbat` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על עירובין | `Rashi_on_Eruvin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על פסחים | `Rashi_on_Pesachim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על יומא | `Rashi_on_Yoma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על סוכה | `Rashi_on_Sukkah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על ביצה | `Rashi_on_Beitzah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על תענית | `Rashi_on_Taanit` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על מגילה | `Rashi_on_Megillah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על מועד קטן | `Rashi_on_Moed_Katan` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על יבמות | `Rashi_on_Yevamot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על כתובות | `Rashi_on_Ketubot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על נדרים | `Rashi_on_Nedarim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על נזיר | `Rashi_on_Nazir` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על סוטה | `Rashi_on_Sotah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על גיטין | `Rashi_on_Gittin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על קידושין | `Rashi_on_Kiddushin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על בבא קמא | `Rashi_on_Bava_Kamma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על בבא מציעא | `Rashi_on_Bava_Metzia` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על בבא בתרא | `Rashi_on_Bava_Batra` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על מכות | `Rashi_on_Makkot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על שבועות | `Rashi_on_Shevuot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על הוריות | `Rashi_on_Horayot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על זבחים | `Rashi_on_Zevachim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על מנחות | `Rashi_on_Menachot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על חולין | `Rashi_on_Chullin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על בכורות | `Rashi_on_Bekhorot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על ערכין | `Rashi_on_Arakhin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על נדה | `Rashi_on_Niddah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על ברכות | `Tosafot_on_Berakhot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על שבת | `Tosafot_on_Shabbat` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על עירובין | `Tosafot_on_Eruvin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על פסחים | `Tosafot_on_Pesachim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על ראש השנה | `Tosafot_on_Rosh_Hashanah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על יומא | `Tosafot_on_Yoma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על סוכה | `Tosafot_on_Sukkah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על ביצה | `Tosafot_on_Beitzah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על תענית | `Tosafot_on_Taanit` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על מגילה | `Tosafot_on_Megillah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על מועד קטן | `Tosafot_on_Moed_Katan` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על יבמות | `Tosafot_on_Yevamot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על כתובות | `Tosafot_on_Ketubot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על נדרים | `Tosafot_on_Nedarim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על נזיר | `Tosafot_on_Nazir` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על סוטה | `Tosafot_on_Sotah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על גיטין | `Tosafot_on_Gittin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על קידושין | `Tosafot_on_Kiddushin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על בבא קמא | `Tosafot_on_Bava_Kamma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על בבא מציעא | `Tosafot_on_Bava_Metzia` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על בבא בתרא | `Tosafot_on_Bava_Batra` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על מכות | `Tosafot_on_Makkot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על שבועות | `Tosafot_on_Shevuot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על הוריות | `Tosafot_on_Horayot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על זבחים | `Tosafot_on_Zevachim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על מנחות | `Tosafot_on_Menachot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על חולין | `Tosafot_on_Chullin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על בכורות | `Tosafot_on_Bekhorot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על ערכין | `Tosafot_on_Arakhin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| תוספות על נדה | `Tosafot_on_Niddah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על ברכות | `Rif_Berakhot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על שבת | `Rif_Shabbat` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על עירובין | `Rif_Eruvin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על פסחים | `Rif_Pesachim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על ראש השנה | `Rif_Rosh_Hashanah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על יומא | `Rif_Yoma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על סוכה | `Rif_Sukkah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על ביצה | `Rif_Beitzah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על תענית | `Rif_Taanit` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על מגילה | `Rif_Megillah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על מועד קטן | `Rif_Moed_Katan` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על יבמות | `Rif_Yevamot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על כתובות | `Rif_Ketubot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על נדרים | `Rif_Nedarim` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על גיטין | `Rif_Gittin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על קידושין | `Rif_Kiddushin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על בבא קמא | `Rif_Bava_Kamma` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על בבא מציעא | `Rif_Bava_Metzia` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על בבא בתרא | `Rif_Bava_Batra` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על סנהדרין | `Rif_Sanhedrin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על מכות | `Rif_Makkot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על שבועות | `Rif_Shevuot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על עבודה זרה | `Rif_Avodah_Zarah` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על מנחות | `Rif_Halakhot_Ketanot_Menachot` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רי״ף על חולין | `Rif_Chullin` | `sefaria-talmud-commentary-public-domain` | Vilna Edition | public-domain | 0.00 | no |  |
| רש״י על ראש השנה | `Rashi_on_Rosh_Hashanah` | `sefaria-talmud-commentary-cc-by-sa` | WikiSource Rashi | cc-by-sa | 0.00 | no |  |
| רש״י על חגיגה | `Rashi_on_Chagigah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| רש״י על סנהדרין | `Rashi_on_Sanhedrin` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| רש״י על עבודה זרה | `Rashi_on_Avodah_Zarah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| רש״י על תמורה | `Rashi_on_Temurah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| רש״י על כריתות | `Rashi_on_Keritot` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| רש״י על מעילה | `Rashi_on_Meilah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על חגיגה | `Tosafot_on_Chagigah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על סנהדרין | `Tosafot_on_Sanhedrin` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על עבודה זרה | `Tosafot_on_Avodah_Zarah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על תמורה | `Tosafot_on_Temurah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על כריתות | `Tosafot_on_Keritot` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| תוספות על מעילה | `Tosafot_on_Meilah` | `sefaria-talmud-commentary-cc-by-sa` | Vilna Edition | cc-by-sa | 0.00 | no |  |
| משנה ברורה | `Mishnah_Berurah` | `wikisource-shulchan-arukh-commentary-cc-by-sa` | Wikisource — משנה ברורה | cc-by-sa | 0.00 | no |  |
| ביאור הלכה | `Biur_Halacha` | `wikisource-shulchan-arukh-commentary-cc-by-sa` | Wikisource — ביאור הלכה | cc-by-sa | 0.00 | no |  |
| באר היטב על שולחן ערוך אורח חיים | `Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim` | `sefaria-shulchan-arukh-commentary-public-domain` | Torat Emet 357 | public-domain | 0.00 | no |  |
| כף החיים על שולחן ערוך אורח חיים | `Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim` | `sefaria-shulchan-arukh-commentary-public-domain` | Kaf Hachayim, Orach Chayim vol. I-VIII, Jerusalem 1910-1933 | public-domain | 0.00 | no |  |
| בית יוסף | `Beit_Yosef` | `sefaria-beit-yosef-public-domain` | Tur Orach Chaim, Vilna, 1923 · Tur Yoreh Deah, Vilna, 1923 · Tur Even HaEzer, Vilna, 1923 · Tur Choshen Mishpat: Vilna, 1923 | public-domain | 0.00 | no |  |
| בראשית | `Genesis` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| שמות | `Exodus` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.85 | yes |  |
| ויקרא | `Leviticus` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| במדבר | `Numbers` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.85 | yes |  |
| דברים | `Deuteronomy` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| יהושע | `Joshua` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.83 | yes |  |
| שופטים | `Judges` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| שמואל א | `I_Samuel` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.83 | yes |  |
| שמואל ב | `II_Samuel` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| מלכים א | `I_Kings` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.85 | yes |  |
| מלכים ב | `II_Kings` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.84 | yes |  |
| ישעיהו | `Isaiah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| ירמיהו | `Jeremiah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| יחזקאל | `Ezekiel` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| הושע | `Hosea` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| יואל | `Joel` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.80 | yes |  |
| עמוס | `Amos` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| עובדיה | `Obadiah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| יונה | `Jonah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| מיכה | `Micah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| נחום | `Nahum` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.83 | yes |  |
| חבקוק | `Habakkuk` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| צפניה | `Zephaniah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| חגי | `Haggai` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.80 | yes |  |
| זכריה | `Zechariah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.80 | yes |  |
| מלאכי | `Malachi` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.80 | yes |  |
| תהילים | `Psalms` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| משלי | `Proverbs` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| איוב | `Job` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| שיר השירים | `Song_of_Songs` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.85 | yes |  |
| רות | `Ruth` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.85 | yes |  |
| איכה | `Lamentations` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.80 | yes |  |
| קהלת | `Ecclesiastes` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| אסתר | `Esther` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.87 | yes |  |
| דניאל | `Daniel` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| עזרא | `Ezra` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.83 | yes |  |
| נחמיה | `Nehemiah` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.82 | yes |  |
| דברי הימים א | `I_Chronicles` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.81 | yes |  |
| דברי הימים ב | `II_Chronicles` | `uxlc-2.5` | Unicode/XML Leningrad Codex (UXLC 2.5) | uxlc-free | 0.83 | yes |  |
| משנה ברכות | `Mishnah_Berakhot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה פאה | `Mishnah_Peah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה דמאי | `Mishnah_Demai` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה כלאים | `Mishnah_Kilayim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה שביעית | `Mishnah_Sheviit` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה תרומות | `Mishnah_Terumot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה מעשרות | `Mishnah_Maasrot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה מעשר שני | `Mishnah_Maaser_Sheni` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה חלה | `Mishnah_Challah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.85 | yes |  |
| משנה ערלה | `Mishnah_Orlah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה ביכורים | `Mishnah_Bikkurim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה שבת | `Mishnah_Shabbat` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה עירובין | `Mishnah_Eruvin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה פסחים | `Mishnah_Pesachim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה שקלים | `Mishnah_Shekalim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה יומא | `Mishnah_Yoma` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה סוכה | `Mishnah_Sukkah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה ביצה | `Mishnah_Beitzah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.76 | yes |  |
| משנה ראש השנה | `Mishnah_Rosh_Hashanah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה תענית | `Mishnah_Taanit` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה מגילה | `Mishnah_Megillah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.77 | yes |  |
| משנה מועד קטן | `Mishnah_Moed_Katan` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה חגיגה | `Mishnah_Chagigah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה יבמות | `Mishnah_Yevamot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה כתובות | `Mishnah_Ketubot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה נדרים | `Mishnah_Nedarim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה נזיר | `Mishnah_Nazir` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.78 | yes |  |
| משנה סוטה | `Mishnah_Sotah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה גיטין | `Mishnah_Gittin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה קידושין | `Mishnah_Kiddushin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה בבא קמא | `Mishnah_Bava_Kamma` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה בבא מציעא | `Mishnah_Bava_Metzia` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה בבא בתרא | `Mishnah_Bava_Batra` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה סנהדרין | `Mishnah_Sanhedrin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.78 | yes |  |
| משנה מכות | `Mishnah_Makkot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.78 | yes |  |
| משנה שבועות | `Mishnah_Shevuot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה עדיות | `Mishnah_Eduyot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה עבודה זרה | `Mishnah_Avodah_Zarah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה אבות | `Pirkei_Avot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה הוריות | `Mishnah_Horayot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.79 | yes |  |
| משנה זבחים | `Mishnah_Zevachim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה מנחות | `Mishnah_Menachot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה חולין | `Mishnah_Chullin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה בכורות | `Mishnah_Bekhorot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה ערכין | `Mishnah_Arakhin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה תמורה | `Mishnah_Temurah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה כריתות | `Mishnah_Keritot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה מעילה | `Mishnah_Meilah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה תמיד | `Mishnah_Tamid` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה מדות | `Mishnah_Middot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.84 | yes |  |
| משנה קינים | `Mishnah_Kinnim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה כלים | `Mishnah_Kelim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה אהלות | `Mishnah_Oholot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה נגעים | `Mishnah_Negaim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה פרה | `Mishnah_Parah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.83 | yes |  |
| משנה טהרות | `Mishnah_Tahorot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה מקואות | `Mishnah_Mikvaot` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה נדה | `Mishnah_Niddah` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה מכשירין | `Mishnah_Makhshirin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה זבים | `Mishnah_Zavim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| משנה טבול יום | `Mishnah_Tevul_Yom` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.80 | yes |  |
| משנה ידים | `Mishnah_Yadayim` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| משנה עוקצים | `Mishnah_Oktzin` | `sefaria-torat-emet-357-mishnah` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| שולחן ערוך, אורח חיים | `Shulchan_Arukh__Orach_Chayim` | `sefaria-shulchan-arukh-pd` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| שולחן ערוך, יורה דעה | `Shulchan_Arukh__Yoreh_Deah` | `sefaria-shulchan-arukh-pd` | Torat Emet 357 | public-domain | 0.82 | yes |  |
| שולחן ערוך, אבן העזר | `Shulchan_Arukh__Even_HaEzer` | `sefaria-shulchan-arukh-pd` | Torat Emet 357 | public-domain | 0.84 | yes |  |
| שולחן ערוך, חושן משפט | `Shulchan_Arukh__Choshen_Mishpat` | `sefaria-shulchan-arukh-pd` | Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898 | public-domain | 0.00 | no |  |
| משנה תורה, הלכות יסודי התורה | `Mishneh_Torah__Foundations_of_the_Torah` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות דעות | `Mishneh_Torah__Human_Dispositions` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות תלמוד תורה | `Mishneh_Torah__Torah_Study` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות עבודה זרה וחוקות הגויים | `Mishneh_Torah__Foreign_Worship_and_Customs_of_the_Nations` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות תשובה | `Mishneh_Torah__Repentance` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות קריאת שמע | `Mishneh_Torah__Reading_the_Shema` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 370 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות תפילה וברכת כהנים | `Mishneh_Torah__Prayer_and_the_Priestly_Blessing` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 370 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות שבת | `Mishneh_Torah__Sabbath` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות עירובין | `Mishneh_Torah__Eruvin` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות שביתת עשור | `Mishneh_Torah__Rest_on_the_Tenth_of_Tishrei` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות שביתת יום טוב | `Mishneh_Torah__Rest_on_a_Holiday` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות חמץ ומצה | `Mishneh_Torah__Leavened_and_Unleavened_Bread` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות שופר וסוכה ולולב | `Mishneh_Torah__Shofar__Sukkah_and_Lulav` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות שקלים | `Mishneh_Torah__Sheqel_Dues` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות קידוש החודש | `Mishneh_Torah__Sanctification_of_the_New_Month` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות תעניות | `Mishneh_Torah__Fasts` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות מגילה וחנוכה | `Mishneh_Torah__Scroll_of_Esther_and_Hanukkah` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות אישות | `Mishneh_Torah__Marriage` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות גירושין | `Mishneh_Torah__Divorce` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות יבום וחליצה | `Mishneh_Torah__Levirate_Marriage_and_Release` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות נערה בתולה | `Mishneh_Torah__Virgin_Maiden` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות סוטה | `Mishneh_Torah__Woman_Suspected_of_Infidelity` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות איסורי ביאה | `Mishneh_Torah__Forbidden_Intercourse` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות מאכלות אסורות | `Mishneh_Torah__Forbidden_Foods` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות שחיטה | `Mishneh_Torah__Ritual_Slaughter` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות שבועות | `Mishneh_Torah__Oaths` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות נדרים | `Mishneh_Torah__Vows` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות נזירות | `Mishneh_Torah__Nazariteship` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות ערכים וחרמין | `Mishneh_Torah__Appraisals_and_Devoted_Property` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות כלאים | `Mishneh_Torah__Diverse_Species` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות מתנות עניים | `Mishneh_Torah__Gifts_to_the_Poor` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות תרומות | `Mishneh_Torah__Heave_Offerings` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות מעשרות | `Mishneh_Torah__Tithes` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות מעשר שני ונטע רבעי | `Mishneh_Torah__Second_Tithes_and_Fourth_Years_Fruit` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות ביכורים ושאר מתנות כהונה שבגבולין | `Mishneh_Torah__First_Fruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות שמיטה ויובל | `Mishneh_Torah__Sabbatical_Year_and_the_Jubilee` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות בית הבחירה | `Mishneh_Torah__The_Chosen_Temple` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות כלי המקדש והעובדין בו | `Mishneh_Torah__Vessels_of_the_Sanctuary_and_Those_Who_Serve_Therein` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות ביאת מקדש | `Mishneh_Torah__Admission_into_the_Sanctuary` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות איסורי המזבח | `Mishneh_Torah__Things_Forbidden_on_the_Altar` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות מעשה הקרבנות | `Mishneh_Torah__Sacrificial_Procedure` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות תמידים ומוספין | `Mishneh_Torah__Daily_Offerings_and_Additional_Offerings` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות פסולי המוקדשין | `Mishneh_Torah__Sacrifices_Rendered_Unfit` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות עבודת יום הכפורים | `Mishneh_Torah__Service_on_the_Day_of_Atonement` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות מעילה | `Mishneh_Torah__Trespass` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות קרבן פסח | `Mishneh_Torah__Paschal_Offering` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות חגיגה | `Mishneh_Torah__Festival_Offering` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.79 | yes |  |
| משנה תורה, הלכות בכורות | `Mishneh_Torah__Firstlings` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות שגגות | `Mishneh_Torah__Offerings_for_Unintentional_Transgressions` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות מחוסרי כפרה | `Mishneh_Torah__Offerings_for_Those_with_Incomplete_Atonement` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות תמורה | `Mishneh_Torah__Substitution` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.81 | yes |  |
| משנה תורה, הלכות טומאת מת | `Mishneh_Torah__Defilement_by_a_Corpse` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות פרה אדומה | `Mishneh_Torah__Red_Heifer` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.86 | yes |  |
| משנה תורה, הלכות טומאת צרעת | `Mishneh_Torah__Defilement_by_Leprosy` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות מטמאי משכב ומושב | `Mishneh_Torah__Those_Who_Defile_Bed_or_Seat` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות שאר אבות הטומאות | `Mishneh_Torah__Other_Sources_of_Defilement` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות טומאת אוכלים | `Mishneh_Torah__Defilement_of_Foods` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות כלים | `Mishneh_Torah__Vessels` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות מקואות | `Mishneh_Torah__Immersion_Pools` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות נזקי ממון | `Mishneh_Torah__Damages_to_Property` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות גניבה | `Mishneh_Torah__Theft` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.85 | yes |  |
| משנה תורה, הלכות גזילה ואבידה | `Mishneh_Torah__Robbery_and_Lost_Property` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות חובל ומזיק | `Mishneh_Torah__One_Who_Injures_a_Person_or_Property` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות רוצח ושמירת נפש | `Mishneh_Torah__Murderer_and_the_Preservation_of_Life` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.79 | yes |  |
| משנה תורה, הלכות מכירה | `Mishneh_Torah__Sales` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות זכייה ומתנה | `Mishneh_Torah__Ownerless_Property_and_Gifts` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות שכנים | `Mishneh_Torah__Neighbors` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.82 | yes |  |
| משנה תורה, הלכות שלוחין ושותפין | `Mishneh_Torah__Agents_and_Partners` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות עבדים | `Mishneh_Torah__Slaves` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.79 | yes |  |
| משנה תורה, הלכות שכירות | `Mishneh_Torah__Hiring` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.84 | yes |  |
| משנה תורה, הלכות שאלה ופיקדון | `Mishneh_Torah__Borrowing_and_Deposit` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.86 | yes |  |
| משנה תורה, הלכות מלווה ולווה | `Mishneh_Torah__Creditor_and_Debtor` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות טוען ונטען | `Mishneh_Torah__Plaintiff_and_Defendant` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.83 | yes |  |
| משנה תורה, הלכות נחלות | `Mishneh_Torah__Inheritances` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות סנהדרין והעונשין המסורין להם | `Mishneh_Torah__The_Sanhedrin_and_the_Penalties_within_Their_Jurisdiction` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.79 | yes |  |
| משנה תורה, הלכות עדות | `Mishneh_Torah__Testimony` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות ממרים | `Mishneh_Torah__Rebels` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות אבל | `Mishneh_Torah__Mourning` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| משנה תורה, הלכות מלכים ומלחמות | `Mishneh_Torah__Kings_and_Wars` | `sefaria-mishneh-torah-torat-emet-363` | Torat Emet 363 | public-domain | 0.80 | yes |  |
| מכילתא דרבי שמעון בן יוחאי | `Mekhilta_DeRabbi_Shimon_Ben_Yochai` | `sefaria-collection-midrash-public-domain` | Mechilta de-Rabbi Simon b. Jochai, Dr. D. Hoffman, Frankfurt 1905 | public-domain | 0.00 | no |  |
| שמות רבה | `Shemot_Rabbah` | `sefaria-collection-midrash-public-domain` | Daat Shemot Rabbah | public-domain | 0.00 | no |  |
| רות רבה | `Ruth_Rabbah` | `sefaria-collection-midrash-public-domain` | Midrash Rabbah -- TE | public-domain | 0.78 | yes |  |
| איכה רבה | `Eikhah_Rabbah` | `sefaria-collection-midrash-public-domain` | Midrash Rabbah -- TE | public-domain | 0.76 | yes |  |
| מדרש תנחומא | `Midrash_Tanchuma` | `sefaria-collection-midrash-public-domain` | Midrash Tanchuma -- Torat Emet | public-domain | 0.79 | yes |  |
| תנחומא בובר | `Midrash_Tanchuma_Buber` | `sefaria-collection-midrash-public-domain` | Midrash Tanhuma haKadum veHaYashan, S. Buber, 1885 | public-domain | 0.00 | no |  |
| פרקי דרבי אליעזר | `Pirkei_DeRabbi_Eliezer` | `sefaria-collection-midrash-public-domain` | Pirke DeRabbi Eliezer, Sefaria Vocalized Edition | public-domain | 0.82 | yes |  |
| תנא דבי אליהו זוטא | `Tanna_DeBei_Eliyahu_Zuta` | `sefaria-collection-midrash-public-domain` | Tanna deBei Eliyahu Zuta | public-domain | 0.00 | no |  |
| מדרש תהילים | `Midrash_Tehillim` | `sefaria-collection-midrash-public-domain` | OYW | public-domain | 0.00 | no |  |
| מדרש שמואל | `Midrash_Shmuel` | `sefaria-collection-midrash-public-domain` | Krakow, 1893 | public-domain | 0.00 | no |  |
| אגדת בראשית | `Aggadat_Bereshit` | `sefaria-collection-midrash-public-domain` | Krakow, 1903 | public-domain | 0.00 | no |  |
| משנת רבי אליעזר | `Mishnat_Rabbi_Eliezer` | `sefaria-collection-midrash-public-domain` | New York, 1934 | public-domain | 0.00 | no |  |
| ספרי דאגדתא על מגילת אסתר | `Sifrei_Aggadah_on_Esther` | `sefaria-collection-midrash-public-domain` | Vilna, 1886 | public-domain | 0.00 | no |  |
| סדר עולם רבה | `Seder_Olam_Rabbah` | `sefaria-collection-midrash-public-domain` | Seder Olam, Warsaw 1904 | public-domain | 0.00 | no |  |
| סדר עולם זוטא | `Seder_Olam_Zutta` | `sefaria-collection-midrash-public-domain` | Seder Olam Zuta, Rabbi M. Grossberg. London, 1910 | public-domain | 0.00 | no |  |
| עין יעקב | `Ein_Yaakov` | `sefaria-collection-midrash-public-domain` | Daat | public-domain | 0.65 | yes |  |
| ספר הישר (מדרש) | `Sefer_HaYashar_midrash` | `sefaria-collection-midrash-public-domain` | Sefer HaYashar, Livorno 1870 | public-domain | 0.00 | no |  |
| ספרי במדבר | `Sifrei_Bamidbar` | `sefaria-collection-midrash-cc-by-sa` | Wikisource | cc-by-sa | 0.00 | no |  |
| ספרי דברים | `Sifrei_Devarim` | `sefaria-collection-midrash-cc-by` | Sifre on Deuteronomy, ed. Dr. Louis Finkelstein. JTS, 1969 | cc-by | 0.00 | no |  |
| פסיקתא דרב כהנא | `Pesikta_DeRav_Kahana` | `sefaria-collection-midrash-cc-by` | Pesikta de Rav Kahana according to an Oxford manuscript, Dov Mandelbaum ed., N.Y. 1987 | cc-by | 0.00 | no |  |
| ירושלמי ברכות | `Jerusalem_Talmud_Berakhot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי פאה | `Jerusalem_Talmud_Peah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי דמאי | `Jerusalem_Talmud_Demai` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי כלאים | `Jerusalem_Talmud_Kilayim` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי שביעית | `Jerusalem_Talmud_Sheviit` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי תרומות | `Jerusalem_Talmud_Terumot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי מעשרות | `Jerusalem_Talmud_Maasrot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי מעשר שני | `Jerusalem_Talmud_Maaser_Sheni` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי חלה | `Jerusalem_Talmud_Challah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי ערלה | `Jerusalem_Talmud_Orlah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי בכורים | `Jerusalem_Talmud_Bikkurim` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי שבת | `Jerusalem_Talmud_Shabbat` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי עירובין | `Jerusalem_Talmud_Eruvin` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי פסחים | `Jerusalem_Talmud_Pesachim` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי יומא | `Jerusalem_Talmud_Yoma` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי שקלים | `Jerusalem_Talmud_Shekalim` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי סוכה | `Jerusalem_Talmud_Sukkah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי ראש השנה | `Jerusalem_Talmud_Rosh_Hashanah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי ביצה | `Jerusalem_Talmud_Beitzah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי תענית | `Jerusalem_Talmud_Taanit` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי מגי��ה | `Jerusalem_Talmud_Megillah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי חגיגה | `Jerusalem_Talmud_Chagigah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי מועד קטן | `Jerusalem_Talmud_Moed_Katan` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי יבמות | `Jerusalem_Talmud_Yevamot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי סוטה | `Jerusalem_Talmud_Sotah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי כתובות | `Jerusalem_Talmud_Ketubot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי נדרים | `Jerusalem_Talmud_Nedarim` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי נזיר | `Jerusalem_Talmud_Nazir` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי גיטין | `Jerusalem_Talmud_Gittin` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי קידושין | `Jerusalem_Talmud_Kiddushin` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.79 | yes |  |
| ירושלמי בבא קמא | `Jerusalem_Talmud_Bava_Kamma` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי בבא מציעא | `Jerusalem_Talmud_Bava_Metzia` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי בבא בתרא | `Jerusalem_Talmud_Bava_Batra` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.76 | yes |  |
| ירושלמי סנהדרין | `Jerusalem_Talmud_Sanhedrin` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי שבועות | `Jerusalem_Talmud_Shevuot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי עבודה זרה | `Jerusalem_Talmud_Avodah_Zarah` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.78 | yes |  |
| ירושלמי מכות | `Jerusalem_Talmud_Makkot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| ירושלמי הוריות | `Jerusalem_Talmud_Horayot` | `sefaria-collection-talmud-cc-by` | The Jerusalem Talmud, edition by Heinrich W. Guggenheimer. Berlin, De Gruyter, 1999-2015 | cc-by | 0.77 | yes |  |
| אבות דרבי נתן | `Avot_DeRabbi_Natan` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| אבות דרבי נתן נוסח ב | `Avot_DeRabbi_Natan_Recension_B` | `sefaria-collection-talmud-public-domain` | Vienna, 1887 | public-domain | 0.00 | no |  |
| מסכת סופרים | `Tractate_Soferim` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת שמחות | `Tractate_Semachot` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת כלה רבתי | `Tractate_Kallah_Rabbati` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת דרך ארץ רבה | `Tractate_Derekh_Eretz_Rabbah` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת דרך ארץ זוטא | `Tractate_Derekh_Eretz_Zuta` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת כלה | `Tractate_Kallah` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת גרים | `Tractate_Gerim` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| מסכת עבדים | `Tractate_Avadim` | `sefaria-collection-talmud-public-domain` | Talmud Bavli, Vilna 1883 ed. | public-domain | 0.00 | no |  |
| שאילתות דרב אחאי גאון | `Sheiltot_dRav_Achai_Gaon` | `sefaria-collection-halacha-public-domain` | Sheiltot d'Rav Achai Gaon; Vilna, 1861 | public-domain | 0.00 | no |  |
| בעלי הנפש | `Baalei_HaNefesh` | `sefaria-collection-halacha-public-domain` | Vilna, 1911 | public-domain | 0.00 | no |  |
| ספר התרומה | `Sefer_HaTerumah` | `sefaria-collection-halacha-public-domain` | Warsaw, 1897 | public-domain | 0.00 | no |  |
| שבלי הלקט | `Shibbolei_HaLeket` | `sefaria-collection-halacha-public-domain` | Buber Edition, Vilna, 1886 | public-domain | 0.00 | no |  |
| אבודרהם | `Abudarham` | `sefaria-collection-halacha-public-domain` | Abudarham. Lisbon, 1489. | public-domain | 0.00 | no |  |
| ספר חסידים | `Sefer_Chasidim` | `sefaria-collection-halacha-public-domain` | Sefer Chassidim, Zhitomir, 1857 | public-domain | 0.00 | no |  |
| טור | `Tur` | `sefaria-collection-halacha-public-domain` | Orach Chaim, Vilna, 1923 · Yoreh Deah, Vilna, 1923 · Even HaEzer, Vilna, 1923 · Choshen Mishpat, Vilna, 1923 | public-domain | 0.00 | no |  |
| קיצור שלחן ערוך | `Kitzur_Shulchan_Arukh` | `sefaria-collection-halacha-public-domain` | Torat Emet 357 | public-domain | 0.81 | yes |  |
| חיי אדם | `Chayyei_Adam` | `sefaria-collection-halacha-public-domain` | Chayei Adam, Vilna, 1844 | public-domain | 0.00 | no |  |
| בן איש חי | `Ben_Ish_Hai` | `sefaria-collection-halacha-public-domain` | Ben Ish Chai, Jerusalem, 1898 · Ben Ish Hai -- Wikisource | public-domain | 0.00 | no |  |
| מטה אפרים | `Mateh_Efrayim` | `sefaria-collection-halacha-public-domain` | Mateh Efrayim, Warsaw, 1906 | public-domain | 0.00 | no |  |
| סדר היום | `Seder_HaYom` | `sefaria-collection-halacha-public-domain` | Warsaw, 1876 | public-domain | 0.00 | no |  |
| אהבת חסד | `Ahavat_Chesed` | `sefaria-collection-halacha-public-domain` | Ahavat Chesed -- Torat Emet | public-domain | 0.00 | no |  |
| סידור רש"י | `Siddur_Rashi` | `sefaria-collection-halacha-public-domain` | Buber Edition, Berlin, 1912 | public-domain | 0.00 | no |  |
| ספר האורה | `Sefer_HaOrah` | `sefaria-collection-halacha-public-domain` | Lviv, 1905 | public-domain | 0.00 | no |  |
| לקט יושר | `Leket_Yosher` | `sefaria-collection-halacha-public-domain` | Berlin, 1903 | public-domain | 0.00 | no |  |
| תשב"ץ קטן | `Tashbetz_Katan` | `sefaria-collection-halacha-public-domain` | Warsaw, 1902 | public-domain | 0.00 | no |  |
| מורה באצבע | `Moreh_BeEtzba` | `sefaria-collection-halacha-public-domain` | Moreh BeEtzba, Livorno, 1842 | public-domain | 0.00 | no |  |
| קסת הסופר | `Keset_HaSofer` | `sefaria-collection-halacha-public-domain` | Keset Hasofer, Ungvar 1871 | public-domain | 0.00 | no |  |
| שב שמעתתא | `Shev_Shmateta` | `sefaria-collection-halacha-public-domain` | Shev Shmatta | public-domain | 0.00 | no |  |
| מעשה רב | `Maaseh_Rav` | `sefaria-collection-halacha-cc-by-sa` | Wikisource | cc-by-sa | 0.00 | no |  |
| חפץ חיים | `Chafetz_Chaim` | `sefaria-collection-halacha-cc-by-sa` | Chofetz Chaim | cc-by-sa | 0.62 | yes |  |
| ספר מצוות גדול | `Sefer_Mitzvot_Gadol` | `sefaria-collection-mitzvot-public-domain` | Munkatch, 1901 | public-domain | 0.00 | no |  |
| ספר מצוות קטן | `Sefer_Mitzvot_Katan` | `sefaria-collection-mitzvot-public-domain` | Sefer Mitzvot Katan, Kopys, 1820 | public-domain | 0.00 | no |  |
| ספר יראים | `Sefer_Yereim` | `sefaria-collection-mitzvot-public-domain` | Sefer Yereim HaShalem, Vilna, 1892-1901 | public-domain | 0.00 | no |  |
| ספר המצוות לרס"ג | `Sefer_Hamitzvot_of_Rasag` | `sefaria-collection-mitzvot-public-domain` | Sefer Hamitzvot L'Rasag, Warsaw, 1914. Vocalized Edition | public-domain | 0.85 | yes |  |
| קיצור ספר חרדים | `Kitzur_Sefer_Haredim_of_Rabbi_Elazar_Azcari` | `sefaria-collection-mitzvot-public-domain` | קיצור ספר חרדים רבי אלעזר אזכרי | public-domain | 0.00 | no |  |
| הכוזרי | `Kuzari` | `sefaria-collection-machshava-cc-by-sa` | Sefer haKuzari - Project Ben-Yehuda | cc-by-sa | 0.83 | yes |  |
| מאמר העיקרים | `Essay_on_Fundamentals` | `sefaria-collection-machshava-cc-by-sa` | Maamar HaIkarim - Wikisource | cc-by-sa | 0.00 | no |  |
| מילות הגיון | `Treatise_on_Logic` | `sefaria-collection-machshava-cc-by-sa` | Milot Higayon, Warsaw, 1928 | cc-by-sa | 0.00 | no |  |
| מורה נבוכים | `Guide_for_the_Perplexed` | `sefaria-collection-machshava-public-domain` | Moreh Nevuchim, translated by Ibn Tibon | public-domain | 0.00 | no |  |
| שמונה פרקים | `Eight_Chapters` | `sefaria-collection-machshava-public-domain` | Wikisource | public-domain | 0.00 | no |  |
| אור ה' | `Ohr_Hashem` | `sefaria-collection-machshava-public-domain` | Vienna, 1859 | public-domain | 0.00 | no |  |
| גבורות השם | `Gevurot_Hashem` | `sefaria-collection-machshava-public-domain` | Gevurot Hashem, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 2015-2020 | public-domain | 0.00 | no |  |
| נתיבות עולם | `Netivot_Olam` | `sefaria-collection-machshava-public-domain` | Netivot Olam, Netiv Hatorah, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 2012 · OYW · Netivot Olam, Netiv Hateshuva, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 1997 | public-domain | 0.00 | no |  |
| נצח ישראל | `Netzach_Yisrael` | `sefaria-collection-machshava-public-domain` | Netzach Yisrael, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 1997 | public-domain | 0.00 | no |  |
| באר הגולה | `Beer_HaGolah` | `sefaria-collection-machshava-public-domain` | Be'er HaGolah, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 2002 | public-domain | 0.00 | no |  |
| נר מצוה | `Ner_Mitzvah` | `sefaria-collection-machshava-public-domain` | Ner Mitzvah, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 2012 | public-domain | 0.00 | no |  |
| נפש החיים | `Nefesh_HaChayim` | `sefaria-collection-machshava-public-domain` | Vilna, 1874 | public-domain | 0.00 | no |  |
| בית אלהים | `Beit_Elohim` | `sefaria-collection-machshava-public-domain` | Warsaw, 1872 | public-domain | 0.00 | no |  |
| אגרות צפון | `Nineteen_Letters` | `sefaria-collection-machshava-public-domain` | Iggerot Tzfun, Vilna 1890 | public-domain | 0.00 | no |  |
| יסוד מורא וסוד תורה | `Yesod_Mora_VeSod_HaTorah` | `sefaria-collection-machshava-public-domain` | Yesod Mora; Hokhmat Yisra'el, Jerusalem 1931 | public-domain | 0.00 | no |  |
| ספר העקרים | `Sefer_HaIkkarim` | `sefaria-collection-machshava-cc-by` | Sefer Ha-'ikkarim | cc-by | 0.00 | no |  |
| צורת בית המקדש | `The_Third_Beit_HaMikdash` | `sefaria-collection-machshava-cc-by` | Tzurat Beit HaMikdash, by Rabbi Yom Tov Lippman Heller, Moznaim Pub Corp. 2016 | cc-by | 0.81 | yes |  |
| תפארת ישראל | `Tiferet_Yisrael` | `sefaria-collection-machshava-cc-by-nc` | Tiferet Yisrael, with footnotes and annotations by Rabbi Yehoshua D. Hartman, Machon Yerushalyim, 2010 | cc-by-nc | 0.00 | no |  |
| פרשת דרכים | `Parashat_Derakhim` | `sefaria-collection-machshava-cc-by-nc` | Jerusalem, 2005 | cc-by-nc | 0.77 | yes |  |
| אגרת הרמב"ן | `Iggeret_HaRamban` | `sefaria-collection-mussar-cc-by-sa` | HeWiki | cc-by-sa | 0.83 | yes |  |
| שער הגמול - רמב''ן | `Shaar_HaGemul_of_the_Ramban` | `sefaria-collection-mussar-public-domain` | שער הגמול - רמב''ן | public-domain | 0.00 | no |  |
| מבחר הפנינים | `Mivchar_HaPeninim` | `sefaria-collection-mussar-public-domain` | Mivchar Hapeninim, London 1859 | public-domain | 0.00 | no |  |
| מעלות המדות | `Maalot_HaMiddot` | `sefaria-collection-mussar-public-domain` | Warsaw, 1887 | public-domain | 0.00 | no |  |
| כד הקמח | `Kad_HaKemach` | `sefaria-collection-mussar-public-domain` | Kad HaKemach, Warsaw 1872 | public-domain | 0.00 | no |  |
| בחינת עולם | `Bechinat_Olam` | `sefaria-collection-mussar-public-domain` | Bechinat Olam, Vilna 1879 | public-domain | 0.83 | yes |  |
| אורחות חיים להרא"ש | `Orchot_Chaim_LHaRosh` | `sefaria-collection-mussar-public-domain` | Orchot Chaim -- TE | public-domain | 0.85 | yes |  |
| יסוד היראה | `Yesod_HaYirah` | `sefaria-collection-mussar-public-domain` | Yesod hayirah, London 1919 | public-domain | 0.00 | no |  |
| אגרת הגר"א | `Iggeret_HaGra` | `sefaria-collection-mussar-public-domain` | Iggeret HaGra -- Wikisource | public-domain | 0.00 | no |  |
| אור ישראל | `Ohr_Yisrael` | `sefaria-collection-mussar-public-domain` | Ohr Yisrael, Vilna 1900 | public-domain | 0.00 | no |  |
| קב הישר | `Kav_HaYashar` | `sefaria-collection-mussar-cc-by` | Kav HaYashar, Metsudah Publications, 2007 | cc-by | 0.82 | yes |  |
| ספר יצירה | `Sefer_Yetzirah` | `sefaria-collection-kabbalah-public-domain` | Sefer Yetzirah, Warsaw 1884 | public-domain | 0.00 | no |  |
| ספר הבהיר | `Sefer_HaBahir` | `sefaria-collection-kabbalah-public-domain` | Torat Emet Sefer HaBahir | public-domain | 0.00 | no |  |
| תקוני הזהר | `Tikkunei_Zohar` | `sefaria-collection-kabbalah-public-domain` | Tikkunei Zohar - Vocalized | public-domain | 0.73 | yes |  |
| זוהר חדש | `Zohar_Chadash` | `sefaria-collection-kabbalah-public-domain` | Zohar Chadash | public-domain | 0.78 | yes |  |
| שערי אורה | `Shaarei_Orah` | `sefaria-collection-kabbalah-public-domain` | Shaarei Orah, grimoar | public-domain | 0.00 | no |  |
| שערי קדושה | `Shaarei_Kedusha` | `sefaria-collection-kabbalah-public-domain` | Shaarei Kedusha | public-domain | 0.00 | no |  |
| שער ההקדמות | `Shaar_HaHakdamot` | `sefaria-collection-kabbalah-public-domain` | Jerusalem, 1909 | public-domain | 0.00 | no |  |
| שער הגלגולים | `Shaar_HaGilgulim` | `sefaria-collection-kabbalah-public-domain` | Shaar HaGilgulim | public-domain | 0.00 | no |  |
| שער המצוות | `Shaar_HaMitzvot` | `sefaria-collection-kabbalah-public-domain` | Jerusalem, 1872 | public-domain | 0.00 | no |  |
| שער רוח הקודש | `Shaar_Ruach_HaKodesh` | `sefaria-collection-kabbalah-public-domain` | Jerusalem, 1863 | public-domain | 0.01 | no |  |
| פרי עץ חיים | `Pri_Etz_Chaim` | `sefaria-collection-kabbalah-public-domain` | Pri Etz Chaim | public-domain | 0.00 | no |  |
| אור נערב | `Ohr_Neerav` | `sefaria-collection-kabbalah-public-domain` | Or Neerav -- grimoar · Or Neerav, Furth 1701. | public-domain | 0.00 | no |  |
| מגיד מישרים | `Maggid_Meisharim` | `sefaria-collection-kabbalah-public-domain` | Maggid Meisharim - Torat Emet | public-domain | 0.00 | no |  |
| חסד לאברהם | `Chesed_LeAvraham` | `sefaria-collection-kabbalah-public-domain` | Chesed le-Avraham -- grimoar | public-domain | 0.00 | no |  |
| שקל הקדש | `Shekel_HaKodesh` | `sefaria-collection-kabbalah-public-domain` | Shekel Hakodesh, London 1919 | public-domain | 0.00 | no |  |
| עשרה פרקים להרמח''ל | `Asarah_Perakim_LeRamchal` | `sefaria-collection-kabbalah-public-domain` | Assarah Perakim -- Torat Emet | public-domain | 0.00 | no |  |
| שער מאמרי רשב"י | `Shaar_Maamarei_Rashbi` | `sefaria-collection-kabbalah-public-domain` | Shaar Maamarei Rashbi | public-domain | 0.00 | no |  |
| שער מאמרי רז"ל | `Shaar_Maamarei_Razal` | `sefaria-collection-kabbalah-public-domain` | Shaar Maamarei Razal | public-domain | 0.00 | no |  |
| דרך עץ חיים (רמח"ל) | `Derech_Etz_Chayim_Ramchal` | `sefaria-collection-kabbalah-cc-by-sa` | Derech Etz Chayim - Wikisource | cc-by-sa | 0.00 | no |  |
| צוואת הריב"ש | `Tzavaat_HaRivash` | `sefaria-collection-chassidut-public-domain` | Warsaw, 1913 | public-domain | 0.00 | no |  |
| שבחי הבעש"ט | `Shivchei_HaBesht` | `sefaria-collection-chassidut-public-domain` | Shivchei HaBesht, Kopyst 1815 | public-domain | 0.00 | no |  |
| בעל שם טוב על התורה | `Baal_Shem_Tov` | `sefaria-collection-chassidut-public-domain` | Sefer Baal Shem Tov. Lodz, 1938 | public-domain | 0.00 | no |  |
| מגיד דבריו ליעקב | `Maggid_Devarav_leYaakov` | `sefaria-collection-chassidut-public-domain` | Maggid Devarav leYa'akov, Koretz, 1781 | public-domain | 0.00 | no |  |
| דגל מחנה אפרים | `Degel_Machaneh_Ephraim` | `sefaria-collection-chassidut-public-domain` | Degel Machaneh Ephraim, Korets, 1810 | public-domain | 0.00 | no |  |
| מאור עינים | `Meor_Einayim` | `sefaria-collection-chassidut-public-domain` | Me'or Einayim -- OYW | public-domain | 0.00 | no |  |
| קדושת לוי | `Kedushat_Levi` | `sefaria-collection-chassidut-public-domain` | Kedushat Levi - Munkatch 1939 | public-domain | 0.00 | no |  |
| אור המאיר | `Ohr_HaMeir` | `sefaria-collection-chassidut-public-domain` | Warsaw, 1883 | public-domain | 0.00 | no |  |
| אוהב ישראל | `Ohev_Yisrael` | `sefaria-collection-chassidut-public-domain` | Ohev Yisrael, Zhitomir, 1863. | public-domain | 0.00 | no |  |
| עבודת ישראל | `Avodat_Yisrael` | `sefaria-collection-chassidut-public-domain` | Avodat Yisrael; Konigsberg, c. 1860. | public-domain | 0.00 | no |  |
| מאור ושמש | `Maor_VaShemesh` | `sefaria-collection-chassidut-public-domain` | Maor Vashemesh, Breslau, 1842 | public-domain | 0.00 | no |  |
| תפארת שלמה | `Tiferet_Shlomo` | `sefaria-collection-chassidut-public-domain` | Tiferet Shlomo, Warsaw, 1867 | public-domain | 0.00 | no |  |
| ישמח משה | `Yismach_Moshe` | `sefaria-collection-chassidut-public-domain` | Yismach Moshe, Sighet, 1898 | public-domain | 0.00 | no |  |
| ערבי נחל | `Arvei_Nachal` | `sefaria-collection-chassidut-public-domain` | Arvei Nachal, Jerusalem, 1991 | public-domain | 0.00 | no |  |
| בית אהרן | `Beit_Aharon` | `sefaria-collection-chassidut-public-domain` | Beit Aharon, Brody, 1875. | public-domain | 0.00 | no |  |
| זרע קודש | `Zera_Kodesh` | `sefaria-collection-chassidut-public-domain` | Lʹviv, 1868 | public-domain | 0.00 | no |  |
| סוד ישרים | `Sod_Yesharim` | `sefaria-collection-chassidut-public-domain` | Sod Yesharim, Warsaw 1902-1908 | public-domain | 0.00 | no |  |
| שפת אמת | `Sefat_Emet` | `sefaria-collection-chassidut-public-domain` | Sefat emet, Piotrków, 1905-1908 | public-domain | 0.00 | no |  |
| חיי מוהר"ן | `Chayei_Moharan` | `sefaria-collection-chassidut-public-domain` | OYW | public-domain | 0.83 | yes |  |
| פרי צדיק | `Peri_Tzadik` | `sefaria-collection-chassidut-public-domain` | Pri Tzaddik, Lublin, 1901 | public-domain | 0.00 | no |  |
| ישראל קדושים | `Yisrael_Kedoshim` | `sefaria-collection-chassidut-public-domain` | R' Zadok -- Yisrael Kedoshim | public-domain | 0.00 | no |  |
| רסיסי לילה | `Resisei_Layla` | `sefaria-collection-chassidut-public-domain` | R' Zadok -- Resisei Layla | public-domain | 0.00 | no |  |
| הכשרת האברכים | `Hakhsharat_HaAvrekhim` | `sefaria-collection-chassidut-public-domain` | Hakhsharat haAvrekhim, 16. Ring. 11-432 | public-domain | 0.00 | no |  |
| צו וזרוז | `Tzav_VeZeruz` | `sefaria-collection-chassidut-public-domain` | Ring. II 431 | public-domain | 0.00 | no |  |
| מבוא השערים | `Mevo_HaShearim` | `sefaria-collection-chassidut-public-domain` | Hakhsharat haAkhrakhim, 16. Ring. 11-432 | public-domain | 0.00 | no |  |
| דברי אמת | `Divrei_Emet` | `sefaria-collection-chassidut-public-domain` | Divrei Emet, Zalkowa 1801 | public-domain | 0.00 | no |  |
| מדרש פנחס | `Midrash_Pinchas` | `sefaria-collection-chassidut-public-domain` | Biłgoraj, 1930 | public-domain | 0.00 | no |  |
| דובר צדק | `Dover_Tzedek` | `sefaria-collection-chassidut-public-domain` | R' Zadok -- Dover Tzedek | public-domain | 0.00 | no |  |
| תשובות הגאונים (הרכבי) | `Teshuvot_HaGeonim_Harkavy` | `sefaria-collection-responsa-public-domain` | Berlin, 1887 | public-domain | 0.00 | no |  |
| אגרת רב שרירא גאון | `Epistle_of_Rav_Sherira_Gaon` | `sefaria-collection-responsa-public-domain` | Seder HaChachamim. Oxford, 1888 | public-domain | 0.00 | no |  |
| תשובות הרמב"ם | `Teshuvot_HaRambam` | `sefaria-collection-responsa-public-domain` | Leipzig: H.L. Shnuis, 1859 | public-domain | 0.00 | no |  |
| איגרות הרמב"ם | `Iggerot_HaRambam` | `sefaria-collection-responsa-public-domain` | Kobetz Teshuvot HaRambam, 1859 | public-domain | 0.00 | no |  |
| תשובות הר"י מיגאש | `Teshuvot_HaRi_Migash` | `sefaria-collection-responsa-public-domain` | R. Yosef Ibn Migash Responsa, Warsaw, 1870 | public-domain | 0.00 | no |  |
| שו"ת הר"ן | `Teshuvot_HaRan` | `sefaria-collection-responsa-public-domain` | Warsaw, 1882 | public-domain | 0.00 | no |  |
| תשובות הריב"ש | `Teshuvot_HaRivash` | `sefaria-collection-responsa-public-domain` | Rivash Responsa, Vilna, 1879 | public-domain | 0.00 | no |  |
| תרומת הדשן | `Terumat_HaDeshen` | `sefaria-collection-responsa-public-domain` | Warsaw 1882 | public-domain | 0.00 | no |  |
| שו"ת מהרי"ק | `Teshuvot_Maharik` | `sefaria-collection-responsa-public-domain` | Responsa Maharik, Warsaw 1884 | public-domain | 0.00 | no |  |
| שו"ת מהרי"ל | `Teshuvot_Maharil` | `sefaria-collection-responsa-public-domain` | She'elot uTeshuvot Maharil. Krakow, 1881 | public-domain | 0.00 | no |  |
| אבקת רוכל | `Avkat_Rokhel` | `sefaria-collection-responsa-public-domain` | Leipzig, 1859 | public-domain | 0.00 | no |  |
| שו"ת מהרשד"ם | `Responsa_Maharashdam` | `sefaria-collection-responsa-public-domain` | She'elot uTeshuvot Maharashdam, Lemberg, 1862 | public-domain | 0.00 | no |  |
| שאלות ותשובות רמ"א | `Responsa_of_Rema` | `sefaria-collection-responsa-public-domain` | Sheelot uTeshuvut Remah, Warsaw, 1883 | public-domain | 0.00 | no |  |
| חוות יאיר | `Havot_Yair` | `sefaria-collection-responsa-public-domain` | Chavot Yair, Lemberg, 1896 | public-domain | 0.00 | no |  |
| נודע ביהודה מהדורא תנינא | `Noda_BiYehudah_II` | `sefaria-collection-responsa-public-domain` | Noda Bi-Yehudah Part II; Warsaw, 1880 | public-domain | 0.00 | no |  |
| תשובות רבי עקיבא איגר | `Teshuvot_Rabbi_Akiva_Eiger` | `sefaria-collection-responsa-public-domain` | Warsaw, 1901 | public-domain | 0.00 | no |  |
| בנין ציון | `Binyan_Tziyon` | `sefaria-collection-responsa-public-domain` | Binyan Tziyon, Altona, 1868 | public-domain | 0.00 | no |  |
| שו"ת רב פעלים | `Responsa_Rav_Pealim` | `sefaria-collection-responsa-public-domain` | Rav Pealim, Jerusalem 1901-1912 | public-domain | 0.00 | no |  |
| שו"ת מהר"ם פדוואה | `Responsa_Maharam_of_Padua` | `sefaria-collection-responsa-public-domain` | Krakow, 1882 | public-domain | 0.00 | no |  |
| מחברת מנחם | `Machberet_Menachem` | `sefaria-collection-reference-public-domain` | Mahberet Menahem, London, 1854. | public-domain | 0.00 | no |  |
| ספר הבחור | `Sefer_HaBachur` | `sefaria-collection-reference-public-domain` | Sefer haBahur, Isny 1542-Mantua, 1556. | public-domain | 0.03 | no |  |
| שם הגדולים, מערכת ספרים | `Shem_HaGedolim_Maarekhet_Sefarim` | `sefaria-collection-reference-public-domain` | Podgorze, 1905 (Wikisource edition) | public-domain | 0.00 | no |  |
| שפת יתר | `Sefat_Yeter` | `sefaria-collection-reference-public-domain` | Sefer Sefat Yeter, Warsaw 1895 | public-domain | 0.05 | no |  |
| הגדה של פסח | `Pesach_Haggadah` | `sefaria-collection-tefillah-public-domain` | Pesach Haggadah | public-domain | 0.78 | yes |  |
| ילקוט שמעוני על התורה | `Yalkut_Shimoni_on_Torah` | `sefaria-collection-midrash-cc-by-nc` | Torat Emet | cc-by-nc | 0.79 | yes |  |
| שולחן ערוך הרב | `Shulchan_Arukh_HaRav` | `sefaria-collection-halacha-cc-by-nc` | Kehot Publication Society | cc-by-nc | 0.00 | no |  |
| ראשית חכמה | `Reshit_Chokhmah` | `sefaria-collection-mussar-cc-by-nc` | Hamesorah Publishers, Jerusalem 2005 | cc-by-nc | 0.00 | no |  |
| תניא | `Tanya` | `sefaria-collection-chassidut-cc-by-nc` | Kehot Publication Society | cc-by-nc | 0.83 | yes |  |
| לקוטי תורה | `Likkutei_Torah` | `sefaria-collection-chassidut-cc-by-nc` | Kehot Publication Society | cc-by-nc | 0.00 | no |  |
| תורה אור | `Torah_Ohr` | `sefaria-collection-chassidut-cc-by-nc` | Kehot Publication Society | cc-by-nc | 0.00 | no |  |
| דרך מצותיך | `Derekh_Mitzvotekha` | `sefaria-collection-chassidut-cc-by-nc` | Kehot Publication Society | cc-by-nc | 0.00 | no |  |
| בת עין | `Bat_Ayin` | `sefaria-collection-chassidut-cc-by-nc` | Jerusalem, 2001 | cc-by-nc | 0.00 | no |  |
| חיים וחסד | `Chayyim_VaChesed` | `sefaria-collection-chassidut-cc-by-nc` | Chayim VeChesed - Hamesorah publishers, c. 2005 | cc-by-nc | 0.00 | no |  |
| אור לשמים | `Ohr_LaShamayim` | `sefaria-collection-chassidut-cc-by-nc` | Jerusalem, 2013 | cc-by-nc | 0.00 | no |  |
| שניים מקרא · Genesis | `shnayim.Genesis` | `shnayim-mikra-sefaria-pd` | Tanach with Ta'amei Hamikra + Onkelos (Torat Emet) | public-domain | 0.82 | yes |  |
| שניים מקרא · Exodus | `shnayim.Exodus` | `shnayim-mikra-sefaria-pd` | Tanach with Ta'amei Hamikra + Onkelos (Torat Emet) | public-domain | 0.81 | yes |  |
| שניים מקרא · Leviticus | `shnayim.Leviticus` | `shnayim-mikra-sefaria-pd` | Tanach with Ta'amei Hamikra + Onkelos (Torat Emet) | public-domain | 0.81 | yes |  |
| שניים מקרא · Numbers | `shnayim.Numbers` | `shnayim-mikra-sefaria-pd` | Tanach with Ta'amei Hamikra + Onkelos (Torat Emet) | public-domain | 0.81 | yes |  |
| שניים מקרא · Deuteronomy | `shnayim.Deuteronomy` | `shnayim-mikra-sefaria-pd` | Tanach with Ta'amei Hamikra + Onkelos (Torat Emet) | public-domain | 0.81 | yes |  |

<!-- nikud-audit:end -->
