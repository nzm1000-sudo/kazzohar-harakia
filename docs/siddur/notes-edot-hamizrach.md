# Nusach Edot HaMizrach — composition notes

Composition: `src/data/nusach/compositions/edot.mjs` (nusach `edot-hamizrach`, pack index "Siddur Edot HaMizrach",
Sefaria, Mordechai Shaliach Tzibur edition, CC0). Every section is a slice of that one pack; nothing was borrowed
from another rite, and no word was typed. The Smart Siddur (`services/prayer/dayServicePlan.mjs`) and the composed
weekday Mincha (`weekdayMinchaComposer.mjs`) were used as a map of the edition and were not changed.

## QA status (`node scripts/siddur-qa.mjs edot-hamizrach`) — after the final review (2026-09-28)

All 18 schema services are composed; no source gap is declared. No problems (anchors, coverage, order, unknown
captions) in any service. The final review (log: `docs/siddur/review-edot.md`, tests: `tests/siddurFinal-edot.test.mjs`)
decided the pending conditions with the new day keys.

| Service | Level | What keeps it below VERIFIED |
|---|---|---|
| weekday-mincha | VERIFIED COMPLETE | — |
| weekday-shacharit | CONDITIONS PENDING | Chol HaMoed reading / lulav / Hoshanot not in the edition; Purim Megillah inside Uva LeSion ¶1; Chanukah "השיר שהיו הלוים" inside a paragraph; house of mourning (no key); Ps 30 heading verse missing in the text |
| weekday-maariv | VERIFIED COMPLETE | — (Omer: tonight's line only; אתה חוננתנו on Motzaei Yom Tov) |
| bedtime-shema | CONDITIONS PENDING | Vidui: night of the week, Motzaei Shabbat before midnight — the reader has no night context |
| kabbalat-shabbat | CONDITIONS PENDING | במה מדליקין in a house of mourning (no key; the rubric says it) |
| shabbat-maariv | VERIFIED COMPLETE | — (Kaddish Yehe Shelama now complete) |
| shabbat-kiddush | CONDITIONS PENDING | text gap: "כי בנו בחרת ואותנו קדשת מכל העמים" missing in the Kiddush (¶12) |
| shabbat-shacharit | CONDITIONS PENDING | fast announcement (no `fastAnnouncement` key); Ps 30 heading verse missing in the text |
| shabbat-musaf | VERIFIED COMPLETE | — |
| shabbat-kiddush-day | VERIFIED COMPLETE | — |
| shabbat-mincha | VERIFIED COMPLETE | — (צדקתך / יהי שם by `tachanunIfWeekday`) |
| havdalah | VERIFIED COMPLETE | — |
| birkat-hamazon | VERIFIED COMPLETE | — |
| hallel | VERIFIED COMPLETE | — |
| rosh-chodesh-musaf | VERIFIED COMPLETE | — |
| omer | VERIFIED COMPLETE | — (tonight's line only) |
| festival-amidah | VERIFIED COMPLETE | — (Kedusha / Modim deRabbanan / Birkat Kohanim by the prayer of the hour) |
| festival-musaf | CONDITIONS PENDING | the day's offering verses are not printed in the edition (text gap, see below) |

## How it was reviewed

For every service: every paragraph of every leaf used was listed with its opening and closing words; every section's
range was checked against the title; every small-print run *inside* a paragraph was listed (to catch instructions or
alternatives glued into prayer text); and the full text of every section was then read (dumps in the session
scratchpad). Two exceptions were checked paragraph-by-paragraph by structure only, not word by word: the four fast-day
Selichot leaves (used whole, each ends with the edition's own "ואומר הש"ץ חצי קדיש…" instruction) and the 49-day Omer
table (147 formulaic paragraphs). `reviewed: true` is set on all 18 services on that basis.

## Structural decisions the edition forced

- **Modim deRabbanan** is its own section (role `repetition`) in every Amidah: Mincha ¶44, Shacharit ¶42–44, Shabbat
  Shacharit ¶24, Shabbat Mincha ¶21, Shabbat Musaf ¶27, RC Musaf ¶16, festival Amidah ¶34, festival Musaf ¶35.
- **Tisha B'Av נחם** (Mincha Amida ¶26–27) is a section `when: tishaBav`; the plain ending "ברוך אתה ה' בונה ירושלים" (¶28)
  is a continuation `when: !tishaBav`.
- **The Chida's "תפילת רב"** ("יש אומרים תפילת רב מגמרה ברכות ט"ז ע"ב שכתב החיד"א ז"ל בסידורו …") is printed in small type
  *inside the same paragraph* as the closing "יהיו לרצון": Weekday Mincha, Amida ¶67; Weekday Shacharit, Amida ¶69;
  Weekday Arvit, Amidah ¶48. Granularity is the paragraph, so it cannot be its own `optional` section; it stays in
  אלהי נצור and the reader shows it as small print. Needs a sub-paragraph cut (or a split in the pack) to be folded.
- **קבלת תענית יחיד** (Mincha Amida ¶68) is its own section, role `optional`; the "ביום תענית יאמר" prayer (¶69) is its own
  section `when: fast` (it is also for a private fast — no key).
- **עננו נוסח סנסן ליאיר** ("נוסח עננו בג' צומות") is its own section, role `optional`, `when: fast` (Arvit: `tishaBav`).
  Which three fasts are meant is not stated.
- **Hallel** (edition leaf "Rosh Hodesh, Hallel", the only Hallel it prints): the blessing, לא לנו, אהבתי and יהללוך are
  `fullHallel`; the rest always. After Hallel, "ובחנוכה אומר רק חצי קדיש" → the Titkabal lines are `!chanukah`. On
  Shabbat, Hallel is followed by the Shabbat Amidah's own Kaddish Titkabal (the Hallel leaf's Kaddish is omitted there).
- **Weekday Shacharit on Rosh Chodesh** follows the edition's Rosh Chodesh leaves: Hallel, the RC Torah service and
  reading (Hallel leaf ¶34–41), Ashrei (¶42–43), RC Uva LeSion, RC Song of the Day, return of the Torah, half Kaddish,
  RC Musaf, Barchi Nafshi, Kaveh, Ketoret, Alenu. Every weekday-only closing section is `!roshChodesh`.
- **Monday/Thursday**: "בימים שני וחמישי אין אומרים את הקדיש הזה וממשיכים באל מלך" — the half Kaddish (Vidui ¶11–12) is
  `!hallel&!mondayThursday | !hallel&!tachanun | !hallel&fast`; the long Tachanun (¶13–33, with its own Kaddish) is
  `mondayThursday&tachanun&!fast`. On a public fast the fast's own Selichot (from "Fast Days and Mourning") follow
  Nefilat Apayim, as the edition says (Vidui ¶10) — they already contain אל מלך / אנשי אמונה … הפותח יד.
- **Fast-day Torah reading** (ויחל, "Torah Reading for Fast Days") is in Shacharit (`fast&!tishaBav`) and before the
  Mincha Amidah (`fast`), with the weekday Torah service; at Mincha the return of the Torah is the יהללו of the
  Shacharit Uva LeSion leaf (the rest of that leaf is omitted with a reason).
- **Song of the Day**: one section per weekday (`day0`…`day5`, plus `!roshChodesh`), and each special day the edition
  names (`tzomGedaliah|asaraBetevet`, `chanukah`, `taanitEsther|purim`, `shivaAsarBetammuz`). "למחרת יום הכיפורים" and
  "בבית האבל" use keys that do not exist yet (`afterYomKippur`, `houseOfMourning`) — hidden in prayer mode until the keys
  exist; see "missing keys".
- **Festival Musaf ending** follows the edition's own rubrics (¶57–58): Yom Tov — יהי שם, Kaddish Titkabal, then "כל
  ישראל כמו בשבת" (Shabbat Musaf ¶60–63, Ketoret, Alenu); Chol HaMoed — יהי שם, Kaddish Titkabal, the festival's psalm,
  Kaddish Yehe Shelama, Kaveh to the end. יהי שם and the Kaddish are taken from the RC Musaf leaf (identical text),
  the other paragraphs of borrowed leaves are omitted with reasons.
- **Festival Musaf Kedusha**: "בחזרת הש"ץ במוסף של יו"ט או שבת" → `!cholHamoed|shabbat`; "…של חול המועד" →
  `cholHamoed&!shabbat`.
- **Shabbat Shacharit** starts with the weekday morning order up to ה׳ מלך ("מתפללים שחרית של חול עד סוף ה' מלך
  וממשיכים"), without tefillin and without the weekday Menorah psalm (omitted, per "בשבת ממשיכים מזמור השמים מספרים").
  The half Kaddish before Maftir is the weekday Torah leaf's (¶19–20); the Shabbat Torah leaf prints none.
- **Shabbat Mincha** Avinu Malkeinu (Shabbat Shuva) is taken from the Shabbat Shacharit Amidah, as the edition's pointer
  "בשבת שובה אומרים כאן אבינו מלכינו" says.
- **Kabbalat Shabbat** starts with Shabbat candle lighting (no concept for it — mapped to `kabbalat-shabbat`); the
  Yom Tov candle lighting in the same leaf is omitted with a reason. במה מדליקין is `!cholHamoed&!chanukah&!yomTov`;
  כל ישראל and אמר רבי אלעזר are always said ("אלא יתכיל מאמר רבי אלעזר").

## Doubts (need a rav's / the user's decision)

1. **Weekday Mincha on a public fast — two half-Kaddishes**: the edition prints one after Ashrei (Offerings ¶14–15) and
   one after the reading (Torah Reading ¶19–20). Both are kept (the Smart Siddur does the same). Some Sephardi
   congregations say only the second.
2. **יהי שם at Mincha on a day without Tachanun** (Mincha Amida ¶105–106): printed by the edition, kept `!tachanun`. Its
   closing words "ואחר כך אומר הש''צ חצי קדיש" look copied from Shacharit — at Mincha Kaddish Titkabal follows.
   (`weekdayMinchaRules` marks this rule as unresolved.)
3. **Avinu Malkeinu at weekday Mincha/Shacharit**: `aseret`, as the edition's caption says. Whether it is said at
   Mincha of Erev Yom Kippur and of Friday in the Ten Days was not decided.
4. **Omer inside weekday Arvit** is placed after Kaddish Titkabal, before Ps 121 (the edition prints the Omer as a
   separate chapter, not inside Arvit).
5. **יהי שם after the weekday Arvit Amidah** (¶51) is kept every night, as printed before the Motzaei-Shabbat caption.
6. **Birkat Kohanim** in weekday Shacharit has no day condition (Sephardim say it daily). On Tisha B'Av Shacharit
   practice varies; not gated.
7. **Tisha B'Av Shacharit**: the reading (כי תוליד) and Kinot are not in the edition; tefillin are `!tishaBav`.
8. **Full vs. half Hallel** follows `fullHallel` only; the Smart Siddur also treats Sukkot as full (`c.sukkot`).
9. **Birkat HaGomel** (Shabbat Torah reading) is role `optional` — it is situational, not "some say".
10. **Shabbat Chol HaMoed** festival-Musaf ending: the edition does not say whether Shabbat CHM follows ¶57 (Yom Tov)
    or ¶58 (CHM); the composition follows ¶58 whenever `cholHamoed`.
11. **Concept mappings chosen for lack of a better concept**: the verses and לשם יחוד before weekday Arvit →
    `vehu-rachum`; before Shabbat Arvit → `barchu`; Ps 67 / Ps 93 / Ps 102 after Mincha → `closing-passages`; יהי שם →
    `closing-passages`; fast Selichot → `tachanun`; candle lighting → `kabbalat-shabbat`; Mincha Ps 84 / Tamid →
    `korbanot`.

## Suspicious text (not changed — exact address and words)

- **Weekday Shacharit, Hodu ¶5**: Ps 30 opens "ארוממך ה' כי דליתני" — the heading verse "מזמור שיר חנכת הבית לדוד" is
  missing (it is printed in Song of the Day ¶19).
- **Shabbat Arvit, Magen Avot ¶44–46**: "ואומרים כאן קדיש "יהא שלמא"" is followed by "תתקבל צלותנא…" (¶45) — the
  opening "יתגדל ויתקדש" paragraph is missing and a Titkabal line appears in a Yehe Shelama Kaddish. *Final review:*
  omitted with its reason; the same edition's complete Kaddish Yehe Shelama (Rosh Hodesh, Barchi Nafshi) is said.
- **Shabbat Evening, Kiddush ¶12**: "…זכר ליציאת מצרים, ושבת קדשך" — "כי בנו בחרת ואותנו קדשת מכל העמים" is missing.
- **Prayers for Three Festivals, Mussaf ¶26**: "…כמו שכתבת עלינו בתורתך, על ידי משה עבדך." — the day's offering
  verses (Numbers 28–29) are not printed; ¶27 "אלהינו ואלהי אבותינו מלך רחמן" follows directly.
- **Shabbat Shacharit, Pesukei D'Zimra ¶16**: "יהוה ימלך לעלם ועדיהוה מלכותה" — two words glued.
- **Rosh Hodesh, Song of the Day ¶13**: "חיים ברצונובערב ילין" — two words glued.
- **Shabbat Arvit, Barchu ¶1**: "(שנמצע בערבית של חול)" — "שנמצא". **Rosh Hodesh, Mussaf ¶1**: "מובה במוסף של שבת" —
  "מובא".
- **Kabbalat Shabbat ¶7**: Ps 29 and the "יש אומרים" אנא בכח are one paragraph (cannot be folded separately).
- **Counting of the Omer ¶1**: the long לשם יחוד and the short one ("יש אומרים נוסך קצרה") are one paragraph.
- Empty paragraphs: Shabbat Shacharit, Mi Sheberach ¶1; Fast Days, Seventeenth of Tammuz ¶1; Bedtime Shema ¶3.
- The QA text audit also lists glued line breaks at the Birkat Kohanim rubric (e.g. Weekday Mincha, Amida ¶57) — a
  text-layer matter.

## Kabbalistic name combinations and kavanot printed in the text (not changed)

- "ברוך אתה **יוהוווהו**" in the Amidah endings: Weekday Shacharit, Amida ¶23 (מלך אוהב צדקה ומשפט), ¶25 (משען ומבטח
  לצדיקים), ¶65 (המברך את עמו ישראל בשלום); Weekday Mincha, Amida ¶22, ¶24, ¶63; Weekday Arvit, Amidah ¶20, ¶22, ¶44;
  Shabbat Arvit, Magen Avot ¶26; Shabbat Shacharit, Amidah ¶43; Shabbat Mussaf, Amida ¶46; Shabbat Mincha, Amida ¶27;
  Prayers for Three Festivals, Amidah ¶49 and Mussaf ¶50; Rosh Hodesh, Mussaf ¶12 (מקדש ישראל וראשי חדשים) and ¶34.
- Kabbalat Shabbat ¶7 (Ps 29): "קול **יוהוווהו** יחיל מדבר".
- Post Meal Blessing ¶15: "פותח את ידך (ר"ת פא"י שהוא מספר **יאהדונהי** ומספר סא"ל וס"ת חת"ך) ומשביע (כמספר חת"ך)".
- Counting of the Omer ¶1: "(יהוה)", "(**יאההויה"ה**)", "(זו"ן)", "(**יאהדונה"י**)".
- "(יהוה)" after "ליחדא שם יו"ד ק"י בוא"ו ק"י ביחודא שלים": Order of Talit ¶1, Order of Tefillin ¶1, Shabbat Candle
  Lighting ¶1 (twice).
- Avinu Malkeinu "קרע רוע גזר דיננו: (יכוין בשם קר"ע שט"ן)": Weekday Mincha, Amida ¶86; Weekday Shacharit, Amida ¶87;
  Shabbat Shacharit, Amidah ¶62. אנא בכח with the initials "(אב"ג ית"ץ)…(שק"ו צי"ת)": Incense Offering ¶9–15,
  Counting of the Omer ¶153–159, Bedtime Shema ¶21–27.
- Pesukei D'Zimra ¶14 (weekday and Shabbat): "אתה הוא יהוה האלהים ר"ת אהיה"; Yehi Kevod ¶3: "כנגד שמונה עשרה אותיות של
  ששה צרופי שד"י".
- Petichat Eliyahu ¶5 and ¶7: "[אות] יו"ד [ואות] ה"א [ואות] וא"ו [ואות] ה"א".
- Ten Remembrances ¶7 "שב"ת … שמ"ך", ¶13 "על דב"ר כבו"ד שמ"ך"; Weekday Mincha, Amida ¶32 (Sansan LeYair) "צע"ר השמים".

## Condition keys the composition needs but the composer lacks

Now used (final review): `omerDay` (Omer table, `perDay`), `motzaeiYomTov` (אתה חוננתנו; במה מדליקין), `erevYomTov`,
`erevChanukah`, `chanukahDay` (the reading of each day), `afterYomKippur` (11–14 Tishrei, Ps 85), `shabbatMevarchim`,
`tachanunIfWeekday`, `shacharit` / `maariv` (festival Amidah). Still missing: `houseOfMourning`, `fastAnnouncement`
(Shabbat before 17 Tammuz / 10 Tevet), `individualFast`, a night context and "before midnight" for the bedtime Shema,
`minyan` (setting). An unknown key makes the whole `when` undecided (shown, labelled) — so it cannot be combined with
a decided term (`houseOfMourning&!roshChodesh` would still show on Rosh Chodesh); the mourners' psalm therefore uses
`!roshChodesh` under its own title. The engine requests are in `docs/siddur/review-edot.md`.

## Concepts missing from the schema

candle lighting; יהי שם; the verses/לשם יחוד before Arvit; Ps 67 / Ps 93 / Ps 102 after Mincha; fast-day Selichot;
קבלת תענית יחיד; ברכת הבנים; the Shabbat meals (netilat yadayim, hamotzi, Zohar, Mishnayot); Megillah; lulav/Hoshanot;
the Shacharit additions (13 principles, 10 remembrances, leaving the synagogue); festival-Musaf offering verses.

## Leaves of the edition not used by any service

Midnight Rite (Tikkun Chatzot); Blessing of the Moon (no schema service); Shabbat Evening — Blessing of Children, First
Meal, Zohar, Songs for Shabbat; Third Meal; Havdalah — Motzei Shabbat Songs, Fourth Meal; Al Hamihya; Blessings on
Enjoyments; Shabbat Shacharit — Zeved HaBat, Shabbat Chatan; Hanukkah (Menorah Lighting, Shacharit table of readings);
Purim (Shabbat Zachor, Megillah Reading, Purim Day); Nissan; Assorted Blessings and Prayers; Mishna Study for Shabbat
(incl. Pirkei Avot); Fast Days and Mourning — Mourning; Song for Shavuot / Shemini Atzeret.
