# Nusach Ashkenaz — Birnbaum *HaSiddur HaShalem* (1949) import (Hebrew Wikisource page transcription)

A second licensed edition of the Ashkenaz rite, beside the Metsudah pack, used **only** for what the Metsudah edition
does not print. Same precedent as Chabad's Tehillat Hashem (`chabad-tehillat-hashem-import.md`): its own pack, its own
manifest entry, its own addresses; the compositions reach it by those addresses.

- **Approval:** the owner approved the CC BY-SA 4.0 Wikisource transcription with attribution (2026-09-29).
- **Source:** `sources/birnbaum-ashkenaz/raw/` (README there). Only `עמוד:` pages, rendered at a pinned revision.
- **Build:** `node scripts/build-birnbaum-ashkenaz.mjs [--fetch] [--report <file.json>]`. Deterministic (same cache →
  same bytes). The build refuses a page whose status is not "proofread" (3) or "validated" (4), a page with a
  double-rule addition (the Wikisource editors' mark for Land of Israel additions), and a footnote marker inside text.
- **Output:** `src/data/nusach/siddurAshkenazBirnbaum.mjs` (≈135 kB, its own chunk; loaded with the Ashkenaz pack through
  `registry.mjs` `extras`) and `sources/birnbaum-ashkenaz/provenance.json`.
- **Shape:** the Sefaria pack shape (`{ source, schema: { nodes }, texts }`); index **"HaSiddur HaShalem Birnbaum"**
  (`הסידור השלם (בירנבוים)`); each `texts[ref]` also carries `pages: [{ bookPage, url, revid, status }]` — its own source.

## What was imported

| Leaf (`HaSiddur HaShalem Birnbaum, …`) | Printed pages | Status | Used in |
|---|---|---|---|
| Kabbalat Shabbat, Bameh Madlikin (Mishnah Shabbat 2, 1–7) | 251–253 | proofread | kabbalat-shabbat `bameh-madlikin` |
| Kabbalat Shabbat, Amar Rabbi Elazar (Berachot 64a) | 253–255 | proofread | kabbalat-shabbat `rabbi-elazar` |
| Shabbat Shacharit, Torah Service, Al HaKol (על הכל, ש"ץ: אב הרחמים הוא ירחם) | 367 | proofread | shabbat-shacharit `al-hakol`, `av-harachamim-hu` |
| Shabbat Mincha, Shir HaMaalot (Psalms 120–134) | 467–475 | proofread (473 validated) | shabbat-mincha `shir-hamaalot` |
| Pirkei Avot, Chapter 1 … Chapter 6 (each: כל ישראל, the chapter, רבי חנניא) | 477–533 | proofread | shabbat-mincha `pirkei-avot-1` … `-6` |
| Motzaei Shabbat, Veyiten Lecha (through Psalm 128) | 541–549 | proofread | weekday-maariv `veyiten-lecha` |

Not imported from those pages (Metsudah has them, or they are not needed): Birnbaum's Kaddish DeRabbanan (p. 255 — the
Metsudah edition's own Kabbalat Shabbat Kaddish DeRabbanan leaf is used), רוממו and ויעזור (p. 367), the end of Psalm 104
(p. 467), the Kaddish Shalem of Motzaei Shabbat (p. 541), the chapter headings and the title "פרקי אבות" (they became the
leaves' titles). Per page: `provenance.json` `notImported`.

## Transformations (markup only)

1. The page body is the rendered `div` of the Page; the running head (page number and title) and the proofreading
   banner are dropped.
2. Links (source lines such as "משנה שבת, פרק ב", psalm numbers) are unwrapped: 19 links.
3. A paragraph that runs over a page break is joined with one space (12 joins), only when the next page neither opens
   a new paragraph (`{{פסקה חדשה בתחילת העמוד}}`) nor starts with a heading or source line, and its first transcluded
   section is the numbered continuation of the previous page's last one (checked).
4. The Wikisource editors' Hebrew renderings of Birnbaum's English directions ("אין אומרים 'במה מדליקין' ביום טוב",
   "אומרים 'פרקי אבות' בשבתות בקיץ…"), his source lines and the Reader marks ("ש"ץ:", "(ש"ץ)") become
   `<small class="direction">` — the reader shows them as the edition's notes, never as prayer, and reads no condition
   from them (`services/siddurBlocks.mjs`). 9 inline marks; one empty direction (p. 541, not yet supplied by the base
   page) dropped.
5. One right-to-left mark (U+200F, p. 543) removed. Nothing else: no NFC/NFD, no change of letters, points, maqaf or
   punctuation. Birnbaum's bold mishnah numbers stay `<b>`.

The test `tests/birnbaumAshkenaz.test.mjs` checks that every paragraph of the pack is found verbatim on its pages.

## The transcription is not a facsimile of the 1949 print

Wikisource's editing principles (`ויקיטקסט:הסידור השלם (בירנבוים)`, "עקרונות עריכה") for the Page namespace: the prayers
follow Birnbaum's letters, points and punctuation, except that **quoted verses follow "Mikra al pi ha-Masorah"**
(letters and points; Birnbaum's punctuation), **qamats qatan** (ׇ) and **holam haser for vav** (ֺ) are marked, a hyphen
is written in הַלְלוּ־יָהּ, and a maqaf is added in some places. Every such departure the editors recorded with
`{{נוסח|shown|…|בירנבוים=printed}}` is listed in `provenance.json` (`pages[].variants`; 84 notes on the imported pages,
48 of them giving Birnbaum's printed reading). The text is kept **as transcribed**; the manifest says `modified: true`
and describes this.

## Composition and conditions (`src/data/nusach/compositions/ashkenaz.mjs`)

- **במה מדליקין · אמר רבי אלעזר · קדיש דרבנן** after Kabbalat Shabbat's Kaddish Yatom (Birnbaum's order), when
  `!yomTov&!cholHamoed&!motzaeiYomTov`: Birnbaum p. 252 "The following chapter is omitted on festivals" (English
  original, read from the Internet Archive OCR of the scan); the days as in Ashkenaz practice (Rema OC 270:1) — Yom Tov
  on Shabbat, Shabbat Chol HaMoed, the Shabbat after a Friday Yom Tov. Said on Shabbat Chanukah.
- **על הכל · אב הרחמים הוא ירחם** (role: chazzan) between לך ה׳ and ויעזור in Shabbat Shacharit (also on a Yom Tov that
  uses this service). Birnbaum's morning service has no ותגלה ותראה either (only at Mincha): not a gap.
- **שיר המעלות (Psalms 120–134)** after ברכי נפשי, `winter` (Birnbaum's rubric: "winter Sabbaths, between Sukkot and Pesach").
- **פרקי אבות** after Mincha, one section per chapter, `avot1` … `avot6`: this Shabbat's chapter(s) by the common luach
  schedule — `services/prayer/pirkeiAvot.mjs` (Hebcal's `pirkeiAvotSummer`: from the Shabbat after Pesach to the Shabbat
  before Rosh Hashana, skipping the diaspora's 8th day of Pesach / 2nd day of Shavuot and Erev/Tisha B'Av on Shabbat;
  the fourth round 1, 1–2 or 2, 3–4, 5–6). The full edition shows all six chapters, each labelled.
- **ויתן לך** at the end of weekday Maariv, `motzaeiShabbat&!tishaBav`. Birnbaum prints it after the Kaddish of Motzaei
  Shabbat, before Havdalah; the composition keeps the Metsudah Aleinu before it (doubt noted in notes-ashkenaz.md).

## Licence handling

- Manifest: `SIDDUR_SOURCES.ashkenaz.extraEditions[0]` — CC BY-SA 4.0, licence URL, `attributionRequired`, `shareAlike`,
  editor, year, Wikisource URL, Index revision, pages, `modified: true` with `changes` / `changesHe`, `sectionCredit`.
  The Metsudah entry keeps its own licence (`modified: false`); no other rite mentions Birnbaum.
- Reader (`RiteServiceReader.jsx`): a section whose address is in this edition shows the credit line
  "מתוך הסידור השלם (בירנבוים, 1949), העתקת ויקיטקסט · CC BY-SA 4.0" on that section only; the page footer adds the
  full attribution and a link to the licence only when such a section is on the page.
- About / sources page (`SiddurNusachPages.jsx`): the Ashkenaz card lists the edition with licence, attribution,
  editor, the sections it serves, the pages, the changes and links to the source and the licence.
- `docs/content-licenses.md`: a row for this pack.
