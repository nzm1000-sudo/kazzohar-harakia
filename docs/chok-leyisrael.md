# חק לישראל בסידור

The daily learning of חק לישראל (תורה, נביאים, כתובים, משנה, גמרא, זוהר, הלכה פסוקה, מוסר) as a card of the Siddur home,
after תפילות החול. One tap opens **today's** learning; previous / next day, the day strip and the part tabs move inside it.

## Source and licence
- **Edition:** מאגר תורת אמת, as exported to Otzaria — `github.com/Sivan22/otzaria-library`, commit
  `d6e4e06bcc803b5e8e4f137d278f563104f68115`, folder `ToratEmetToOtzaria/מתורת אמת שלא קיים באוצריא/תורה/חק לישראל`, one file per
  chumash. Each file's SHA-256 is pinned in `sources/torat-emet-chok-leyisrael/provenance.json`; the cached copies
  (`raw/*.txt.gz`) are checked against it on every build (`--fetch` downloads them again from the pinned commit).
- **Credit:** "חק לישראל — מאגר תורת אמת". **Licence:** CC BY-NC-SA 2.5, Torat Emet's terms
  (http://www.toratemetfreeware.com/online/a_wellcome.html, quoted verbatim in the provenance file with the page's SHA-256).
  Owner, 2026-10-01: the app is free and without ads. The credit and the licence link are under every day, on the
  introductions page and on the list of parashot; About › "חק לישראל"; `CHOK_LEYISRAEL_EDITION` in `src/data/library/registry.mjs`.

## Data
- `scripts/chok-leyisrael/build.mjs` (`--check` rebuilds in memory and fails on any difference; `--fetch`). Parser:
  `scripts/chok-leyisrael/parse.mjs`. Output: `public/library/packs/torat-emet-chok-leyisrael-cc-by-nc-sa/` — one gzipped JSON
  per parasha (54) + `intro.json.gz` + `manifest.json`; runtime index `src/data/chokLeYisrael/manifest.mjs` (checksums, the
  parts of each day). 4.3 MB gzipped (16.4 MB of JSON); the largest pack 95 KB. Deterministic: a pack whose JSON is
  unchanged keeps its bytes on disk (no churn between Node/zlib versions).
- 54 parashot × 7 days = 378 days. Sunday–Thursday: תורה (שנים מקרא ואחד תרגום with Rashi), נביאים and כתובים (with Targum
  and Rashi), משנה (with the Bartenura), גמרא (with Rashi), זוהר (the Aramaic and its Hebrew translation), הלכה פסוקה,
  מוסר. ליל שישי: the 26 verses. יום שישי: the rest of the parasha, its haftarah (two where the edition prints the
  Sephardi and the Ashkenazi one), then משנה … מוסר from סדר טהרות.
- **Only markup was changed.** The words are the edition's. One mechanical repair, each case logged in
  `sources/torat-emet-chok-leyisrael/build-log.json`: a Targum word glued to the next by a lost line break is split again —
  (a) **reference**: the glued letters are exactly two consecutive words of the same verse of Onkelos in the app's Shnayim
  Mikra pack (Torat Emet via Sefaria) — 13,040 cases in the Torah; after it only 91 of 82,963 Onkelos words are not words of
  the reference; (b) **final letter**: a final form (ך ם ן ף ץ) followed by another letter inside one word — 1,478 cases
  (mostly the Targum of Nevi'im and Ketuvim).
- **Known limitation:** the Targum of Nevi'im/Ketuvim has more glued words that neither rule can prove (no reference
  Targum Yonatan in the app), e.g. "וְאַתְקִיפִיתבִּידָךְ". They stay as printed. A reference Targum would close this.
- Headings shown as labels write the edition's `''` as ״ (presentation only; the text keeps its own spelling).

## Structure facts of the edition (kept as they are)
- נצבים, וילך, האזינו, וזאת הברכה: ליל שישי reaches the end of the parasha and carries the haftarah; יום שישי has no Torah
  of its own (it opens on the Mishnah).
- תצוה: the edition prints no haftarah.
- זוהר of שמות, יום חמישי has no Hebrew translation in the edition.
- The introduction's headings "נוסחי דווקני" and "יסוד מלכות כתובים" are empty in the export (the kavanot page is not
  there); they are not shown. The introductions are identical in the five volumes (Numbers differs by spacing only).

## Which day is today (`src/services/chokLeYisrael.mjs`)
- The week is named by its Shabbat; the day changes at sunset (the app's Jewish date). The reading of that Shabbat comes
  from @hebcal/core's Sedra, for Israel or the Diaspora as set — the same source as `weeklyParasha.mjs`.
- **Thursday night** (from sunset until Friday's dawn, עלות השחר) is **ליל שישי**; Friday from dawn is **יום שישי**; on
  Shabbat the reader shows the week's Friday ("שבת קודש").
- **Two parashot read together** (ויקהל־פקודי, תזריע־מצורע, אחרי מות־קדושים, בהר־בחוקותי, חוקת־בלק, מטות־מסעי,
  נצבים־וילך — whenever that year's calendar joins them, in Israel or abroad): **both**, by the owner's decision. Every day,
  each part shows the day's portion of the first parasha and then of the second, under "פרשת …" headings; a part one of
  them lacks is said so. *Note:* the edition itself (הקדמת החיד״א, אות ז׳) says to learn only the first parasha in such a
  week; the app follows the owner.
- **A festival's Shabbat** (Rosh Hashana, Yom Kippur, Sukkot, Shemini Atzeret, Pesach, Shavuot on Shabbat): the parasha
  read next — "the parasha read at that Shabbat's Mincha" (הקדמת החיד״א, אות ח׳), for two or three weeks if need be. Until
  Simchat Torah that is **וזאת הברכה**, the only division the edition has for an occasion; otherwise the next regular
  reading (two, if it is a joined week). A note above the day says so.
- Israel and the Diaspora differ wherever their readings differ (e.g. after Shavuot on Shabbat, 5786/5787).

## The reader (`src/pages/ChokLeYisraelPage.jsx`, `src/styles/chok.css`)
Centred title with the TitleOrnament, the shared text size, the heart (it keeps "חק לישראל — הלימוד של היום", which always
opens today), ReaderDock and ReaderNavigation for the previous / next day, a strip of the seven days, the parts as tabs
(Rule A: copper text over a thin underline; the chosen day a thin copper frame), the edition's prayer before that kind of
learning (opens the introduction at it), "להמשך הלימוד" to the next part, and "סיימתי את הלימוד" after the last part.
Reading time is recorded in המצוות שלי like every study text (60 s+). The text is in `--font-reading`; labels in Heebo
500/400. Offline: the installed app carries the packs in its bundle; on the web the week's packs (and the next week's)
are fetched in idle time once the reader opens, so the service worker keeps them.

## In לימוד יומי (`src/services/dailyLearningSchedule.mjs`, `src/components/DailyLearning.jsx`)

- A daily cycle like the others (`DAILY_TRACKS`, last): `chokPortion` takes today's day from `chokToday` — the same rules
  as above, with the app's zmanim (`times`, for Friday's dawn) and Israel/Diaspora from the settings — and names it
  ("פרשת וזאת הברכה · ליל שישי"); the portion opens the reader on that day (`chok-leyisrael/d/<ids>/<day>`).
- Shown on the לימוד יומי page (`#learning`), in the Talmud hub's card, on its own page (`#learning/chok-leyisrael`),
  and among the learning reminder's cycles (`services/reminders/mazkir.mjs`; the default stays דף יומי).
- Today's "מה נשאר לי היום": only cycles the user follows (opt-in on the cycle's page, `kz-daily-follow-v1`; none by
  default). "סימון כהושלם" there writes the same journal entry as the page's "סיימתי" (`recordPortionDone`, workId
  `daily-chok-leyisrael`, source `daily-learning`) — the journal's hourly rule for study, like every daily cycle (a
  second tap within the hour records nothing); once recorded that day the portion is done on Today. The reader's own
  "סיימתי" on that day of the edition also marks it done.

## Validation against Sefaria's sheets
`scripts/chok-leyisrael/validate.mjs` compares each day with the refs of Sefaria's 378 "חק לישראל" sheets
(`sources/…/sefaria-sheet-refs.json`: refs and section titles only). A checking aid: nothing in the text is changed from
it. Most Gemara differences are the edition's own daf headings (some cannot exist, e.g. "נדה דף פ״ט", "נדה דף קי״ט");
the text under them is the edition's.

<!-- validation:start (generated by scripts/chok-leyisrael/validate.mjs) -->

נבדקו 378 ימים; לכל אחד נמצא דף בספריא: 378.

| חלק | תוצאה |
|---|---|
| תורה | 371 מתוך 374 תואמים · 3 שונים; בליל שישי 54 ימים: 26 הפסוקים שבמהדורה נמצאים בתוך הטווח שהדף מציין (הדף מונה את כל הטווח) |
| נביאים | 270 מתוך 270 תואמים |
| כתובים | 270 מתוך 270 תואמים |
| משנה (מסכת ופרק) | 324 מתוך 324 תואמים |
| גמרא (מסכת, דף ועמוד שבו מתחיל הקטע) | 287 מתוך 324 תואמים · 37 שונים |

ההבדלים, יום אחר יום (הטקסט שבאפליקציה הוא של המהדורה, כפי שהוא; הדפים בספריא הם כלי בדיקה בלבד):

| יום | חלק | המהדורה | הדף בספריא | פירוט |
|---|---|---|---|---|
| נח · יום שני | גמרא | גמרא שבת דף כ''ח ע''ב (Shabbat 28b) | Shabbat 25b:3-5 |  |
| נח · יום שלישי | גמרא | גמרא יבמות דף כ''א ע''א (Yevamot 21a) | Yevamot 20a:12-21a:13 |  |
| וירא · יום ראשון | גמרא | גמרא ברכות דף כ''ה ע''ב (Berakhot 25b) | Berakhot 28b:4-7 |  |
| תולדות · יום שני | גמרא | גמרא שבת דף ל''ב ע''א (Shabbat 32a) | Shabbat 62b:6-17 |  |
| תולדות · יום רביעי | גמרא | גמרא בבא קמא דף ס''ו ע''א (Bava Kamma 66a) | Bava Kamma 60a:16-60b:10 |  |
| וישלח · יום ראשון | גמרא | גמרא ברכות דף נ''ג ע''א (Berakhot 53a) | Berakhot 53b:13-19 |  |
| וישב · יום שישי | גמרא | גמרא נדה דף י''ג ע''א (Niddah 13a) | Niddah 13b:24-14a:2 |  |
| מקץ · יום חמישי | גמרא | גמרא זבחים דף פ''ח ע''א (Zevachim 88a) | Zevachim 88b:5-14 |  |
| ויגש · יום ראשון | גמרא | גמרא ברכות דף ד' ע''א (Berakhot 4a) | Berakhot 5b:21-6a:1 |  |
| שמות · יום חמישי | גמרא | גמרא זבחים דף קט''ו ע''ב (Zevachim 115b) | Zevachim 118b:6-12 |  |
| וארא · יום שישי | גמרא | גמרא נדה דף י''ז ע''ב (Niddah 17b) | Niddah 16b:5-8 |  |
| בא · יום רביעי | גמרא | גמרא בבא מציעא דף נ''ט ע''ב (Bava Metzia 59b) | Bava Metzia 59a:3-11 |  |
| בא · יום שישי | גמרא | גמרא נדה דף י''ז ע''ב (Niddah 17b) | Niddah 16b:17-17a:3 |  |
| בשלח · יום ראשון | גמרא | גמרא ברכות דף ח' ע''א (Berakhot 8a) | Berakhot 7b:28-8a:7 |  |
| יתרו · יום ראשון | גמרא | גמרא ברכות דף מ' ע''א (Berakhot 40a) | Berakhot 8a:16-28 |  |
| יתרו · יום שישי | גמרא | גמרא נדה דף י''ז ע''ב (Niddah 17b) | Niddah 17a:6-8 |  |
| משפטים · יום ראשון | גמרא | גמרא ברכות דף ח ע''ב (Berakhot 8b) | Berakhot 8a:30-8b:10 |  |
| תרומה · יום רביעי | גמרא | גמרא בבא מציעא דף פה ע''א (Bava Metzia 85a) | Bava Metzia 107a:11-107b:3 |  |
| תצוה · יום שישי | תורה | Exodus 29:8 … 30:10 (49) | Exodus 29:8-18; Exodus 29:19-37; Exodus 29:38-46; Exodus 30:1-10; Ezekiel 43:10-27 | בדף ולא במהדורה: Ezekiel 43:10, Ezekiel 43:11, Ezekiel 43:12, Ezekiel 43:13, Ezekiel 43:14, Ezekiel 43:15 ועוד 12 |
| כי תשא · יום שישי | גמרא | גמרא נדה דף פ''ט ע''א (Niddah 89a) | Niddah 19b:14-16 |  |
| ויקהל · יום שני | גמרא | גמרא שבת דף קמ''ה ע''א (Shabbat 145a) | Shabbat 145b:10-146a:1 |  |
| פקודי · יום ראשון | גמרא | גמרא ברכות דף כ' ע''ב (Berakhot 20b) | Berakhot 20a:4-9 |  |
| פקודי · יום שישי | גמרא | גמרא נדה דף קי''ט ע''ב (Niddah 119b) | Niddah 19b:21-20a:3 |  |
| ויקרא · יום חמישי | גמרא | גמרא מנחות דף צ''ט ע''ב (Menachot 99b) | Menachot 99a:5-12 |  |
| צו · יום רביעי | גמרא | גמרא בבא בתרא דף ע''ה ע''ב (Bava Batra 75b) | Bava Batra 78b:10-79a:3 |  |
| אחרי מות · יום שישי | גמרא | גמרא נדה דף ב' ע''א (Niddah 2a) | Niddah 20a:26-20b:4 |  |
| אמור · יום רביעי | גמרא | גמרא סנהדרין דף ז' ע''א (Sanhedrin 7a) | Sanhedrin 7b:9-8a:6 |  |
| בהר · יום ראשון | גמרא | גמרא ברכות דף ל''ב ע''א (Berakhot 32a) | Berakhot 32b:3-10 |  |
| בחוקותי · יום שלישי | גמרא | גמרא קדושין דף פ''א ע''א וע''ב (Kiddushin 81a) | Kiddushin 82b:3-5 |  |
| נשא · יום רביעי | גמרא | גמרא סנהדרין דף מ''ב ע''א (Sanhedrin 42a) | Sanhedrin 41b:12-42a:5 |  |
| שלח · יום שלישי | גמרא | גמרא גיטין דף ל''ח ע''א (Gittin 38a) | Gittin 35a:2-14 |  |
| קרח · יום ראשון | גמרא | גמרא ברכות דף ל''ד ע''א (Berakhot 34a) | Berakhot 34b:18-26 |  |
| קרח · יום שישי | גמרא | גמרא נדה דף כ''ב ע''א (Niddah 22a) | Niddah 22b:8-11 |  |
| חוקת · יום חמישי | גמרא | גמרא חולין דף קמ''ב ע''ב (Chullin 142b) | Chullin 142a:3-9 |  |
| חוקת · יום שישי | גמרא | גמרא נדה דף כ''ג ע''א (Niddah 23a) | Niddah 23b:4-6 |  |
| פינחס · יום שני | תורה | Numbers 25:16 … 26:1 (4) | Numbers 25:16-26:1 | בדף ולא במהדורה: Numbers 25:19 |
| מסעי · יום ראשון | גמרא | גמרא ברכות דף מ''ו ע''ב (Berakhot 46b) | Berakhot 47a:4-11 |  |
| מסעי · יום שלישי | גמרא | גמרא סוטה דף ב' ע''א (Sotah 2a) | Sotah 3b:11-4b:7 |  |
| ואתחנן · יום רביעי | גמרא | גמרא שבועות דף יח ע''א (Shevuot 18a) | Shevuot 18b:4-11 |  |
| ואתחנן · יום שישי | תורה | Deuteronomy 4:46 … 7:11 (70) | Deuteronomy 4:46-49; Deuteronomy 5:1-18; Deuteronomy 5:19-6:3; Deuteronomy 6:4-25; Deuteronomy 7:1-11 | בדף ולא במהדורה: Deuteronomy 5:31, Deuteronomy 5:32, Deuteronomy 5:33 |

<!-- validation:end -->
