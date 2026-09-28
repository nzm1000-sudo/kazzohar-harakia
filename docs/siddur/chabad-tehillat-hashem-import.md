# Chabad "Siddur Tehillat Hashem" import (Open Siddur, Shmuel Gonzales)

- **Source:** `sources/opensiddur-chabad/*.txt`. These are 18 files, kept unchanged; provenance and licence are in that
  folder's README.
- **Build:** `node scripts/build-chabad-tehillat-hashem.mjs [--report <file.json>]`. The build is deterministic: the
  same sources always give the same bytes. `--report` writes every change it made as JSON.
- **Output:** `src/data/nusach/siddurChabadTehillatHashem.mjs`, about 1.2 MB. It is not registered in
  `registry.mjs`/`nusach.mjs` yet.
- **Shape:** the same as the Sefaria packs:
  `export default { source, schema: { nodes }, texts }`.
  - The index title is **"Siddur Tehillat Hashem"** (`סידור תהלת ה׳`).
  - `schema.nodes` has one node per file. Each file node has one leaf per ✶ section, and each leaf has `depth`,
    `title`, `heTitle`, `key` and `titles: [{lang:'en',primary:true,text},{lang:'he',primary:true,text}]`.
  - Each entry in `texts[ref]` has `{ ref, heRef, he: [paragraph markup], versionTitle, license }`. It also carries the
    Sefaria-style `heVersionTitle`, `heVersionSource` and `heLicense`, so code that reads the other packs finds the
    same fields.
- **Refs:** `Siddur Tehillat Hashem, <file title>, <section title>`.
- **Licence:** `CC0 (Hebrew) / CC BY 4.0 (instructions)`.
- **Totals:** 18 file nodes, 72 leaves, 3,851 paragraphs.

## 1. What was parsed

| File | Node title (en / he) | Leaves |
|---|---|---|
| The-Morning-Blessings | The Morning Blessings / תפלת השחר | 6 |
| Shaḥarit-Morning | The Weekday Morning Service / שחרית לחול | 7 |
| Minḥah-Afternoon | The Afternoon Prayers for Weekdays / תפלת מנחה לחול | 3 |
| Maariv-Evening | The Evening Prayers for Weekdays / תפלת ערבית לחול | 3 |
| The-Bedtime-Shema | The Bedtime Shema / קריאת שמע על המטה | 2 |
| Tikkun-Ḥatzot | Tikkun Chatzot / תקון חצות | 1 |
| Kabbalat-Shabbat | Kabbalat Shabbat / קבלת שבת | 5 |
| The-Shabbat-Book | The Shabbat Book / סדר תקוני שבת | 7 |
| Shaḥarit-Musaf-Shabbat | Shacharit and Musaf for Shabbat and Festivals / שחרית ומוסף לשבת ויום טוב | 6 |
| Minḥah-Shabbat-Afternoon | The Afternoon Prayers for Shabbat / תפלת מנחה לשבת | 3 |
| Hallel-Musaf-Rosh-Ḥodesh | Hallel and Musaf for Rosh Chodesh / סדר הלל ומוסף לראש חודש בחול | 3 |
| Shelosh-Regalim | Prayers for the Three Festivals / תפלות לשלש רגלים | 12 |
| Ḥag-Sukkot | The Holiday of Sukkot / חג הסוכות | 3 |
| The-Blessing-Book | The Blessings Book / סדר ברכות | 7 |
| Sefirat-HaOmer | Counting the Omer / סדר ספירת העומר | 1 |
| Kiddush-Levana | Sanctification of the Moon / סדר קידוש לבנה | 1 |
| Megillat-Esther-Blessings | The Megillah Reading / קריאת המגילה | 1 |
| Prayer-for-Travelers | Prayer for Travelers / תפילת הדרך | 1 |

**Titles**
- **File order** follows the day and the year (morning → night, weekday → Shabbat → festivals → occasional), not the
  alphabet.
- **English file titles** come from each file's title page, for example "The Weekday Morning Service" and "The Blessings
  Book". There are two exceptions:
  - The Morning Blessings file calls itself "The Morning Prayers", which would be confused with Shacharit, so its node
    uses the file name.
  - "The Shacharit and Musaf for Shabbat and Festivals" loses its leading "The".
- **Hebrew file titles** come from the Hebrew heading of each title page. Where the file has no title page (Megillah,
  Travelers, Omer), they come from its first ✶ heading.
- **Leaf titles:** English is the line after the ✶ heading. A line that ends in a dash continues on the next line, so
  "Birkat haMazon -" becomes "Birkat haMazon - Grace After Meals" and "The Sheva Brachot –" becomes "The Sheva Brachot –
  Seven Blessings of a Wedding Feast". Hebrew is the ✶ text, trimmed.

The full outline, with paragraph counts, is printed by the check script. It is also in the pack's schema.

### The two source formats
- **Wiki format** (Morning Blessings, Weekday Shacharit, Bedtime Shema, Kabbalat Shabbat, Hallel/Musaf RC, Kiddush
  Levana) uses `<center>`, `<div align="right">`, `'''bold'''`, `''italic''`, `<u>`, `<nowiki>`, `<sup>`,
  `{| … |}` tables, and `<ref>` footnotes that carry the verse source.
- **Plain format** (the other 12 files) is ODT text export. Footnote numbers are glued to the Hebrew and their text was
  not exported. Tables are flattened to one cell per line or joined with tabs.

In both formats every non-empty line is one paragraph. Outside tables the wiki files never continue a paragraph on the
next line; the only adjacent lines are those right after `|}`. Blank lines only space the text.

## 2. Transformations, in the order the script applies them

1. **Encoding.** The script removes the BOMs (U+FEFF) and turns CRLF/CR into LF.
2. **Direction marks.** It removes U+200E and U+200F. There were 2 of them, both in the Blessing Book.
3. **Hebrew presentation forms.** It decomposes the 1,226 characters in U+FB1D–FB4F (for example `וֹ` U+FB4B, `שׁ`
   U+FB2A, `בּ` U+FB31) into letter + point. There were 1,224 in Ḥag-Sukkot and one each in Shaḥarit-Morning and
   Shaḥarit-Musaf-Shabbat. See §4.
   - **Before/after:** `U+FB4B` → `U+05D5 U+05B9`.
   - The two forms are canonically equivalent, so the same letters and points render the same way.
   - Without this, search and `plainText()` (which strips U+0591–U+05C7) would not match these words.
4. **Not changed.**
   - No NFC/NFD normalisation of the text as a whole. The source's order of points, which is often non-canonical, is
     kept exactly.
   - The zero-width joiner in `עֲו‍ֹן` and similar words is kept (U+200D, in 14 paragraphs). It places the holam and
     is deliberate.
5. **Back matter.** The script drops everything from the transcriber's licence line ("I am the original transcriber …")
   to the end of the file: `[[Image:]]`, `----` and `<references/>`. The licence line itself goes to
   `source.files[].licenceStatement`, with `[[Image:]]` and wiki-link syntax removed.
6. **Front matter.**
   - Everything before the first ✶ heading goes to `source.files[].header` and `.version`: בס"ד, title lines,
     "Comparable to the …", the credit paragraph, the "sheymish/sheimos" note and the version line.
   - In the Omer, Megillah and Travelers files the credit block sits under the first ✶ heading. There the script drops
     these lines by pattern ("Comparable to the", "Siddur Tehillat HASHEM", "NUSACH HA-ARI ZAL", "According to the Text
     of", "Rabbi Shneur Zalman of Liadi", "Compiled and newly typeset by …", "Version …") and records them in
     `source.files[].credits`. That is 21 lines.
7. **Sections.** Each ✶ line (U+2736) starts a leaf.
   - The ✶ line and the English title line(s) after it become the schema titles. They are not paragraphs.
   - ★ lines (U+2605, 64 of them) are sub-headings inside a leaf: `★ קדיש יתום ★` → `<big>קדיש יתום</big>`.
   - A ★ line with an English part (`★ קרבנות – Offerings ★`) → `<big>קרבנות</big>` + `<small class="en heading">Offerings</small>`.
8. **Wiki markup.**
   - Removed: `<center>` (924), `<div align>` (262), `<u>` (78), `<nowiki>` (6), `[[Image:]]` (2).
   - `<sup>` (6) goes and its ordinal suffix stays: `4<sup>th</sup>` → `4th`.
   - `'''x'''` → `<b>x</b>` (149).
   - `''` italic markers are removed (1,396). The italics only mark English, and English is found by script (step 11).
   - One unpaired `'''` is removed.
   - Whitespace: runs of spaces and tabs become one space (tabs: 64 lines in 4 plain files), and lines are trimmed.
9. **Footnotes.**
   - **Wiki files:** each `<ref>…</ref>` (247) is removed from the Hebrew. Its text, a verse reference such as
     "Deuteronomy 29:28", follows the paragraph as `<small class="en note">…</small>`, joined with " · " when a
     paragraph has several. That makes 118 note paragraphs. Full list: Appendix C.
   - **Plain files:** a number of 1–3 digits glued to Hebrew (after a letter, a point, `:` `.` `,` `;` `׃` `)` `]`, or
     after `</b>`) is removed. So is one number set off by a space at the end of its line (`מִגְדּוֹל 10`). That is 396
     removals with no footnote text in the source. Every removal is in Appendix B.
   - **Kept:** numbers inside English ("Psalm 20:10", "p.60"), the bracketed numbering of the Six Remembrances
     (`[1]` … `[6]`), and the Omer day numbers.
10. **Paragraph kinds.**
    - A paragraph is **English** when it has more Latin letters than Hebrew letters outside quotation marks. It becomes
      `<small class="en">…</small>`, with its words unchanged (quoted Hebrew stays inside).
    - Two exceptions are Hebrew paragraphs instead:
      - The paragraph starts with Hebrew and has at least half as many Hebrew letters as Latin ones. Example:
        `עשֶֹׁה שָׁלוֹם (During the Ten Days of Penitence substitute - הַשָּׁלוֹם) בִּמְרוֹמָיו …`.
      - The whole paragraph is a bracketed addition ending in Hebrew. Example: `(Say in and undertone - בּוֹאִי כַלָּה שַׁבָּת מַלְכְּתָא:)`.
    - **English heading** (`<small class="en heading">`): the paragraph starts with a capital or a digit, has at most 8
      words, does not end in `: . ; ,` and is not all capitals. It must also be centred, follow a heading, or read
      "Psalm(s) N". Examples: "Psalm 95", "The Mourners Kaddish", "Numbers 28:1-8".
    - **Hebrew heading** (`<big>`): no Latin, fewer than a quarter of its letters pointed, and at most 8 words. The
      scan found 18, all unpointed titles such as `מי שבירך ליולדת זכר`, `ברכת הזן`, `בנין ירושלים` and `אנא בכח`. Of
      the 207 `<big>` paragraphs, 61 come from ★ lines (the other 3 ★ lines are English only) and 128 from
      Hebrew – English heading lines.
    - **Hebrew – English heading lines** (128): the Amidah blessing titles, for example
      `קדושת השם – Holiness of God's Name`, become `<big>קדושת השם</big>` + `<small class="en heading">Holiness of God's Name</small>`.
11. **English inside a Hebrew paragraph** (360 runs) is wrapped as `<small class="en">…</small>`.
    - Opening brackets and quotation marks stay outside, and so does a closing bracket that the run did not open.
    - Examples: `(Cong: אָמֵן)` → `(<small class="en">Cong:</small> אָמֵן)`, and `(name)` → `(<small class="en">name</small>)`.
12. **A direction and a prayer on one line** (13 lines) become two paragraphs, the direction first. Example:
    `Bow while saying the words “וַאֲנַחְנוּ כּוֹרְעִים וּמִשְׁתַּחֲוִים" עָלֵינוּ לְשַׁבֵּחַ …`.
    - **Where the cut goes:** at the first point, after an English letter or a closing quotation mark, where all of
      these hold:
      - the rest of the line starts with Hebrew and has three or more Hebrew words;
      - no English comes before the fifth Hebrew word, bracketed blanks such as "(name)" aside;
      - the direction is left with no bracket or quotation open.
    - All 13 are listed in Appendix D.
13. **Lines kept whole as English** (`FORCE_DIRECTION`, 2 lines): `"יְהִי כְבוֹד" Stand while reciting until יְיָ מֶלֶךְ …`.
    Its words are in visual (reversed) order and it means "stand from יְהִי כְבוֹד until יְיָ מֶלֶךְ". By rule it would
    read as prayer text. In the Weekday file the line is followed by the verse as its own paragraph, so nothing is
    lost.
14. **Ana Bekoach, Divine-Name acronyms.** A run of acronym lines (`אב"ג ית"ץ`) is paired line by line with the prayer
    lines right before it: `אָנָּא בְּכֹחַ … צְרוּרָה <small class="kavanah">אב"ג ית"ץ</small>`.
    - 42 lines were paired: in the three wiki tables and in the flattened text of weekday Mincha, Shabbat Mincha and
      the Omer.
    - None was left unpaired.
15. **Omer chart** (Sefirat HaOmer). The chart was flattened to six lines per day: day number, count, sefirah, Ana
    Bekoach word, Psalm 67 word, and letter of ישמחו. Each day becomes one paragraph (49 in all):
    `<small class="en">1</small> הַיּוֹם יוֹם אֶחָד לָעוֹמֶר: <small class="kavanah">חֶסֶד שֶׁבְּחֶסֶד · אָנָּא · אֱלֹהִים · י</small>`.
    - The column captions "Day", "Count" and "Sefirah" are joined into one English heading.
    - On days 7, 14 … 49 the source has the week's acronym (`אב"ג ית"ץ` …) where the Ana Bekoach word would stand. It
      is kept as is.
16. **Wiki tables** (38) are read in reading order. Appendix A lists every table.
    - **Rows whose cells are one line each** become one paragraph per row. Hebrew cells are joined in source order and
      English label cells become inline `<small class="en">`. Example: `… כִּי לְעוֹלָם חַסְדּוֹ: <small class="en">- Chazzan</small>`.
      A row with no Hebrew gives one English paragraph per cell (T22, the two Hallel descriptions).
    - **Hodu (T23, Hallel):** the response cell "כִּי לְעוֹלָם חַסְדּוֹ" stands first in the source but is said after
      the verse, so each row reads verse → response → label.
    - **T32 (Hallel):** the "(Others respond: “אָמֵן.”)" cell stands before the blessing it answers, so it moves after
      it.
    - **Cells with several lines** give one paragraph per line.
      - A cell that is exactly [English caption, Hebrew] becomes one paragraph:
        `<small class="en">Summer, Pesach through Sukkot:</small> מוֹרִיד הַטָּל:`.
      - The exception is "Do not respond / אָמֵן" (T1), which stays one English paragraph so that the אָמֵן is not
        read as said text.
    - **Kavanah tables** (T3, T10, T17), with prayer and acronym columns, go through step 14.

## 3. Corrections

No word of prayer text was changed. The only corrections are to schema titles, which the text does not carry, and
the Unicode decomposition in §2.3.

| Where | Before (source) | After (title in the pack) |
|---|---|---|
| File node, Hallel/Musaf RC | סדר הלל ומסף לראש חודש בחול | סדר הלל ומוסף לראש חודש בחול |
| File node, Shelosh Regalim | תפלת לשלש רגלים | תפלות לשלש רגלים |
| File node, Ḥag Sukkot | הג הסכות | חג הסוכות |
| Leaf, Shabbat Book | סעורת לליל שבת | סעודת ליל שבת |
| Leaf, Shabbat Shacharit | סדר קריאת התור לשבת ויום טוב | סדר קריאת התורה לשבת ויום טוב |
| Leaf, Shabbat Mincha | סדר קריאת התור | סדר קריאת התורה |
| Leaf, Shelosh Regalim | בירכת כהנים | ברכת כהנים |
| Leaf, Shelosh Regalim | סדר קרבנ פסח | סדר קרבן פסח |
| Leaf, Shelosh Regalim (English) | Yikzor – Prayer for the Souls of the Departed | Yizkor – Prayer for the Souls of the Departed |
| Leaf, Blessing Book | ברכת אחרונות | ברכות אחרונות |
| Leaf, Blessing Book | הרחמן לברית מיל | הרחמן לברית מילה |
| Text, Ḥag Sukkot (+2 elsewhere) | 1,226 presentation-form code points, e.g. U+FB4B | canonical decomposition, e.g. U+05D5 U+05B9 |

## 4. Decisions to review

- **Presentation forms (§2.3).** This is the one change to how the Hebrew is encoded. It is canonically equivalent and
  renders identically. It can be reverted by deleting two lines in `normaliseSource`.
- **Pipeline fit.** `siddurBlocks.markupParts` types any small print inside a Hebrew paragraph as `conditionalAddition`
  unless it is a known rubric or a long unpointed note. `pointedShare` is 0 for English, and English labels are under
  24 words. So:
  - inline `<small class="en">Cong:</small>` and table labels would be typed as additions;
  - the Omer `<small class="kavanah">`, whose words are pointed, would be typed as said additions.
  The pipeline probably needs to read `class="en"` and `class="kavanah"` before this pack is registered.
- **Nusach key.** `source.nusach` is `chabad` and `source.edition` is `tehillat-hashem`. The pack is not registered, and
  the key it would take (`chabad-th`?) is the registry's choice.
- **One line, one paragraph.** A few English directions are broken across two source lines and so across two
  paragraphs. Example: Hallel ¶41–42, "Each of the the following lines …" / "and then repeated responsively …".
- **English heading heuristic.** A few short centred directions read as headings, for example "Shake the corners of
  the tallit kattan" in Kiddush Levana. Both kinds are small English, so only the style differs.

## 5. Quality issues in the source (reported, not fixed)

Locations are `file node › leaf ¶index` (0-based paragraph in the pack).

### 5.1 Systematic
- **Holam used for the sin dot.** ש carries a holam (U+05B9) and no shin/sin dot, 961 times (`יִשְֹרָאֵל`,
  `עָשָֹה`, `שִֹמְחָה`). It is in every file but Omer, and heaviest in Shelosh Regalim (268) and Shabbat Shacharit
  (240). It renders close to a sin dot, but it is the wrong character, and search that strips points loses nothing.
- **ש with no dot at all** in pointed text: 78 places (Appendix F3), for example `מִשגָּב` (Incense ¶8, Mincha ¶16,
  Maariv ¶4, Kabbalat Shabbat Maariv ¶2) and `יִשרָאֵל` (Weekday Verses of Praise ¶1, ¶9).
- **Non-canonical order of points** throughout. It is kept exactly, and any Hebrew needle searched in this pack should
  be NFC-normalised first.
- **Footnote text missing.** None of the 12 plain files exported its footnote text, only the numbers (396). The wiki
  files carry their references.
- **Reversed English (visual order)** around Hebrew quotes. Examples:
  - `אָמֵן Do not respond` (Weekday Verses of Praise ¶87, Maariv ¶18, and others)
  - `"יְהִי כְבוֹד" Stand while reciting until…` (Weekday Verses of Praise ¶5; Shabbat Verses of Praise ¶4)
  - `( טְבִלַת כֵּלִים :If more than one utensil is immersed conclude with )` (Blessings Book › Blessings Over Food ¶39)
  - `:Stand while saying Hallel` (Hallel ¶4)
  - `122 Psalm` and `92 Psalm` (Shabbat Verses of Praise ¶45, ¶102)
- **Macron as maqaf.** `כָּל¯סְחוֹרָה` and `בְּכָל¯לֵב` (Sukkot › Hosha'anot ¶54, ¶63; Hakafot ¶26, ¶28) use `¯`
  (U+00AF) where a maqaf is meant.
- **Stray asterisks** `*` after "כִּי לְעוֹלָם חַסְדּוֹ:" in three Hodu rows (Hallel ¶30, ¶33, ¶35). The source does
  not explain them.

### 5.2 Words (prayer text)
| Location | As in source | Expected |
|---|---|---|
| Bedtime Shema › Hamapil ¶1 | בָּרוּךְ אַתָּח | אַתָּה |
| Kabbalat Shabbat › Welcoming the Sabbath ¶10 (Ps. 99:6) | קֹרִאים | קֹרְאִים |
| Hallel ¶39 (Ps. 118:23) | זּאֹת | זֹּאת |
| Every Amidah (10×: Weekday Shacharit ¶15, Mincha ¶16, Maariv ¶16, Kabbalat Shabbat ¶15, Shabbat Shacharit ¶16, Shabbat Musaf ¶16, Shabbat Mincha ¶16, RC Musaf ¶13, Festival Amidah ¶15, Festival Musaf ¶15) | וּמוֹרִיד הַגֶּשֶּׁם | הַגָּשֶׁם |
| Ya'aleh VeYavo tables (Weekday Shacharit ¶91–93, Mincha ¶102–106, Maariv ¶83–87, Kabbalat Shabbat ¶35–37; Birkat haMazon ¶76, ¶118) | רֹאשׁ הַחדֶשׁ · חַג הַמַּצּות · חַג הַסֻּכּות | הַחֹדֶשׁ · הַמַּצּוֹת · הַסֻּכּוֹת |
| Morning Blessings ¶32 | אֲבוֹתֵינֹוּ | אֲבוֹתֵינוּ |
| Weekday Verses of Praise ¶5–6; Shabbat Verses of Praise ¶5–6 | לְעֹולָם | לְעוֹלָם |
| Shabbat Verses of Praise ¶79 (Ps. 136:26) | הוֹדוּ לְאֵל הַשָּׁמָיִ, | הַשָּׁמָיִם |
| Weekday Verses of Praise ¶51; Shabbat Verses of Praise ¶135; Kiddush Levana ¶3 | הַשָּׁמָיִםֹֹ (two holams after the word) | הַשָּׁמָיִם |
| Weekday Amidah ¶100; RC Musaf ¶47 | בָּשָֹֹר | בָּשָׂר |
| Festival › Musaf First Day of Pesach ¶13, ¶16 | לִרְסִיסוֹֹ · לִִרְצּוֹת | לִרְסִיסוֹ · לִרְצוֹת |
| Aleinu (7×, Appendix F2) | עָשַָׂנוּ | עָשָׂנוּ |
| Tikkun Chatzot ¶28 | מְִצְרַיִם | מִצְרַיִם |
| Festival › Order of the Pesach Offering ¶1 | לַתַָּמִיד · הַפֵֶּסַח | לַתָּמִיד · הַפֶּסַח |
| Blessings Book › Praise and Gratitude ¶8 | וְנֶאֵֶמָן | וְנֶאֱמָן |
| Kaddish (21 places: Thirteen Principles ¶10, Weekday Torah Reading ¶108, Song of the Day ¶38/60/74, …) | יְהֵא שְׁלָמָה רבָּא | רַבָּא |
| Maariv (5×: ¶10 and The Shema ¶20, Amidah ¶123/134/148) | בְּחַיֵּיכון | בְּחַיֵּיכוֹן |
| Sukkot › Hosha'anot ¶63 | בְּרִבֲבוֹת | בְּרִבְבוֹת |
| Shabbat Book, Festival Kiddush, Blessings Book (31 paragraphs, e.g. Shabbat Evening Kiddush ¶9, Blessings Over Food ¶4) | אֶלֹהֵינוּ | אֱלֹהֵינוּ |

### 5.3 Headings and notes (text in the pack, not prayer words)
- **Amidah headings.**
  - `אבודה – Temple Service` should be עבודה. It appears 6 times (Weekday Amidah ¶86, Kabbalat Shabbat Amidah ¶30,
    Shabbat Amidah ¶48, Shabbat Musaf ¶57, Shabbat Mincha ¶45, Festival Amidah ¶78).
  - `ברכת קהנים – Priestly Blessing` should be כהנים. It appears 7 times (Weekday Amidah ¶111, Mincha ¶124, Shabbat
    Amidah ¶74, Shabbat Musaf ¶74, RC Musaf ¶56, Festival Amidah ¶89, Festival Musaf ¶131).
- **Footnote references.**
  - Kabbalat Shabbat › Amidah ¶121 cites "Proverbs 46:4"; it should be Isaiah 46:4.
  - Hallel ¶12, ¶14 label Psalm 115 as "Psalms 15:1-11" and "Psalms 15:12-18".
- **English misspellings:**
  - "Mishanyot" (6×)
  - "straitening" (5×)
  - "One the eve" (Kabbalat Shabbat › Mincha for Shabbat Eve ¶0)
  - "Say in and undertone" (Welcoming the Sabbath ¶46)
  - "immedatly" (Hosha'anot ¶0)
  - "congreagations" (Hosha'anot ¶1)
  - "Each of the the following" (Hallel ¶41)
- **Source headings** corrected in the titles only: see §3.

### 5.4 Coverage
- There is **no Chanukah file**: the archive has none, so there is no candle-lighting text. The Al HaNissim inserts
  are present.
- There is **no machzor** for Rosh Hashanah or Yom Kippur.
- **Tikkun Chatzot** declares itself "Comparable to the Siddur Torah Ohr", not Tehillat Hashem.

## 6. Verification

A scratch check, not in the repo, loads the pack and confirms:
- 18 files, 72 leaves and 3,851 paragraphs;
- every leaf has its text;
- every paragraph has Hebrew outside small print, or is wholly `<small class="en…">`, `<small class="kavanah">` or `<big>`;
- no `'''`, `''`, `{|`, `|}`, `[[`, `]]`, `<center>`, `<ref>`, `<div>`, `<u>`, `<nowiki>`, `<sup>` is left;
- no BOM, direction mark, presentation form or tab is left;
- no Latin letter stands outside `<small class="en…">`;
- small/b/big tags are balanced.

Two builds give identical bytes (same SHA-1).

## Appendix A — Wiki tables and how each was read

| # | File | Leaf | Rows × cells | Reading | Content (start) |
|---|---|---|---|---|---|
| T1 | The-Morning-Blessings | Morning Blessings | 1 × 3 | cell-by-cell | בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, הַמַּעֲבִיר שֵׁנָה מֵ |
| T2 | The-Morning-Blessings | Incense | 3 × 2 | row-per-paragraph | - Say three times / יְיָ צְבָאוֹת עִמָּנוּ, מִשגָּב לָנוּ אֱלֹהֵי יַעֲ |
| T3 | The-Morning-Blessings | Incense | 1 × 2 | kavanah columns (prayer / Divine-Name acronyms) | אָנָּא בְּכֹחַ גְּדֻלַּת יְמִינְךָ תַּתִּיר צְרוּרָה / קַבֵּל רִנַּת ע |
| T4 | Shaḥarit-Morning | Shemoneh Esrei – The Amidah | 1 × 2 | cell-by-cell | Summer, Pesach through Sukkot: / מוֹרִיד הַטָּל: / Winter, Shmini Atze |
| T5 | Shaḥarit-Morning | Shemoneh Esrei – The Amidah | 6 × 2 | row-per-paragraph | נַקְדִּישָׁךְ וְנַעֲרִיצָךְ כְּנֹעַם שִֹיחַ סוֹד שַֹרְפֵי קֹדֶשׁ הַמְש |
| T6 | Shaḥarit-Morning | Shemoneh Esrei – The Amidah | 1 × 2 | cell-by-cell | Summer: / בְּרָכָה: / Winter: / טַל וּמָטָר לִבְרָכָה: |
| T7 | Shaḥarit-Morning | Shemoneh Esrei – The Amidah | 1 × 3 | cell-by-cell | On Rosh Chodesh: / רֹאשׁ הַחדֶשׁ / On Pesach: / חַג הַמַּצּות / On Suk |
| T8 | Shaḥarit-Morning | Shemoneh Esrei – The Amidah | 1 × 2 | cell-by-cell | On Chanukah add: / בִּימֵי מַתִּתְיָהוּ בֶּן יוֹחָנָן כֹּהֵן גָּדוֹל,  |
| T9 | The-Bedtime-Shema | The Bedtime Shema | 2 × 2 | row-per-paragraph | הִנֵּה מִטָּתוֹ שֶׁלִּשְׁלֹמֹה שִׁשִּׁים גִּבֹּרִים סָבִיב לָהּ, מִגִּ |
| T10 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | kavanah columns (prayer / Divine-Name acronyms) | אָנָּא בְּכֹחַ גְּדֻלַּת יְמִינְךָ תַּתִּיר צְרוּרָה / קַבֵּל רִנַּת ע |
| T11 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verses three times / גָּד גְּדוּד יְגוּדֶנּוּ,  |
| T12 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verse three times / אִם תִּשְׁכַּב לֹא תִפְחָד, |
| T13 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verse three times / בְּטוֹב אָלִין אָקִיץ בְּרַ |
| T14 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verse three times / לִישׁוּעָתְךָ קִוִּיתִי יְי |
| T15 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verse three times / אַתָּה סֵתֶר לִי מִצַּר תִּ |
| T16 | The-Bedtime-Shema | The Bedtime Shema | 1 × 2 | row-per-paragraph | – Recite the following verse three times / תּוֹדִיעֵנִי אֹרַח חַיִּים  |
| T17 | Kabbalat-Shabbat | Kabbalat Shabbat – Welcoming the Sabbath | 1 × 2 | kavanah columns (prayer / Divine-Name acronyms) | אָנָּא בְּכֹחַ גְּדֻלַּת יְמִינְךָ תַּתִּיר צְרוּרָה / קַבֵּל רִנַּת ע |
| T18 | Kabbalat-Shabbat | Maariv For Shabbat and Festivals | 3 × 2 | row-per-paragraph | - Say three times / יְיָ צְבָאוֹת עִמָּנוּ, מִשגָּב לָנוּ אֱלֹהֵי יַעֲ |
| T19 | Kabbalat-Shabbat | Shemoneh Esrei – The Amidah | 1 × 2 | cell-by-cell | Summer, Pesach through Sukkot: / מוֹרִיד הַטָּל: / Winter, Shmini Atze |
| T20 | Kabbalat-Shabbat | Shemoneh Esrei – The Amidah | 1 × 3 | cell-by-cell | On Rosh Chodesh: / רֹאשׁ הַחדֶשׁ / On Pesach: / חַג הַמַּצּות / On Suk |
| T21 | Kabbalat-Shabbat | Shemoneh Esrei – The Amidah | 1 × 1 | row-per-paragraph | בִּימֵי מַתִּתְיָהוּ בֶּן יוֹחָנָן כֹּהֵן גָּדוֹל, חַשְׁמוֹנָאִי וּבָנ |
| T22 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | The Hatzi Hallel is said on Rosh Chodesh and on the last six days of P |
| T23 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 11 × 3 | row-per-paragraph, verse before response | כִּי לְעוֹלָם חַסְדּוֹ: / הוֹדוּ לַײָ כִּי טוֹב: / - Chazzan / כִּי לְ |
| T24 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / אוֹדְךָ כִּי עֲנִיתָנִי, וַתְּהִי לִי ל |
| T25 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / אֶבֶן מָאֲסוּ הַבּוֹנִים, הָיְתָה לְרֹא |
| T26 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / מֵאֵת יְיָ הָיְתָה זּאֹת, הִיא נִפְלָאת |
| T27 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / זֶה הַיּוֹם עָשָֹה יְיָ, נָגִילָה וְנִש |
| T28 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / בָּרוּךְ הַבָּא בְּשֵׁם יְיָ, בֵּרַכְנו |
| T29 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / אֵל יְיָ וַיָּאֶר לָנוּ, אִסְרוּ חַג בּ |
| T30 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / אֵלִי אַתָּה וְאוֹדֶךָּ, אֱלֹהַי אֲרוֹמ |
| T31 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph | – Recite the following twice / הוֹדוּ יְיָ כִּי טוֹב, כִּי לְעוֹלָם חַ |
| T32 | Hallel-Musaf-Rosh-Ḥodesh | Hallel | 1 × 2 | row-per-paragraph, blessing before response | (Others respond: “אָמֵן.”) / בָּרוּךְ אַתָּה יְיָ, מֶלֶךְ מְהֻלָּל בַּ |
| T33 | Hallel-Musaf-Rosh-Ḥodesh | The Musaf Amidah | 1 × 2 | cell-by-cell | Summer, Pesach through Sukkot: / מוֹרִיד הַטָּל: / Winter, Shmini Atze |
| T34 | Hallel-Musaf-Rosh-Ḥodesh | The Musaf Amidah | 6 × 2 | row-per-paragraph | נַקְדִּישָׁךְ וְנַעֲרִיצָךְ כְּנֹעַם שִֹיחַ סוֹד שַֹרְפֵי קֹדֶשׁ הַמְש |
| T35 | Hallel-Musaf-Rosh-Ḥodesh | The Musaf Amidah | 1 × 1 | cell-by-cell | On Chanukah add: / בִּימֵי מַתִּתְיָהוּ בֶּן יוֹחָנָן כֹּהֵן גָּדוֹל,  |
| T36 | Kiddush-Levana | Sanctification of the Moon | 1 × 2 | row-per-paragraph | – Recite the following three times / דָּוִד מֶלֶךְ יִשְֹרָאֵל חַי וְקַ |
| T37 | Kiddush-Levana | Sanctification of the Moon | 1 × 3 | row-per-paragraph | שָׁלוֹם עֲלֵיכֶם: / – Others respond / עֲלֵיכֶם שָׁלוֹם: |
| T38 | Kiddush-Levana | Sanctification of the Moon | 1 × 2 | row-per-paragraph | – Recite the following three times / סִמָּן טוֹב וּמַזָּל טוֹב יְהֵא ל |

## Appendix B — Footnote numbers removed (plain-format files)

Each entry: the number removed, after the last words it was glued to. The footnote text was not in the source.

- **Minḥah-Afternoon › Mincha for Weekdays** (11): 1 ‹עַל הַמִּזְבֵּחַ סָבִיב:›; 2 ‹קָדָשִׁים תִּהְיֶה לָכֶם:›; 3 ‹לִפְנֵי יְיָ, לְדֹרֹתֵיכֶם:›; 4 ‹מִמֶּנּוּ אִשֶּׁה לַײָ:›; 5 ‹אֱלֹהֵי יַעֲקֹב סֶלָה:›; 6 ‹אָדָם בֹּטֵחַ בָּךְ:›; 7 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 8 ‹עוֹד יְהַלְלוּךָ סֶּלָה:›; 9 ‹הָעָם שֶׁיְיָ אֱלֹהָיו:›; 10 ‹קָדְשׁוֹ לְעוֹלָם וָעֶד:›; 11 ‹וְעַד עוֹלָם, הַלְלוּיָהּ:›
- **Minḥah-Afternoon › Shemoneh Esrei – The Amidah** (11): 12 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 13 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 14 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 15 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 16 ‹וּלְכָבוֹד אֶהְיֶה בְּתוֹכָהּ:›; 17 ‹מְדַבְּרִים וַאֲנִי אֶשְׁמָע,›; 18 ‹אֲדָר וּשְׁלָלָם לָבוֹז.›; 19 ‹וְיָשֵֹם לְךָ שָׁלוֹם›; 20 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 21 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 22 ‹יְיָ צוּרִי וְגוֹאֲלִי:›
- **Minḥah-Afternoon › Supplication of Tachanun** (22): 23 ‹עָשִֹיתָ וַאֲנַחְנוּ הִרְשָׁעְנוּ:›; 24 ‹כְּמוֹ בְּתוֹרָתְךָ כָּתוּב.›; 25 ‹וַיֵּרֶד יְיָ בֶּעָנָן.›; 26 ‹וַיִּתְיַצֵּב עִמּוֹ שָׁם.›; 27 ‹וַיִּקְרָא בְשֵׁם יְיָ›; 28 ‹וָפֶשַׁע וְחַטָּאָה וְנַקֵּה:›; 29 ‹יִשְׂרָאֵל מִכֹּל, עֲו‍ֹנֹתָיו:›; 30 ‹כִּי עָלֶיךָ עֵינֵינוּ.›; 31 ‹כִּי מֵעוֹלָם הֵמָּה.›; 32 ‹כַּאֲשֶׁר יִחַלְנוּ לָךְ.›; 33 ‹כִּי דַלּוֹנוּ מְאֹד.›; 34 ‹רַב שָׂבַעְנוּ בוּז.›; 35 ‹יַעֲנֵֽנוּ בְיוֹם קָרְאֵֽנוּ.›; 36 ‹כִּי עָפָר אֲנָֽחְנוּ.›; 37 ‹חַטֹּאתֵֽינוּ לְמַֽעַן שְׁמֶֽךָ.›; 38 ‹שָׁמַיִם וְיוֹסֵד אָרֶץ,›; 39 ‹מִתָּחַת, אֵין עוֹד:›; 40 ‹יִמְלֹךְ לְעוֹלָם וָעֶד.›; 41 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 42 ‹רְשָׁעִים כִּי תָבֹא:›; 43 ‹כִּי עִמָּנוּ אֵל:›; 44 ‹וַאֲנִי אֶסְבֹּל וַאֲמַלֵּט:›
- **Maariv-Evening › Maariv for Weekdays and the Conclusion of Shabbat** (9): 1 ‹יָעִיר כָּל חֲמָתוֹ:›; 2 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 3 ‹עֹשֵׂה, שָׁמַיִם וָאָרֶץ:›; 4 ‹תְּפִלָּה לְאֵל חַיָּי:›; 5 ‹כִּי חָסוּ בוֹ:›; 6 ‹אֱלֹהֵי יַעֲקֹב סֶלָה:›; 7 ‹אָדָם בֹּטֵחַ בָּךְ:›; 8 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 9 ‹וְאַהֲבָתְךָ לֹא תָסוּר›
- **Maariv-Evening › The Shema** (7): 10 ‹יְיָ | אֶחָד:›; 11 ‹עַד אֵין מִסְפָר.›; 12 ‹נָתַן לַמּוֹט רַגְלֵנוּ,›; 13 ‹תְהִלֹּת עֹשֵׂה פֶלֶא:›; 14 ‹משֶׁה, זֶה אֵלִי›; 15 ‹יִמְלךְ לְעוֹלָם וָעֶד:›; 16 ‹מִיַּד חָזָק מִמֶּנּוּ.›
- **Maariv-Evening › Shemoneh Esrei – The Amidah** (33): 17 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 18 ‹אֲדָר וּשְׁלָלָם לָבוֹז.›; 19 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 20 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 21 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 22 ‹וּמַעֲשֵׂה יָדֵינוּ כּוֹנְנֵהוּ.›; 23 ‹יוֹשֵׁב תְּהִלּוֹת יִשְׂרָאֵל.›; 24 ‹כָל הָאָרֶץ כְּבוֹדוֹ.›; 25 ‹אַרְעָא זִיו יְקָרֵהּ.›; 26 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 27 ‹יִמְלךְ לְעֹלָם וָעֶד.›; 28 ‹לְעָלַם וּלְעָלְמֵי עָלְמַיָּא.›; 29 ‹וְהָכֵן לְבָבָם אֵלֶיךָ›; 30 ‹יָעִיר כָּל חֲמָתוֹ.›; 31 ‹חֶסֶד לְכָל קֹרְאֶיךָ.›; 32 ‹לְעוֹלָם, וְתוֹרָתְךָ אֱמֶת.›; 33 ‹לַאֲבֹתֵינוּ מִימֵי קֶדֶם.›; 34 ‹הָאֵל יְשׁוּעָתֵנוּ סֶלָה.›; 35 ‹אֱלֹהֵי יַעֲקֹב סֶלָה.›; 36 ‹אָדָם בֹּטֵחַ בָּךְ:›; 37 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 38 ‹אֱלֹהַי לְעוֹלָם אוֹדֶךָּ:›; 39 ‹וְהָיָה יְיָ, מִבְטַחוֹ.›; 40 ‹יְיָ, צוּר עוֹלָמִים.›; 41 ‹עָזַבְתָּ דֹרְשֶׁיךָ יְיָ.›; 42 ‹יַגְדִּיל תּורָה וְיַאְדִּיר:›; 43 ‹זוּלָתוֹ, כַּכָּתוּב בְּתוֹרָתוֹ:›; 44 ‹יִמְלֹךְ לְעוֹלָם וָעֶד.›; 45 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 46 ‹רְשָׁעִים כִּי תָבֹא:›; 47 ‹כִּי עִמָּנוּ אֵל:›; 48 ‹וַאֲנִי אֶסְבֹּל וַאֲמַלֵּט:›; 49 ‹יְשָׁרִים אֶת פָּנֶיךָ:›
- **Tikkun-Ḥatzot › Tikkun Chatzot – The Midnight Rite** (11): 1 ‹פְּאֵר תַּחַת אֵפֶר:›; 2 ‹עָשִֹיתָ וַאֲנַחְנוּ הִרְשָׁעְנוּ:›; 3 ‹צָרֵינוּ בּוֹסְסוּ מִקְדָּשֶׁךָ:›; 4 ‹וּתְעַנֵּנוּ עַד מְאֹד:›; 5 ‹עִירְךָ וְעַל עַמֶּךָ:›; 6 ‹שְׁבִיָּה בַּת צִיּוֹן:›; 7 ‹יִשְׁתֻּהוּ בְּחַצְרוֹת קָדְשִׁי:›; 8 ‹וְאֶת עֲפָרָהּ יְחֹנֵנוּ:›; 9 ‹נִדְחֵי יִשְׂרָאֵל יְכַנֵּס:›; 10 ‹מֶלֶךְ הַכָּבוֹד סֶלָה:›; 11 ‹הָאֲדָמָה עַל הָאֲדָמָה.›
- **The-Shabbat-Book › The Shabbat Evening Meal** (3): 1 ‹לִשְׁמָרְךָ בְּכָל דְּרָכֶיךָ:›; 2 ‹מֵעַתָּה וְעַד עוֹלָם:›; 3 ‹וִיהַלְלוּהָ בַשְּׁעָרִים מַעֲשֶׂיהָ:›
- **The-Shabbat-Book › The Shabbat Evening Kiddush** (2): 4 ‹יְיָ לְאֹרֶךְ יָמִים:›; 5 ‹בָּרָא אֱלֹהִים לַעֲשׂוֹת:›
- **The-Shabbat-Book › The Kiddush for Shabbat Day** (4): 6 ‹יְיָ לְאֹרֶךְ יָמִים:›; 7 ‹הַשְּׁבִיעִי שָׁבַת וַיִּנָּפַשׁ:›; 8 ‹פִּי יְיָ דִּבֵּר:›; 9 ‹יוֹם הַשַּׁבָּת וַיְקַדְּשֵׁהוּ:›
- **The-Shabbat-Book › The Seudah Shelishit – Third Meal** (1): 10 ‹יְיָ לְאֹרֶךְ יָמִים:›
- **The-Shabbat-Book › Havdalah** (7): 11 ‹בְּשָׂשׂוֹן, מִמַּעַיְנֵי הַיְשׁוּעָה.›; 12 ‹עַמְּךָ בִרְכָתֶךָ סֶּלָה.›; 13 ‹אֱלֹהֵי יַעֲקֹב סֶלָה.›; 14 ‹אָדָם בֹּטֵחַ בָּךְ:›; 15 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 16 ‹וְשִׂמְחָה, וְשָׂשׂוֹן, וִיקָר.›; 17 ‹וּבְשֵׁם יְיָ אֶקְרָא:›
- **The-Shabbat-Book › For the Conclusion of Shabbat** (18): 18 ‹אָרוּר, וּמְבָרֲכֶיךָ בָּרוּךְ:›; 19 ‹נָתַן אֱלֹהִים לְאַבְרָהָם:›; 20 ‹וּלְקָדְקֹד נְזִיר אֶחָיו:›; 21 ‹וּנְתָנָם בְּכָל שֹׂנְאֶיךָ:›; 22 ‹לָרֹב, בְּקֶרֶב הָאָרֶץ.›; 23 ‹כַּאֲשֶׁר דִּבֶּר לָכֶם:›; 24 ‹וְאַתָּה לֹא תִלְוֶה:›; 25 ‹וּבְךָ לֹא יִמְשֹׁלוּ:›; 26 ‹עַל בָּמוֹתֵימוֹ תִדְרֹךְ:›; 27 ‹עַד עוֹלְמֵי עַד:›; 28 ‹יֵבֹשׁוּ עַמִּי לְעוֹלָם:›; 29 ‹הַשָּׂדֶה יִמְחֲאוּ כָף:›; 30 ‹בְּקִרְבֵּךְ קְדוֹשׁ יִשְׂרָאֵל:›; 31 ‹נָגִילָה וְנִשְׂמְחָה בִּישׁוּעָתוֹ:›; 32 ‹אָמַר יְיָ וּרְפָאתִיו:›; 33 ‹וַיִּתְּנֵם בְּרָאשֵׁי הַגְּדוּד:›; 34 ‹אֲשֶׁר לְךָ שָׁלוֹם.›; 35 ‹אֶת עַמּוֹ בַשָּׁלוֹם.›
- **Shaḥarit-Musaf-Shabbat › Verses of Praise** (49): 1 ‹רַגְלָיו, קָדוֹשׁ הוּא:›; 2 ‹קָדוֹשׁ יְיָ אֱלֹהֵינוּ:›; 3 ‹יָעִיר כָּל חֲמָתוֹ:›; 4 ‹וַאֲמִתְּךָ תָּמִיד יִצְּרוּנִי:›; 5 ‹כִּי מֵעוֹלָם הֵמָּה:›; 6 ‹לָעָם, בָּרוּךְ אֱלֹהִים:›; 7 ‹גְּמוּל עַל גֵּאִים:›; 8 ‹עַמְּךָ בִרְכָתֶךָ סֶּלָה:›; 9 ‹אֱלהֵי יַעֲקֹב סֶלָה:›; 10 ‹אָדָם בֹּטֵחַ בָּךְ:›; 11 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 12 ‹וְנַשֹּאֵם עַד הָעוֹלָם:›; 13 ‹כַּאֲשֶׁר יִחַלְנוּ לָךְ:›; 14 ‹וְיֶשְׁעֲךָ תִּתֶּן לָנוּ:›; 15 ‹וּפְדֵנוּ לְמַעַן חַסְדֶּךָ:›; 16 ‹הַרְחֶב פִּיךָ וַאֲמַלְאֵהוּ:›; 17 ‹הָעָם שֶׁײָ אֱלֹהָיו:›; 18 ‹כִּי גָמַל עָלָי:›; 19 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 20 ‹הָעָם אָמֵן. הַלְלוּיָהּ:›; 21 ‹תְּהַלֵּל יָהּ הַלְלוּיָהּ:›; 22 ‹יִשְׂמַח יְיָ בְּמַעֲשָׂיו:›; 23 ‹עַל הַשָּׁמַיִם כְּבוֹדוֹ:›; 24 ‹זִכְרְךָ לְדֹר וָדֹר:›; 25 ‹וּמַלְכוּתוֹ בַּכֹּל מָשָׁלָה:›; 26 ‹בַגּוֹיִם יְיָ מָלָךְ:›; 27 ‹אָבְדוּ גוֹיִם מֵאַרְצוֹ:›; 28 ‹הֵנִיא מַחְשְׁבוֹת עַמִּים:›; 29 ‹יְיָ הִיא תָקוּם:›; 30 ‹לִבּוֹ לְדֹר וָדֹר:›; 31 ‹הוּא צִוָּה וַיַּעֲמֹד:›; 32 ‹אִוָּהּ לְמוֹשָׁב לוֹ:›; 33 ‹יָהּ, יִשֹרָאֵל לִסְגֻלָּתוֹ:›; 34 ‹וְנַחֲלָתוֹ לֹא יַעֲזֹב:›; 35 ‹יָעִיר כָּל חֲמָתוֹ:›; 36 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 37 ‹עוֹד יְהַלְלוּךָ סֶּלָה:›; 38 ‹הָעָם שֶׁיְיָ אֱלֹהָיו:›; 39 ‹קָדְשׁוֹ לְעוֹלָם וָעֶד:›; 40 ‹וְעַד עוֹלָם, הַלְלוּיָהּ:›; 41 ‹לְעוֹלָם אָמֵן וְאָמֵן:›; 42 ‹שֹׁכֵן יְרוּשָׁלָיִם הַלְלוּיָהּ:›; 43 ‹הָאָרֶץ, אָמֵן וְאָמֵן:›; 44 ‹לְעָֹלַם וּלְעָֹלְמֵי עָֹלְמַיָּא:›; 45 ‹הַמְּלוּכָה וּמוֹשֵׁל בַּגּוֹיִם:›; 46 ‹וְהָיְתָה לַײָ הַמְּלוּכָה:›; 47 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 48 ‹אֶת שֵׁם קָדְשׁוֹ:›; 49 ‹טוֹב לְהוֹדוֹת לַײָ:›
- **Shaḥarit-Musaf-Shabbat › The Shema** (4): 50 ‹יְיָ | אֶחָד:›; 51 ‹תְהִלֹּת עֹשֵֹה פֶלֶא:›; 52 ‹יִמְלֹךְ לְעוֹלָם וָעֶד:›; 53 ‹יְיָ גָּאַל יִשְֹרָאֵל:›
- **Shaḥarit-Musaf-Shabbat › Shemoneh Esrei – The Amidah** (9): 54 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 55 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 56 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 57 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 58 ‹הַשְּׁבִיעִי שָׁבַת וַיִּנָּפַשׁ:›; 59 ‹וְיָשֵֹם לְךָ שָׁלוֹם:›; 60 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 61 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 62 ‹יְיָ צוּרִי וְגוֹאֲלִי:›
- **Shaḥarit-Musaf-Shabbat › Song of the Day** (7): 63 ‹הָעָם אָמֵן הַלְלוּיָהּ:›; 64 ‹שֹׁכֵן יְרוּשָׁלִָים הַלְלוּיָהּ:›; 65 ‹הָאָרֶץ, אָמֵן וְאָמֵן:›; 66 ‹אֵין עוֹד מִלְּבַדּוֹ.›; 67 ‹בְּכָל דּוֹר וָדֹר:›; 68 ‹יִמְלֹךְ לְעֹלָם וָעֶד:›; 69 ‹אֶת עַמּוֹ בַשָּׁלוֹם:›
- **Shaḥarit-Musaf-Shabbat › Order of the Torah Reading for Shabbat and Festivals** (29): 70 ‹וְיָנֻסוּ מְשַׂנְאֶיךָ מִפָּנֶיךָ.›; 71 ‹וּדְבַר יְיָ מִירוּשָׁלִָם.›; 72 ‹וָפֶשַׁע וְחַטָּאָה וְנַקֵּה:›; 73 ‹דַּעַת וְיִרְאַת יְיָ:›; 74 ‹בַּײָ חֶסֶד יְסוֹבְבֶנְּהוּ,›; 75 ‹יְיָ צוּרִי וְגֹאֲלִי:›; 76 ‹עֲנֵנִי בֶּאֱמֶת יִשְׁעֶךָ:›; 77 ‹לְטַב וּלְחַיִּין וְלִשְׁלָם:›; 78 ‹יְיָ | אֶחָד:›; 79 ‹וּנְרוֹמְמָה שְׁמוֹ יַחְדָּו:›; 80 ‹וְהַמִּתְנַשֵֹּא לְכֹל לְרֹאשׁ.›; 81 ‹רַגְלָיו, קָדוֹשׁ הוּא.›; 82 ‹קָדוֹשׁ יְיָ אֱלֹהֵינוּ:›; 83 ‹חַיִּים כֻּלְּכֶם הַיּוֹם:›; 84 ‹לִפְנֵי בְּנֵי יִשְֹרָאֵל:›; 85 ‹בָּהּ, וְתֹמְכֶיהָ מְאֻשָּׁר.›; 86 ‹וְכָל נְתִיבוֹתֶיהָ שָׁלוֹם.›; 87 ‹בִּשְׂמֹאלָהּ עֹשֶׁר וְכָבוֹד.›; 88 ‹יַגְדִּיל תּוֹרָה וְיַאְדִּיר:›; 89 ‹וְכִפֶּר אַדְמָתוֹ עַמּוֹ:›; 90 ‹וַײָ שֹׁכֵן בְּצִיּוֹן:›; 91 ‹דַּם עֲבָדֶיךָ הַשָּׁפוּךְ:›; 92 ‹שָׁכַח צַעֲקַת עֲנָוִים:›; 93 ‹כֵּן יָרִים רֹאשׁ:›; 94 ‹עוֹד יְהַלְלוּךָ סֶּלָה:›; 95 ‹הָעָם שֶׁיְיָ אֱלֹהָיו:›; 96 ‹קָדְשׁוֹ לְעוֹלָם וָעֶד:›; 97 ‹וְעַד עוֹלָם, הַלְלוּיָהּ:›; 98 ‹עַם קְרֹבוֹ, הַלְלוּיָהּ:›
- **Shaḥarit-Musaf-Shabbat › Musaf Amidah for Shabbat and Rosh Chodesh** (30): 99 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 100 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 101 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 102 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 103 ‹וְיָשֵֹם לְךָ שָׁלוֹם:›; 104 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 105 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 106 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 107 ‹וְקַוֵּה אֶל יְיָ:›; 108 ‹וְאֵין צוּר כֵּאלֹהֵינוּ:›; 109 ‹צוּר זוּלָתִי אֱלֹהֵינוּ:›; 110 ‹כִּי בָא מוֹעֵד:›; 111 ‹הֲלִיכוֹת עוֹלָם לוֹ,›; 112 ‹וְרַב שְׁלוֹם בָּנָיִךְ:›; 113 ‹וְאֵין לָמוֹ מִכְשׁוֹל:›; 114 ‹אֲבַקְֹשָׂה טוֹב לָךְ:›; 115 ‹אֶת עַמּוֹ בַשָּׁלוֹם:›; 116 ‹זוּלָתוֹ, כַּכָּתוּב בְּתוֹרָתוֹ:›; 117 ‹יִמְלֹךְ לְעוֹלָם וָעֶד.›; 118 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 119 ‹רְשָׁעִים כִּי תָבֹא:›; 120 ‹כִּי עִמָּנוּ אֵל:›; 121 ‹וַאֲנִי אֶסְבֹּל וַאֲמַלֵּט:›; 122 ‹יִהְיֶה הַחַלָּה הָאֶחָת:›; 123 ‹כֹּל יְמֵי חַיֶּיךָ:›; 124 ‹יְיָ אֱלֹהֶיךָ בְּחֹרֵב:›; 125 ‹הַשָּׁמָיִם לֹא, תִּשְׁכָּח:›; 126 ‹יְיָ אֱלֹהֶיךָ בַּמִּדְבָּר:›; 127 ‹בַּדֶּרֶךְ בְּצֵאתְכֶם מִמִּצְרָיִם:›; 128 ‹יוֹם הַשַּׁבָּת לְקַדְּשׁוֹ:›
- **Minḥah-Shabbat-Afternoon › Mincha for Shabbat** (33): 1 ‹עַל הַמִּזְבֵּחַ סָבִיב:›; 2 ‹קָדָשִׁים תִּהְיֶה לָכֶם:›; 3 ‹לִפְנֵי יְיָ, לְדֹרֹתֵיכֶם:›; 4 ‹מִמֶּנּוּ אִשֶּׁה לַײָ:›; 5 ‹אֱלֹהֵי יַעֲקֹב סֶלָה:›; 6 ‹אָדָם בֹּטֵחַ בָּךְ:›; 7 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 8 ‹עוֹד יְהַלְלוּךָ סֶּלָה:›; 9 ‹הָעָם שֶׁיְיָ אֱלֹהָיו:›; 10 ‹קָדְשׁוֹ לְעוֹלָם וָעֶד:›; 11 ‹וְעַד עוֹלָם, הַלְלוּיָהּ:›; 12 ‹מֵעַתָּה וְעַד עוֹלָם.›; 13 ‹יוֹשֵׁב תְּהִלּוֹת יִשְׂרָאֵל.›; 14 ‹כָל הָאָרֶץ כְּבוֹדוֹ.›; 15 ‹אַרְעָא זִיו יְקָרֵהּ.›; 16 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 17 ‹יִמְלךְ לְעֹלָם וָעֶד.›; 18 ‹לְעָלַם וּלְעָלְמֵי עָלְמַיָּא.›; 19 ‹וְהָכֵן לְבָבָם אֵלֶיךָ›; 20 ‹יָעִיר כָּל חֲמָתוֹ.›; 21 ‹חֶסֶד לְכָל קֹרְאֶיךָ.›; 22 ‹לְעוֹלָם, וְתוֹרָתְךָ אֱמֶת.›; 23 ‹לַאֲבֹתֵינוּ מִימֵי קֶדֶם.›; 24 ‹הָאֵל יְשׁוּעָתֵנוּ סֶלָה.›; 25 ‹אֱלֹהֵי יַעֲקֹב סֶלָה.›; 26 ‹אָדָם בֹּטֵחַ בָּךְ:›; 27 ‹יַעֲנֵנוּ בְיוֹם קָרְאֵנוּ:›; 28 ‹אֱלֹהַי לְעוֹלָם אוֹדֶךָּ:›; 29 ‹וְהָיָה יְיָ, מִבְטַחוֹ.›; 30 ‹יְיָ, צוּר עוֹלָמִים.›; 31 ‹עָזַבְתָּ דֹרְשֶׁיךָ יְיָ.›; 32 ‹יַגְדִּיל תּורָה וְיַאְדִּיר:›; 33 ‹עֲנֵנִי בֶּאֱמֶת יִשְׁעֶךָ:›
- **Minḥah-Shabbat-Afternoon › Order of the Torah Reading** (14): 34 ‹וְיָנֻסוּ מְשַׂנְאֶיךָ מִפָּנֶיךָ.›; 35 ‹וּדְבַר יְיָ מִירוּשָׁלִָם.›; 36 ‹לְטַב וּלְחַיִּין וְלִשְׁלָם:›; 37 ‹וּנְרוֹמְמָה שְׁמוֹ יַחְדָּו:›; 38 ‹וְהַמִּתְנַשֵֹּא לְכֹל לְרֹאשׁ.›; 39 ‹רַגְלָיו, קָדוֹשׁ הוּא.›; 40 ‹קָדוֹשׁ יְיָ אֱלֹהֵינוּ:›; 41 ‹חַיִּים כֻּלְּכֶם הַיּוֹם:›; 42 ‹לִפְנֵי בְּנֵי יִשְֹרָאֵל:›; 43 ‹בָּהּ, וְתֹמְכֶיהָ מְאֻשָּׁר.›; 44 ‹וְכָל נְתִיבוֹתֶיהָ שָׁלוֹם.›; 45 ‹בִּשְׂמֹאלָהּ עֹשֶׁר וְכָבוֹד.›; 46 ‹יַגְדִּיל תּוֹרָה וְיַאְדִּיר:›; 47 ‹עַם קְרֹבוֹ, הַלְלוּיָהּ:›
- **Minḥah-Shabbat-Afternoon › Shemoneh Esrei – The Amidah** (17): 48 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 49 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 50 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 51 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 52 ‹גּוֹי אֶחָד בָּאָרֶץ.›; 53 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 54 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 55 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 56 ‹וּבְהֵמָה תוֹשִׁיעַ יְיָ:›; 57 ‹אֱלֹהִים, מִי כָמוֹךָ:›; 58 ‹לְעוֹלָם, וְתוֹרָתְךָ אֱמֶת:›; 59 ‹זוּלָתוֹ, כַּכָּתוּב בְּתוֹרָתוֹ:›; 60 ‹יִמְלֹךְ לְעוֹלָם וָעֶד.›; 61 ‹אֶחָד וּשְׁמוֹ אֶחָד:›; 62 ‹רְשָׁעִים כִּי תָבֹא:›; 63 ‹כִּי עִמָּנוּ אֵל:›; 64 ‹וַאֲנִי אֶסְבֹּל וַאֲמַלֵּט:›
- **Shelosh-Regalim › Amidah for the Three Festivals** (11): 1 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 2 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 3 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 4 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 5 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 6 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 7 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 8 ‹וְיָשֵֹם לְךָ שָׁלוֹם:›; 9 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 10 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 11 ‹יְיָ צוּרִי וְגוֹאֲלִי:›
- **Shelosh-Regalim › Musaf for the Three Festivals** (30): 12 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›; 13 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 14 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 15 ‹אֱלֹהֵינוּ, יְיָ אֶחָד:›; 16 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 17 ‹כָל הָאָרֶץ כְּבוֹדוֹ:›; 18 ‹כְּבוֹד יְיָ מִמְּקוֹמוֹ:›; 19 ‹לְדֹר וָדֹר הַלְלוּיָהּ:›; 20 ‹עֹלַת הַתָּמִיד וְנִסְכָּהּ:›; 21 ‹עֲבוֹדָה לֹא תַעֲשֹוּ.›; 22 ‹תְּמִימִם יִהְיוּ לָכֶם:›; 23 ‹תְּמִימִם יִהְיוּ לָכֶם:›; 24 ‹כְבָשִֹים בְּנֵי שָׁנָה:›; 25 ‹עֲבֹדָה לֹא תַעֲשׂוּ›; 26 ‹עָשָׂר, תְּמִימִם יִהְיוּ:›; 27 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 28 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 29 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 30 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 31 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 32 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 33 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 34 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 35 ‹אַרְבָּעָה עָשָֹר, תְּמִימִם:›; 36 ‹עֲצֶרֶת תִּהְיֶה לָכֶם,›; 37 ‹שָׁנָה שִׁבְעָה, תְּמִימִם:›; 38 ‹וְיָשֵֹם לְךָ שָׁלוֹם:›; 39 ‹יְיָ צוּרִי וְגוֹאֲלִי:›; 40 ‹הוֹשִׁיעָה יְמִינְךָ וַעֲנֵנִי.›; 41 ‹יְיָ צוּרִי וְגוֹאֲלִי:›
- **Shelosh-Regalim › The Priestly Blessing** (1): 42 ‹וְיָשֵֹם לְךָ שָׁלוֹם:›
- **Shelosh-Regalim › Musaf for the First Day of Pesach** (1): 43 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›
- **Shelosh-Regalim › Musaf for Shemini Atzeret** (1): 44 ‹וּפִי יַגִּיד תְּהִלָּתֶךָ:›
- **Shelosh-Regalim › The Kiddush Rabba for the Three Festivals** (1): 45 ‹תִּקְרְאוּ אוֹתָם בְּמוֹעֲדָם:›
- **The-Blessing-Book › Birkat haMazon - Grace After Meals** (16): 1 ‹תָּמִיד תְּהִלָּתוֹ בְּפִי:›; 2 ‹זֶה כָּל הָאָדָם:›; 3 ‹קָדְשׁוֹ לְעוֹלָם וָעֶד:›; 4 ‹וְעַד עוֹלָם הַלְלוּיָהּ:›; 5 ‹וְנַחֲלַת אִמְרוֹ מֵאֵל:›; 6 ‹אֲשֶׁר לִפְנֵי יְיָ:›; 7 ‹מֵעַתָּה וְעַד עוֹלָם:›; 8 ‹כִּי לְעוֹלָם חַסְדּוֹ:›; 9 ‹אֲדָר וּשְׁלָלָם לָבוֹז.›; 10 ‹מִגְדּוֹל›; 11 ‹וּלְזַרְעוֹ עַד עוֹלָם:›; 12 ‹יְראוּ›; 13 ‹יַחְסְרוּ כָל טוֹב:›; 14 ‹כִּי לְעוֹלָם חַסְדּוֹ:›; 15 ‹לְכָל חַי רָצוֹן:›; 16 ‹וְהָיָה יְיָ מִבְטַחוֹ:›
- **Prayer-for-Travelers › Prayer for Travelers** (4): 1 ‹הַמָּקוֹם הַהוּא מַחֲנָיִם:›; 2 ‹לִישׁוּעָתְךָ קִוִּיתִי יְיָ:›; 3 ‹הַמָּקוֹם אֲשֶׁר הֲכִינוֹתִי:›; 4 ‹אֶת עַמּוֹ בַשָּׁלוֹם:›

## Appendix C — `<ref>` footnotes moved after their paragraph (wiki-format files)

The marker is removed from the Hebrew; the note text follows the paragraph as `<small class="en note">`, joined with " · " when a paragraph has several.

- **The-Morning-Blessings › Morning Blessings** (2): Psalms 104:1-2; Psalms 36:8-11
- **The-Morning-Blessings › The Morning Prayers** (4): Leviticus 19:18; Numbers 24:5; Psalms 5:8; Psalms 69:14
- **The-Morning-Blessings › The Akeidah** (14): Leviticus 26:42; Leviticus 26:44; Leviticus 26:45; Deuteronomy 30:3-5; Isaiah 33:2; Jeremiah 30:7; Isaiah 63:9; Micah 7:18-20; Isaiah 56:7; Ecclesiastes 56:7; Isaiah 40:15; Deuteronomy 6:4; II Kings 19:15; Zephaniah 3:20
- **The-Morning-Blessings › Offerings** (1): Leviticus 1:11
- **The-Morning-Blessings › Incense** (7): Psalms 46:8; Psalms 84:13; Psalms 20:10; Malachi 3:4; Leviticus 6:5; Hosea 14:3; Leviticus 7:37
- **Shaḥarit-Morning › Verses of Praise** (47): Psalms 99:5; Psalms 99:9; Psalms 78:38; Psalms 40:12; Psalms 25:6; Psalms 68:35-36; Psalms 94:1-2; Psalms 3:9; Psalms 46:8; Psalms 84:13; Psalms 2:10; Psalms 28:9; Psalms 33:20-22; Psalms 85:8; Psalms 44:27; Psalms 81:11; Psalms 144:15; Psalms 13:6; Zechariah 14:9; Psalms 106:47-48; Psalms 150:6; Psalms 104:31; Psalms 113:2-4; Psalms 135:13; Psalms 103:19; 1 Chronicles 16:31; Psalms 10:16; Psalms 33:10; Proverbs 19:21; Psalms 33:11; Psalms 33:9; Psalms 132:13; Psalms 135:4; Psalms 94:14; Psalms 78:38; Psalms 20:10; Psalm 84:5; Psalms 144:15; Psalms 145; Psalms 115:18; Psalm 89:53; Psalms 135:21; Psalms 72:18-19; This verse is a paraphrase of the previous Biblical verse from the Targum Onkelos in Aramaic; Psalms 22:29; Ovadiah 1:21; Zechariah 14:9
- **Shaḥarit-Morning › The Shema** (4): Deuteronomy 6:4; Exodus 15:11; Exodus 15:18; Isaiah 47:4
- **Shaḥarit-Morning › Shemoneh Esrei – The Amidah** (9): Psalm 51:17; Isaiah 6:3; Ezekiel 3:12; Psalms 146:10; Esther 3:13; Numbers 6:24-26; Psalms 19:15; Psalms 60:7, 108:7; Psalms 19:15
- **Shaḥarit-Morning › Supplication of Tachanun** (31): Nechemiah 9:33; Exodus 32:12; Exodus 34:5a; Exodus 34:5b; Exodus 34:5c; Exodus 34:6-7; Psalms 130:8; Psalms 78:38; Psalms 106:47; Psalms 130:3-4; Jeremiah 14:7; Psalm 25:6; Psalm 20:10; Daniel 9:15-19; Isaiah 64:7; Joel 2:17; Exodus 32:12; Psalms 118:25; Deuteronomy 6:4; Exodus 32:2; Psalms 115:2; Psalms 79:9; 2 Chronicles 20:12; Psalms 25:6; Psalms 33:22; Psalms 79:8; Psalms 123:3; Habakkuk 3:2; Psalms 20:10; Psalms 103:14; Psalms 79:9
- **Shaḥarit-Morning › Order of the Torah Reading for Weekdays** (41): Numbers 10:35; Isaiah 2:3; Zohar II, 206a; Psalms 34:4; 1 Chornicles 29:11; Psalms 99:5; Psalms 99:9; Deuteronomy 4:4; Deuteronomy 4:44; Proverbs 3:18; Proverbs 3:17; Proverbs 3:16; Isaiah 42:21; Psalm 84:5; Psalms 144:15; Psalms 145; Psalms 115:18; Isaiah 59:20-21; Psalms 22:4; Psalms 6:3; This verse is a paraphrase of the previous Biblical verse from the Targum Yonatan in Aramaic; Ezekiel 3:12; Exodus 15:18; This verse is a paraphrase of the previous Biblical verse from the Targum Onkelos in Aramaic; 1 Chronicles 29:18; Psalms 78:38; Psalms 86:5; Psalm 119:142; Micah 7:20; Psalms 68:20; Psalms 46:8; Psalms 84:13; Psalms 20:10; Psalms 30:13; Jeremiah 17:7; Isaiah 26:4; Psalms 9:11; Isaiah 42:21; Psalms 148:13-14; Isaiah 2:5; Micah 4:5
- **Shaḥarit-Morning › Song of the Day** (24): Psalm 24; Psalms 48; Psalm 82; Psalms 94:1 - 95:3; Psalm 81; Psalm 93; Psalms 106:47-48; Psalms 135:21; Psalms 72:18-19; Psalms 27:14; 1 Samuel 2:2; Psalms 18:32; Psalms 102:14; Chabakkuk 3:6; Isaiah 54:13; Psalms 119:165; Psalms 122:7-9; Psalms 29:11; Deuteronomy 4:39; Exodus 15:18; Zechariah 14:9; Proverbs 3:25; Isaiah 8:10; Isaiah 46:4
- **Shaḥarit-Morning › Rabbeinu Tam's Tefillin** (7): Deuteronomy 6:4; Deuteronomy 16:3; Deuteronomy 4:9-10; Deuteronomy 25:17-19; Deuteronomy 9:7; Deuteronomy 24:9; Deuteronomy 20:8
- **The-Bedtime-Shema › The Bedtime Shema** (2): Deuteronomy 6:4; Nechemiah 9:33
- **Kabbalat-Shabbat › Mincha for Shabbat Eve** (3): Deuteronomy 29:28; Isaiah 46:10; Psalms 89:53
- **Kabbalat-Shabbat › Maariv For Shabbat and Festivals** (7): Psalm 134; Psalms 42:9; Psalms 37:39-40; Psalms 46:8; Psalms 84:13; Psalms 20:10; Alternative versions: עַל תָּסִיר
- **Kabbalat-Shabbat › The Shema** (11): Deuteronomy 6:4; Job 9:10; Psalms 66:9; Exodus 15:11; Exodus 15:2; Exodus 15:18; Jeremiah 31:10; Exodus 31:16-17; Leviticus 23:44; Psalm 81:4-5; Leviticus 16:30
- **Kabbalat-Shabbat › Shemoneh Esrei – The Amidah** (12): Psalm 51:17; Psalms 19:15; Psalms 60:7, 108:7; Psalms 19:15; Genesis 1:31 – 2:1-3; Deuteronomy 4:39; Exodus 15:18; Zechariah 14:9; Proverbs 3:25; Isaiah 8:10; Proverbs 46:4; Psalms 140:14
- **Hallel-Musaf-Rosh-Ḥodesh › Hallel** (1): Genesis 24:1
- **Hallel-Musaf-Rosh-Ḥodesh › The Musaf Amidah** (13): Psalm 51:17; Isaiah 6:3; Ezekiel 3:12; Psalms 146:10; Numbers 28:11; Numbers 6:24-26; Psalms 19:15; Psalms 60:7, 108:7; Psalms 19:15; Psalms 27:14; 1 Samuel 2:2; Psalms 18:32; Psalms 102:14
- **Kiddush-Levana › Sanctification of the Moon** (7): Song of Songs 8:5; Genesis 1:16; Hosea 3:5; Deuteronomy 4:39; Deuteronomy 4:39; Exodus 15:18; Zechariah 14:9

## Appendix D — Lines split into a direction and a prayer paragraph

- **Shaḥarit-Morning › Verses of Praise**: "One should concentrate while while reciting the line פּוֹתֵחַ. It is customary to touch the tefillin on the arm while saying the first half of the verse, and tefillin on the head when saying the second" ‖ "עֵינֵי כֹל אֵלֶיךָ יְשַׂבֵּרוּ, וְאַתָּה נותֵן לָהֶם אֶת אָכ…"
- **Shaḥarit-Morning › Verses of Praise**: "It is customary to touch the tefillin on the arm when saying the words יוֹצֵר אוֹר and to touch the head tefillin when saying וּבוֹרֵא חֹשֶׁךְ, then to kiss the fingertips" ‖ "הַמֵּאִיר לָאָרֶץ וְלַדָּרִים עָלֶיהָ בְּרַחֲמִים, וּבְטוּבו…"
- **Shaḥarit-Morning › Verses of Praise**: "At this point it is customary for one to take the two front tzitzit into their right hand, then their back left tzitzit, then the back right. Then the tzitzit are moved to the left hand and held near the heart" ‖ "אַהֲבַת עוֹלָם אֲהַבְתָּנוּ יְיָ אֱלֹהֵינוּ, חֶמְלָה גְּדוֹל…"
- **Shaḥarit-Morning › The Shema**: "One should touch the arm tefillin when saying the words "וּקְשַׁרְתָּם לְאוֹת עַל יָדֶךָ", and touch the head tefillin when saying the words "וְהָיוּ לְטֹטָפֹת בֵּין עֵינֶיךָ", then kiss the fingertips" ‖ "וְאָהַבְתָּ אֵת יְיָ אֱלֹהֶיךָ, בְּכָל לְבָבְךָ, וּבְכָל נַפ…"
- **Shaḥarit-Morning › The Shema**: "One should touch the arm tefillin when saying the words "וּקְשַׁרְתֶּם אֹתָם לְאוֹת עַל יֶדְכֶם", and touch the head tefillin when saying the words "הָיוּ לְטוֹטָפֹת בֵּין עֵינֵיכֶם", then kiss the fingertips" ‖ "וְהָיָה אִם שָׁמֹעַ תִּשְׁמְעוּ אֶל מִצְוֹתַי אֲשֶׁר אָנֹכִי…"
- **Shaḥarit-Morning › Order of the Torah Reading for Weekdays**: "If no Kohen is present, the gabbai substitutes saying: “אֵין כַּאן כֹּהן, יַעֲמֹד (insert name) יִשְֹרָאֵל (לֵוִי) בִּמְקוֹם כֹּהֵן”" ‖ "וְתִגָּלֶה וְתֵרָאֶה מַלְכוּתוֹ עָלֵינוּ בִּזְמַן קָרוֹב, וְ…"
- **Shaḥarit-Morning › Order of the Torah Reading for Weekdays**: "One should concentrate while while reciting the line פּוֹתֵחַ. It is customary to touch the tefillin on the arm while saying the first half of the verse, and tefillin on the head when saying the second" ‖ "סוֹמֵךְ יְיָ לְכָל הַנּפְלִים, וְזוֹקֵף לְכָל הַכְּפוּפִים:…"
- **Shaḥarit-Morning › Song of the Day**: "Bow while saying the words “וַאֲנַחְנוּ כּוֹרְעִים וּמִשְׁתַּחֲוִים"" ‖ "עָלֵינוּ לְשַׁבֵּחַ לַאֲדוֹן הַכֹּל, לָתֵת גְּדֻלָּה לְיוֹצֵ…"
- **Shaḥarit-Morning › Rabbeinu Tam's Tefillin**: "One should touch the arm tefillin when saying the words "וּקְשַׁרְתָּם לְאוֹת עַל יָדֶךָ", and touch the head tefillin when saying the words "וְהָיוּ לְטֹטָפֹת בֵּין עֵינֶיךָ", then kiss the fingertips" ‖ "וְאָהַבְתָּ אֵת יְיָ אֱלֹהֶיךָ, בְּכָל לְבָבְךָ, וּבְכָל נַפ…"
- **Shaḥarit-Morning › Rabbeinu Tam's Tefillin**: "One should touch the arm tefillin when saying the words "וּקְשַׁרְתֶּם אֹתָם לְאוֹת עַל יֶדְכֶם", and touch the head tefillin when saying the words "הָיוּ לְטוֹטָפֹת בֵּין עֵינֵיכֶם", then kiss the fingertips" ‖ "וְהָיָה אִם שָׁמֹעַ תִּשְׁמְעוּ אֶל מִצְוֹתַי אֲשֶׁר אָנֹכִי…"
- **Shaḥarit-Morning › Rabbeinu Tam's Tefillin**: "One should touch the arm tefillin when saying the words "לְאוֹת עַל יָדְךָ", and touch the head tefillin when saying the words "וּלְזִכָּרוֹן בֵּין עֵינֶיךָ", then kiss the fingertips'One should touch the arm tefillin when saying the words "לְאוֹת עַל יָדְכָה", and touch the head tefillin when saying the words "וּלְטוֹטָפֹת בֵּין עֵינֶיךָ", then kiss the fingertips" ‖ "וַיְדַבֵּר יְיָ אֶל מֹשֶׁה לֵּאמֹר: קַדֶּשׁ לִי כָל בְּכוֹר …"
- **Kabbalat-Shabbat › Shemoneh Esrei – The Amidah**: "Bow while saying the words “וַאֲנַחְנוּ כּוֹרְעִים וּמִשְׁתַּחֲוִים"" ‖ "עָלֵינוּ לְשַׁבֵּחַ לַאֲדוֹן הַכֹּל, לָתֵת גְּדֻלָּה לְיוֹצֵ…"
- **Kiddush-Levana › Sanctification of the Moon**: "Bow while saying the words “וַאֲנַחְנוּ כּוֹרְעִים וּמִשְׁתַּחֲוִים"" ‖ "עָלֵינוּ לְשַׁבֵּחַ לַאֲדוֹן הַכֹּל, לָתֵת גְּדֻלָּה לְיוֹצֵ…"

## Appendix E — Counts

| Change | Count |
|---|---|
| '' italic marker removed | 1396 |
| <center> tag removed | 924 |
| footnote number removed | 396 |
| inline English wrapped in <small class="en"> | 360 |
| <div align> tag removed | 262 |
| <ref>…</ref> footnote moved after its paragraph | 247 |
| '''bold''' → <b> | 149 |
| Hebrew – English heading line → <big> + English heading | 128 |
| <u> tag removed | 78 |
| ★ sub-heading → <big> | 64 |
| Omer chart row → one paragraph | 49 |
| Divine-Name acronym paired with its line as <small class="kavanah"> | 42 |
| wiki table linearised | 38 |
| direction + prayer on one line → two paragraphs | 13 |
| <sup> tag removed (ordinal suffix kept as text) | 6 |
| <nowiki> tag removed | 6 |
| direction in visual order kept whole as <small class="en"> (FORCE_DIRECTION) | 2 |
| [[Image:]] removed | 2 |
| unpaired ''' removed | 1 |

| File | BOM removed | CRLF → LF | U+200E/200F removed | presentation forms decomposed |
|---|---|---|---|---|
| The-Morning-Blessings | 0 | 0 | 0 | 0 |
| Shaḥarit-Morning | 0 | 0 | 0 | 1 |
| Minḥah-Afternoon | 1 | 395 | 0 | 0 |
| Maariv-Evening | 1 | 342 | 0 | 0 |
| The-Bedtime-Shema | 0 | 0 | 0 | 0 |
| Tikkun-Ḥatzot | 1 | 145 | 0 | 0 |
| Kabbalat-Shabbat | 0 | 0 | 0 | 0 |
| The-Shabbat-Book | 1 | 0 | 0 | 0 |
| Shaḥarit-Musaf-Shabbat | 1 | 0 | 0 | 1 |
| Minḥah-Shabbat-Afternoon | 1 | 0 | 0 | 0 |
| Hallel-Musaf-Rosh-Ḥodesh | 0 | 0 | 0 | 0 |
| Shelosh-Regalim | 1 | 0 | 0 | 0 |
| Ḥag-Sukkot | 1 | 225 | 0 | 1224 |
| The-Blessing-Book | 1 | 595 | 2 | 0 |
| Sefirat-HaOmer | 1 | 352 | 0 | 0 |
| Kiddush-Levana | 0 | 0 | 0 | 0 |
| Megillat-Esther-Blessings | 1 | 0 | 0 | 0 |
| Prayer-for-Travelers | 1 | 46 | 0 | 0 |
## Appendix F — Pointing anomalies found by scan (not changed)

Location: file node › leaf ¶paragraph index in the pack (0-based), then the word as it stands.

### F1. The same point twice on one letter

- The Weekday Morning Service, Verses of Praise ¶51: הַשָּׁמָיִםֹֹ
- The Weekday Morning Service, Shemoneh Esrei – The Amidah ¶100: בָּשָֹֹר
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶135: הַשָּׁמָיִםֹֹ
- Hallel and Musaf for Rosh Chodesh, The Musaf Amidah ¶47: בָּשָֹֹר
- Prayers for the Three Festivals, Musaf for the First Day of Pesach ¶13: לִרְסִיסוֹֹ
- Prayers for the Three Festivals, Musaf for the First Day of Pesach ¶16: לִִרְצּוֹת
- Sanctification of the Moon, Sanctification of the Moon ¶3: הַשָּׁמָיִםֹֹ

### F2. Two vowels on one letter

Not listed: יְרוּשָׁלִַם / יְרוּשָׁלִָם (qamats or patach together with hiriq under the lamed). That is the accepted way of pointing the unwritten yod of Yerushalayim, not an error.

- The Morning Blessings, Incense ¶14: וִירוּשָׁלִָיִם [לִָ]
- The Weekday Morning Service, Order of the Torah Reading for Weekdays ¶2: מִירוּשָׁלִָם [לִָ]
- The Weekday Morning Service, Song of the Day ¶25: יְרוּשָׁלִָים [לִָ]
- The Weekday Morning Service, Song of the Day ¶65: עָשַָׂנוּ [שַָׂ]
- The Afternoon Prayers for Weekdays, Mincha for Weekdays ¶21: וִירוּשָׁלִָים [לִָ]
- The Afternoon Prayers for Weekdays, Supplication of Tachanun ¶35: עָשַָׂנוּ [שַָׂ]
- The Evening Prayers for Weekdays, Shemoneh Esrei – The Amidah ¶143: עָשַָׂנוּ [שַָׂ]
- The Bedtime Shema, The Bedtime Shema ¶51: יְרוּשָׁלִָם [לִָ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶24: יְרוּשָׁלִָיִם [לִָ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶24: יְרוּשָׁלִַיִם [לִַ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶24: יְרוּשָׁלִָיִם [לִָ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶28: מְִצְרַיִם [מְִ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶31: יְרוּשָׁלִָם [לִָ]
- Tikkun Chatzot, Tikkun Chatzot – The Midnight Rite ¶31: יְרוּשָׁלִַם [לִַ]
- Kabbalat Shabbat, Shemoneh Esrei – The Amidah ¶108: עָשַָׂנוּ [שַָׂ]
- Shacharit and Musaf for Shabbat and Festivals, Song of the Day ¶5: יְרוּשָׁלִָים [לִָ]
- Shacharit and Musaf for Shabbat and Festivals, Order of the Torah Reading for Shabbat and Festivals ¶1: מִירוּשָׁלִָם [לִָ]
- Shacharit and Musaf for Shabbat and Festivals, Musaf Amidah for Shabbat and Rosh Chodesh ¶123: עָשַָׂנוּ [שַָׂ]
- The Afternoon Prayers for Shabbat, Mincha for Shabbat ¶21: וִירוּשָׁלִָים [לִָ]
- The Afternoon Prayers for Shabbat, Order of the Torah Reading ¶1: מִירוּשָׁלִָם [לִָ]
- The Afternoon Prayers for Shabbat, Shemoneh Esrei – The Amidah ¶88: עָשַָׂנוּ [שַָׂ]
- Prayers for the Three Festivals, Musaf for the First Day of Pesach ¶16: לִִרְצּוֹת [לִִ]
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: לַתַָּמִיד [תַָּ]
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: הַפֵֶּסַח [פֵֶּ]
- The Blessings Book, Blessings of Praise and Gratitude ¶8: וְנֶאֵֶמָן [אֵֶ]
- The Blessings Book, Birkat haMazon - Grace After Meals ¶3: יְרוּשָׁלִָיִם [לִָ]
- The Blessings Book, Birkat haMazon - Grace After Meals ¶3: יְרוּשָׁלִַיִם [לִַ]
- The Blessings Book, Birkat haMazon - Grace After Meals ¶3: יְרוּשָׁלִָיִם [לִָ]
- Sanctification of the Moon, Sanctification of the Moon ¶22: עָשַָׂנוּ [שַָׂ]

### F3. ש with neither a shin dot nor a sin dot, in pointed text (holam-on-ש cases excluded, see §5.1)

- The Morning Blessings, Incense ¶4: וּשְּלֹשָה
- The Morning Blessings, Incense ¶4: וּשְּלֹשָה
- The Morning Blessings, Incense ¶8: מִשגָּב
- The Morning Blessings, Incense ¶29: שפְתוֹתֵינוּ
- The Weekday Morning Service, Verses of Praise ¶1: בַּשּרוּ
- The Weekday Morning Service, Verses of Praise ¶1: יִשמְחוּ
- The Weekday Morning Service, Verses of Praise ¶1: יִשרָאֵל
- The Weekday Morning Service, Verses of Praise ¶1: יִשרָאֵל
- The Weekday Morning Service, Verses of Praise ¶1: יִשרָאֵל
- The Weekday Morning Service, Verses of Praise ¶9: יִשרָאֵל
- The Weekday Morning Service, Verses of Praise ¶31: מַעֲשיו
- The Weekday Morning Service, Verses of Praise ¶47: שבְרוֹ
- The Weekday Morning Service, Verses of Praise ¶62: וְשַמְתָּ
- The Weekday Morning Service, Verses of Praise ¶101: לְשָלוֹם
- The Weekday Morning Service, The Shema ¶19: יָשִים
- The Weekday Morning Service, Shemoneh Esrei – The Amidah ¶102: שֶׁעָשיתָ
- The Weekday Morning Service, Supplication of Tachanun ¶30: תִטְּשֵנוּ
- The Weekday Morning Service, Order of the Torah Reading for Weekdays ¶12: הַנְּשוּאִים
- The Weekday Morning Service, Order of the Torah Reading for Weekdays ¶78: מַעֲשיו
- The Weekday Morning Service, Order of the Torah Reading for Weekdays ¶99: לֵשְנֵי
- The Weekday Morning Service, Song of the Day ¶18: חֲמִישִי
- The Weekday Morning Service, Song of the Day ¶46: שְׁלֹשָה
- The Afternoon Prayers for Weekdays, Mincha for Weekdays ¶16: מִשגָּב
- The Afternoon Prayers for Weekdays, Mincha for Weekdays ¶24: שגְּבֵנוּ
- The Afternoon Prayers for Weekdays, Mincha for Weekdays ¶42: מַעֲשיו
- The Afternoon Prayers for Weekdays, Shemoneh Esrei – The Amidah ¶114: שֶׁעָשיתָ
- The Evening Prayers for Weekdays, Maariv for Weekdays and the Conclusion of Shabbat ¶4: מִשגָּב
- The Evening Prayers for Weekdays, Shemoneh Esrei – The Amidah ¶95: שֶׁעָשיתָ
- The Evening Prayers for Weekdays, Shemoneh Esrei – The Amidah ¶130: לֵשְנֵי
- Kabbalat Shabbat, Mincha for Shabbat Eve ¶7: יִשְתַּחֲוֶה
- Kabbalat Shabbat, Kabbalat Shabbat – Welcoming the Sabbath ¶40: כִּמְשֹוֹש
- Kabbalat Shabbat, Maariv For Shabbat and Festivals ¶2: מִשגָּב
- Kabbalat Shabbat, Shemoneh Esrei – The Amidah ¶45: שֶׁעָשיתָ
- Kabbalat Shabbat, Shemoneh Esrei – The Amidah ¶120: שיבָה
- The Shabbat Book, The Shabbat Evening Kiddush ¶30: וּשמָאלָא
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶1: בַּשּרוּ
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶1: יִשמְחוּ
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶1: יִשרָאֵל
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶1: יִשרָאֵל
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶1: יִשרָאֵל
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶8: יִשרָאֵל
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶117: מַעֲשיו
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶131: שבְרוֹ
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶145: וְשַמְתָּ
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶156: וְהַמֵּשיחַ
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶156: פְרוּשוֹת
- Shacharit and Musaf for Shabbat and Festivals, Verses of Praise ¶203: לְשָלוֹם
- Shacharit and Musaf for Shabbat and Festivals, The Shema ¶16: יָשִים
- Shacharit and Musaf for Shabbat and Festivals, Shemoneh Esrei – The Amidah ¶66: שֶׁעָשיתָ
- Shacharit and Musaf for Shabbat and Festivals, Order of the Torah Reading for Shabbat and Festivals ¶32: הַנְּשוּאִים
- Shacharit and Musaf for Shabbat and Festivals, Order of the Torah Reading for Shabbat and Festivals ¶179: מַעֲשיו
- Shacharit and Musaf for Shabbat and Festivals, Musaf Amidah for Shabbat and Rosh Chodesh ¶47: יִשמְחוּ
- Shacharit and Musaf for Shabbat and Festivals, Musaf Amidah for Shabbat and Rosh Chodesh ¶50: לַעֲשוֹת
- Shacharit and Musaf for Shabbat and Festivals, Musaf Amidah for Shabbat and Rosh Chodesh ¶66: שֶׁעָשיתָ
- Shacharit and Musaf for Shabbat and Festivals, Musaf Amidah for Shabbat and Rosh Chodesh ¶107: שְׁלֹשָה
- The Afternoon Prayers for Shabbat, Mincha for Shabbat ¶16: מִשגָּב
- The Afternoon Prayers for Shabbat, Mincha for Shabbat ¶24: שגְּבֵנוּ
- The Afternoon Prayers for Shabbat, Mincha for Shabbat ¶42: מַעֲשיו
- The Afternoon Prayers for Shabbat, Mincha for Shabbat ¶56: לֵשְנֵי
- The Afternoon Prayers for Shabbat, Order of the Torah Reading ¶7: הַנְּשוּאִים
- The Afternoon Prayers for Shabbat, Shemoneh Esrei – The Amidah ¶63: שֶׁעָשיתָ
- Hallel and Musaf for Rosh Chodesh, The Musaf Amidah ¶49: שֶׁעָשיתָ
- Prayers for the Three Festivals, Musaf for the Three Festivals ¶73: וְלַעֲשוֹת
- Prayers for the Three Festivals, Musaf for the Three Festivals ¶117: יִשבְּעוּ
- Prayers for the Three Festivals, Musaf for the Three Festivals ¶118: בְּשָׁלֹש
- Prayers for the Three Festivals, Musaf for Shemini Atzeret ¶18: וְשחְתָּ
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: שָחַט
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: שֶבְּרֹאשׁ
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: שֶעַל
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: יוֹשֶבֶת
- Prayers for the Three Festivals, Order of the Pesach Offering ¶1: וְהַשְּׁלִישִת
- The Blessings Book, Blessings of Praise and Gratitude ¶19: שֶכָּכָה
- The Blessings Book, Birkat haMazon - Grace After Meals ¶5: יִשמְחוּ
- The Blessings Book, Birkat haMazon - Grace After Meals ¶56: שֶׁעָשיתָ
- Counting the Omer, Counting the Omer ¶39: וּשְלֹשִׁים
- Counting the Omer, Counting the Omer ¶53: שָבוּעוֹת
- Prayer for Travelers, Prayer for Travelers ¶4: וְתִשְלַח
- Prayer for Travelers, Prayer for Travelers ¶7: כַּאֲשֶר
