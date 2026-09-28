# Shabbat zemirot (זמירות לשבת): import from Hebrew Wikisource

Pack: `src/data/liturgy/zemirot.mjs` (51 items, 148,524 bytes, about 36 KB gzipped).
Build: `scripts/build-zemirot.mjs`. Raw sources: `sources/wikisource-zemirot/` (see its README.md).
Built on 2026-09-28. The build is deterministic: two runs give the same bytes
(sha1 `762bff88658cbbcbc69d1c3f10c921c724642335`).

```
node scripts/build-zemirot.mjs --fetch      # only to refresh the cache; pinned to manifest.json revision ids
node scripts/build-zemirot.mjs              # offline parse → src/data/liturgy/zemirot.mjs
node scripts/build-zemirot.mjs --report r.json   # plus per-item transformation counts
```

## 1. Sources and licence

| Role | Source | Use |
|---|---|---|
| Text | Hebrew Wikisource (ויקיטקסט העברי), CC BY-SA 4.0 | Every word and every nikud mark in the pack |
| Index | Wikisource page [זמירות לשבת](https://he.wikisource.org/wiki/%D7%96%D7%9E%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%A9%D7%91%D7%AA), rev 3019040 | Which zemirot, which meal, order |
| Index only | Daat, `daat.ac.il/daat/shabat/zmirot/tohen-2.htm` (copyrighted) | Checking the list and the meals; 5 items added from it. **No text taken.** |
| Index only | Hamichlol, `זמירות ופיוטים לשבת` | Checking the list. **No text taken.** |

The poems are public domain. The Wikisource transcriptions (pointing, layout) are CC BY-SA 4.0, so **share-alike
applies to the pack**. `source` in the pack gives provider, licence, index URL, access date, attribution
("ויקיטקסט העברי") and the index revision; every item gives its own page `url` and `revid`.

## 2. What is in the pack

Groups and order follow the Wikisource index page. Where the index has an item under "כללי" (יה ריבון, צמאה נפשי)
it is placed where Daat puts it. Items added from the Daat list are marked ⁺. "¶" = number of paragraphs (stanzas).

**ליל שבת (`friday-night`) — 16**

| # | id | Title | Wikisource page | rev | ¶ | author |
|---|---|---|---|---|---|---|
| 1 | shalom-aleichem | שלום עליכם | שלום עליכם מלאכי השרת | 3015815 | 5 | — |
| 2 | ribon-kol-haolamim | ריבון כל העולמים | ריבון כל העולמים | 3017667 | 3 | — |
| 3 | eshet-chayil | אשת חיל | אשת חיל (זמר) | 3016398 | 22 | — |
| 4 | atkinu-leil-shabbat | אתקינו סעודתא | אתקינו סעודתא | 3023498 | 2 | האר"י |
| 5 | azamer-bishvachin | אזמר בשבחין | אזמר בשבחין | 1457480 | 20 | האר"י |
| 6 | kol-mekadesh | כל מקדש שביעי | כל מקדש שביעי | 3017619 | 7 | משה בן קלונימוס |
| 7 | menucha-vesimcha | מנוחה ושמחה | מנוחה ושמחה | 3017623 | 5 | — |
| 8 | ma-yedidut | מה ידידות | מה ידידות | 3017621 | 12 | — |
| 9 | ashir-lael | אשיר לאל אשר שבת | אשיר לאל | 3016391 | 7 | — |
| 10 | ma-yafit | מה יפית | מה יפית | 3017622 | 24 | — |
| 11 | yom-shabbat-kodesh-hu | יום שבת קדש הוא | יום שבת קדש הוא | 3018026 | 9 | — |
| 12 | yah-ribon | יה ריבון | יה ריבון | 3079419 | 5 | רבי ישראל נג'ארה |
| 13 | tzur-mishelo | צור משלו | צור משלו | 3017661 | 9 | — |
| 14 | yom-ze-leyisrael | יום זה לישראל | יום זה לישראל | 3016455 | 23 | — |
| 15 | yah-echsof | יה אכסוף | י-ה אכסוף | 3016409 | 8 | — |
| 16 | bar-yochai ⁺ | בר יוחאי | בר יוחאי | 3019338 | 11 | רבי שמעון לביא |

**יום שבת (`shabbat-day`) — 15**

| # | id | Title | Wikisource page | rev | ¶ | author |
|---|---|---|---|---|---|---|
| 1 | atkinu-yom-shabbat | אתקינו סעודתא | אתקינו סעודתא | 3023498 | 2 | האר"י |
| 2 | asader-lisudata | אסדר לסעודתא | אסדר לסעודתא | 3021388 | 12 | האר"י |
| 3 | chai-hashem | חי ה' | חי ה' | 3016406 | 8 | — |
| 4 | baruch-hashem-yom-yom | ברוך ה' יום יום | ברוך ה' יום יום | 3017971 | 12 | רבי שמעון הגדול |
| 5 | baruch-el-elyon | ברוך אל עליון | ברוך אל עליון | 3016400 | 14 | רבי ברוך בר שמואל ממגנצא |
| 6 | yom-ze-mechubad | יום זה מכובד | יום זה מכובד | 3016451 | 11 | — |
| 7 | yom-shabbaton | יום שבתון | יום שבתון | 3040514 | 10 | רבי יהודה הלוי |
| 8 | ki-eshmera | כי אשמרה שבת | כי אשמרה שבת | 3040223 | 11 | רבי אברהם אבן עזרא |
| 9 | shimru-shabtotai | שמרו שבתותי | שמרו שבתותי | 3040468 | 9 | רבי שלמה אבן גבירול |
| 10 | dror-yikra | דרור יקרא | דרור יקרא | 3024509 | 6 | דונש בן לברט |
| 11 | shabbat-hayom-lashem | שבת היום לה' | שבת היום לה' | 3017645 | 5 | — |
| 12 | beyom-shabbat-ashabeach ⁺ | ביום שבת אשבח | ביום שבת אשבח | 3020680 | 10 | רבי שלום שבזי |
| 13 | yom-hashabbat-ein-kamohu | יום השבת אין כמוהו | יום השבת אין כמוהו | 3016417 | 6 | — |
| 14 | al-ahavatcha | על אהבתך | על אהבתך | 3017663 | 17 | רבי יהודה הלוי |
| 15 | tzama-nafshi | צמאה נפשי | צמאה נפשי | 3083873 | 27 | רבי אברהם אבן עזרא |

**סעודה שלישית (`seudah-shlishit`) — 5**

| # | id | Title | Wikisource page | rev | ¶ | author |
|---|---|---|---|---|---|---|
| 1 | atkinu-seudah-shlishit | אתקינו סעודתא | אתקינו סעודתא | 3023498 | 2 | האר"י |
| 2 | bnei-heichala | בני היכלא | בני היכלא | 3024303 | 10 | האר"י |
| 3 | mizmor-ledavid | מזמור לדוד | תהלים כג/ניקוד | 2989159 | 6 | — |
| 4 | yedid-nefesh | ידיד נפש | ידיד נפש | 3016239 | 4 | רבי אלעזר אזכרי |
| 5 | el-mistater | אל מסתתר | אל מסתתר | 3016244 | 11 | — |

**מוצאי שבת ומלווה מלכה (`motzaei-shabbat`) — 15**

| # | id | Title | Wikisource page | rev | ¶ | author |
|---|---|---|---|---|---|---|
| 1 | hamavdil | המבדיל בין קודש לחול | המבדיל בין קודש לחול | 3083009 | 16 | — |
| 2 | eliyahu-hanavi | אליהו הנביא | אליהו הנביא | 3021751 | 22 | — |
| 3 | atkinu-melave-malka | אתקינו סעודתא | זמירות למלווה מלכה | 3018249 | 2 | האר"י |
| 4 | bemotzaei-yom-menucha | במוצאי יום מנוחה | במוצאי יום מנוחה | 3021749 | 12 | — |
| 5 | el-eliyahu ⁺ | אל אליהו | אל אליהו | 3018206 | 11 | — |
| 6 | laner-velivsamim ⁺ | לנר ולבשמים | לנר ולבשמים | 3020438 | 6 | רבי סעדיה משתא |
| 7 | chadesh-sasoni | חדש ששוני | חדש ששוני | 3018234 | 5 | — |
| 8 | agil-veesmach | אגיל ואשמח | אגיל ואשמח | 3018025 | 5 | — |
| 9 | elokim-yisadenu | אלהים יסעדנו | אלהים יסעדנו | 3018793 | 10 | — |
| 10 | eli-chish-goali | אלי חיש גואלי | אלי חיש גואלי | 3018214 | 9 | — |
| 11 | adir-ayom-venora | אדיר איום ונורא | אדיר איום ונורא | 3021759 | 11 | — |
| 12 | ish-chasid | איש חסיד | איש חסיד | 3026838 | 36 | — |
| 13 | amar-hashem-leyaakov | אמר ה' ליעקב | אמר ה' ליעקב | 3018250 | 22 | — |
| 14 | al-bayit-ze ⁺ | על בית זה | על בית זה ויושביהו | 3018500 | 17 | רבי יוסף חיים מבגדד |
| 15 | ribon-haolamim-motzaei-shabbat | רבון העולמים | רבון העולמים למוצאי שבת | 3015345 | 5 | — |

**Authors** are given only where the Wikisource page states one: an "מחבר:" line or author link (יה ריבון,
ידיד נפש, בר יוחאי, ביום שבת אשבח, לנר ולבשמים, אסדר/בני היכלא/אתקינו/אזמר — the Ari), a name in the header
(ברוך אל עליון: "רבי ברוך בר שמואל ממגנצא"; כי אשמרה: "(אבן עזרא)"; שמרו שבתותי: "(אבן גבירול)"; יום שבתון:
"(הלוי)"), or an author category (כל מקדש, ברוך ה' יום יום, דרור יקרא, על אהבתך, צמאה נפשי, על בית זה). An
acrostic signature alone (e.g. מה יפית "מרדכי בר יצחק", מנוחה ושמחה "משה") is not treated as an author.

### Placement relative to the request

The request listed דרור יקרא, יום שבתון and ברוך אל עליון under Friday night. The Wikisource index and Daat both
put them at the day meal, so the pack does too (each item appears once). יום שבת קדש הוא is at Friday night in both
indexes. "כה אכסוף" in the request is יה אכסוף (page title "י-ה אכסוף").

## 3. What is not in the pack

**Not on Hebrew Wikisource** (searched by title): יום שבת תשמח מאד נפשי, נודה לאל, יאמנו דברים (Daat);
מבורך שבת, למולדת שובי רוני (Hamichlol). The Wikisource index says these were **deleted for copyright**:
אעופה אשכונה, שמח בני בחלקך, יהלומה, חביבי, נגילה הללויה, אל גליל.

**Left out on purpose** (not table zemirot, or not the common set):
- Liturgy, not zemirot: לכה דודי, שיר הכבוד (אנעים זמירות), קידוש לשבת (the page only transcludes other pages),
  הבדלה, ויתן לך (collection of verses), the Zohar passage before seudah shlishit, ברוך שאמר.
- The Wikisource index's "שבתות מיוחדות" (אזכרה רחמיך, אכלו משמנים) and "פיוטים" (חיש חיש אלופי, עזרני אל חי,
  ארץ ראשית) sections.
- Present on Wikisource but outside the common set, available for a later pass: יודוך רעיוני, שירו לאל נבוני,
  חי ונעלם, שימו לב על הנשמה (Daat's "additional" list); יחד באורך, אהבת הדסה, אליך אקרא יה, יא טאיר אלבאן
  (Hamichlol); the remaining members of the Wikisource category "זמירות לשבת" / "זמירות למוצאי שבת"
  (e.g. אגדלך, אשר לו ים ויבשת, קמתי להלל, תשבי צורי, ברבות עתים וימים …).
- Alternative versions printed on the same pages: the Machzor Vitry versions (כל מקדש, דרור יקרא, אליהו הנביא,
  במוצאי יום מנוחה, אדיר איום ונורא), the original-pointing ידיד נפש (נוסח א), the Babylonian Shemini Atzeret
  version of צמאה נפשי (נוסח ב), the unpointed copies (צור משלו, אזמר, אסדר, שמרו, על אהבתך), and the annotated
  copies (יה ריבון, יום השבת אין כמוהו).

## 4. Which part of each page was taken

Default: the page's transcluded text — everything outside `<noinclude>` (an unclosed `<noinclude>` runs to the end),
cut at the first `==heading==`. Exceptions, set per item in the script:

| Item | Region | Why |
|---|---|---|
| אשת חיל | section "השיר מעוצב לפי צורתו הספרותית" | The other section transcludes Proverbs 31, not available offline |
| אתקינו ×3 | `<קטע>` fragments "ליל שבת" / "יום שבת" / "סעודה שלישית" | The page marks each meal's text; the shared opening and the meal line become two paragraphs |
| אתקינו (מלווה מלכה) | section "אתקינו סעודתא" of זמירות למלווה מלכה | The אתקינו page's melave-malka line is unpointed; this page has it pointed. Paragraph break before "דָּא הִיא", as for the other meals |
| אזמר בשבחין | `<קטע>` "אזמר בשבחין מנוקד" | Pointed version |
| צור משלו | section "מנוקד" | The page's first section is unpointed |
| יה אכסוף, דרור יקרא, בני היכלא | the section named after the poem | Page starts with a heading |
| יום השבת אין כמוהו | section "הפיוט ללא ביאור" | The other section is annotated |
| יה ריבון | first table, column 1 only | Column 2 is a modern Hebrew translation; header row "הפיוט / תרגום" dropped |
| צמאה נפשי | `<קטע>` "א" | "נוסח א" is the one the page says is used in zemirot |
| ידיד נפש | `<קטע>` "נוסח ב" | The version sung today; נוסח א is the author's original with conjectured pointing |
| מזמור לדוד | `<קטע>` "פרק כג" of תהלים כג/ניקוד, minus `<קטע>` "סימן" | Drops the verse letters |

## 5. Transformations (all of them)

Counts are totals over the 51 items (from `--report`).

| Source markup | Result | Count |
|---|---|---|
| `{{ש}}`, `{{ר1}}`, `{{ר2}}` and a plain source line end | line break `<br>` | 555 / 150 / 10 |
| blank line | new paragraph (stanza) | — |
| `{{סי\|X}}`, `{{סי\|X\|n}}`, `{{אקרוסטיכון\|X}}` (acrostic letters) | `<b>X</b>` | 363 / 36 |
| `'''X'''` (acrostic letters in אזמר בשבחין) and `{{מודגש\|X}}` (שלום עליכם, אשיר לאל) | `<b>X</b>` (counts include bold inside headers that were then dropped) | 25 / 10 |
| `{{רפרן\|a\|b…}}` refrain | its own paragraph, lines joined by `<br>`, kept wherever the page prints it; text on the same source line after it (e.g. the closing ")" in יום זה לישראל) stays with it | 88 |
| `{{נוא\|X}}` (alternative reading) | `<small>[נ"א: X]</small>`, the template's own wording | 10 |
| `{{ק\|X}}` / `{{קטן\|X}}` inside a line | `<small>X</small>` | 3 |
| `{{ק\|…}}` filling a whole line (editor's note / link) | dropped, except in שלום עליכם where the note about the בשבתכם stanza is kept in `<small>` | 1 dropped |
| `{{נוסחי תפילה קצרים\|אשכנז=…\|מזרח=…}}` | every variant, as Wikisource shows it when no rite is chosen: `<small>נוסח אשכנז:</small> … <small>נוסח עדות המזרח:</small> …` | 8 |
| `{{נוסחי תפילה מוסתר\|מזרח=…}}` (המבדיל's Edot HaMizrach stanzas) | shown, after the page's own heading "בסידורי עדות המזרח נוסף:" in `<small>` | 1 |
| `{{צמל\|X\|src}}`, `{{מילת קבע\|X}}`, `{{גלגל-2\|X}}`, `{{עם-ניקוד\|X}}`, `{{שיר מנוקד\|X}}`, `{{רן\|X}}`, `<poem>` | X (layout/emphasis only; the verse source is dropped) | — |
| `{{צ\|X}}` | "X" (the template adds quotation marks) | 1 |
| wiki tables | one line per row, cells joined by a space; empty or `{{ס}}` rows = paragraph break. In אשת חיל, בני היכלא, אמר ה' ליעקב each row is a paragraph (verse / bayit) | 100 rows |
| אסדר לסעודתא, איש חסיד, לנר ולבשמים | each source line (one bayit) is a paragraph — the page prints the whole poem as one block | — |
| יום השבת אין כמוהו | one blank line = line break, two = stanza break (the page's spacing) | — |
| Dropped furniture | `{{הור}}` headers (acrostic signature), `{{ממס}}` verse sources (71), `{{הערה}}` footnotes (9), `{{מקור}}`, `{{אפור מוקטן}}` (sefirah labels in בר יוחאי), `{{טקסט מנוקד}}`, `{{סוף}}`, `{{ס}}`, `{{רווח}}`, `{{רווח קשיח}}`, `{{פפ}}`, `{{מ:פסוק}}`, `{{הערות שוליים}}`, `{{קישור לשיר}}`, `{{מיזמים}}`, `{{ויקיפדיה}}`, `{{#קטע:…}}`, `<ref>`, headings, list lines (`*…`), categories, `[[מחבר:…]]`, `__TOC__`, `<קטע …/>` markers, leading `:`/`::` indentation (17), `<big>`/`<center>` tags | — |
| `[[target\|text]]`, `[[text]]` | text | 1 |
| Raw `<small>…</small>` in the source | tags removed, text kept (צמאה נפשי's two bracketed stanzas keep their [ ]) | 2 |
| `<small>(פסוקים טו-טז)</small>` in בר יוחאי | removed (a verse citation inside the poem) | 1 |
| Space left before `:`/`.`/`,` where a dropped template stood | closed up (בר יוחאי: "פְּאֵרֶךָ:", "תְשׁוּרֶךָ:") | 2 |
| U+200E/U+200F direction marks (יה ריבון "אֻמַּיָּא") | removed | 3 |
| A `}}` cut off by a `<קטע>` boundary (אזמר בשבחין) | removed | 1 |
| `&nbsp;`, U+00A0, U+3000 | space; runs of spaces collapsed; lines trimmed | — |

Nothing else is changed: no letter or nikud mark is added, removed, reordered or normalised (no NFC; meteg, qamats
qatan ׇ, holam haser ֺ and the page's spacing of "/" separators are kept as they are).

## 6. Verification (scratch script, not committed)

For every item: at least 2 paragraphs; nikud present; no paragraph without nikud except `<small>` notes; no `{{`,
`}}`, `[[`, `]]`, `''`, `<ref`, `{|`, `|}`, `==`, `__`, HTML entities or control characters; no Latin letters in
the text; only `<br>`, `<b>`, `<small>` tags, balanced per paragraph; `url` and `revid` present. **All 51 pass.**
Two paragraphs are notes with no pointed text of their own: שלום עליכם's `<small>` note on the בשבתכם stanza and
המבדיל's `<small>בסידורי עדות המזרח נוסף:</small>`.

## 7. Suspicious text (left as Wikisource has it)

Found by a scan for two vowels on one letter, unpointed words in pointed text, and shin/sin without a dot, plus
reading. **None of these was corrected.**

| Item | Text | Doubt |
|---|---|---|
| יה ריבון | לְמַקְדְּשֵָךְ | tsere and qamats on the same shin |
| יה ריבון | בִּירוּשְלֶם | shin without dot |
| ברוך אל עליון | יִדְרֹֹשׁ | holam written twice |
| יום זה לישראל | גָׇדְלָךְ | qamats and qamats qatan on the gimel |
| אלי חיש גואלי | נָקָֹם | qamats and holam on the qof |
| אמר ה' ליעקב | <b>ל</b>א הִבִּיט | acrostic lamed has no holam (לֹא) |
| אמר ה' ליעקב | דָּרַך, וְיֵרְדְּ, עַבְדִי, יְשוּעוֹת | final kaf without shva; dagesh on final dalet; no dagesh in dalet of עַבְדִּי; shin without dot |
| שלום עליכם | לְשָלוֹם (stanzas 3–4) | shin without dot (stanzas 1–2 have it) |
| צמאה נפשי | אֲשֶר, נֶֽפֶש | shin without dot |
| ריבון כל העולמים | וַאֲשַׁלֵּשׁ עוד | "עוד" unpointed |
| על בית זה | נוֹתֵן לו שָׁלוֹם | "לו" unpointed |
| שבת היום לה' | לה׳ (first line) vs לַה׳ elsewhere | first occurrence unpointed |
| בני היכלא | עַדי | dalet unpointed; the page's footnote "נוסח אחר: לְמִצְחָא" (for לְמִנְחָה) was dropped with the footnotes |
| בר יוחאי | בַּר יוֹחַאי (stanza 2) vs בַּר יוֹחָאי elsewhere; שִׁי"ן, יוֹ"ד | inconsistent pointing; gershayim kept |
| רבון העולמים | (כשחל יו"ט באמצע השבוע יאמר: אֶת יְמֵי הַמַּעֲשֶׂה) | unpointed instruction inside the prayer, kept as printed |
| ביום שבת אשבח | the Judeo-Arabic stanzas (3, 5, 7, 10) | Yemenite Judeo-Arabic in Hebrew letters with U+05C4 upper dots (גׄ, דׄ, כׄ) and partial pointing (e.g. "פי"); kept exactly; not a Hebrew-only zemer |
| יום שבתון | stanza 3 "וּבָֽאוּ כֻלָּם" | the page's footnote says this stanza is not by Yehuda Halevi and gives the original; the footnote was dropped (it is in the raw file) |
| יום זה לישראל | stanzas in ( ) | the page's footnote says the bracketed stanzas are a later addition; brackets kept, footnote dropped |

## 8. Doubts and choices to review

1. **Order and meal**: one grouping only (Wikisource index, checked against Daat). Customs differ (e.g. Sephardim
   sing דרור יקרא on Friday night; Chabad sings few of these). The app may want per-rite subsets later.
2. **Variants shown inline**: `{{נוסחי תפילה קצרים}}` in המבדיל (6 places) and אל מסתתר (2) shows both the Ashkenaz
   and Edot HaMizrach words with small labels, as Wikisource does by default. A rite-aware renderer could pick one;
   the labels are plain Hebrew inside `<small>`, easy to recognise.
3. **Refrains** are separate paragraphs and are not marked as refrains in the data (Wikisource shows them small and
   bold). If the UI needs to style them, the script's `{{רפרן}}` handler is the place to add a marker.
4. **ביום שבת אשבח** (Judeo-Arabic stanzas) and **רבון העולמים** (a prose prayer) are in the pack because the Daat and
   Wikisource indexes list them; drop them if only Hebrew verse zemirot are wanted.
5. **על בית זה**: the author comes from the page's category "יוסף חיים מבגדד"; the acrostic reads "אליהו חזק".
6. **Paragraphing** of אשת חיל, בני היכלא, אמר ה' ליעקב (per row), אסדר, איש חסיד, לנר ולבשמים (per line) is the
   script's choice; the pages print these as one block.
