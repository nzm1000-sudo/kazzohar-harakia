# Nusach Ashkenaz — composition notes

Composition: `src/data/nusach/compositions/ashkenaz.mjs` · edition: Sefaria "Siddur Ashkenaz" (Metsudah; the pack
`Siddur Ashkenaz`). Every section is a slice of that edition; nothing is typed and nothing is borrowed from another
rite. Where the Shabbat part of the edition lacks something the weekday part prints (Birchot HaTorah), the edition's
own weekday leaf is used — same pack, same rite.

**Second edition (2026-09-29):** what the Metsudah edition does not print at all is taken from another Nusach Ashkenaz
edition, Birnbaum's *HaSiddur HaShalem* (1949), in the Hebrew Wikisource page transcription (CC BY-SA 4.0, owner
approved) — its own pack `HaSiddur HaShalem Birnbaum` (`siddurAshkenazBirnbaum.mjs`), never merged into the Metsudah
pack: במה מדליקין + אמר רבי אלעזר, על הכל + אב הרחמים הוא ירחם, שיר המעלות (Ps. 120–134) after ברכי נפשי, פרקי אבות
(six chapters), ויתן לך. Import notes, licence handling, provenance: `docs/siddur/birnbaum-ashkenaz-import.md`;
tests: `tests/birnbaumAshkenaz.test.mjs`.

QA: `node scripts/siddur-qa.mjs ashkenaz` — every service resolves with no problem (no missing anchor, no uncovered
paragraph, no paragraph used twice, spine in order). Levels are listed at the end.

How it was checked: every leaf used was dumped (`dump-leaf.mjs`, every paragraph's opening and closing words; the
weekday Mincha template and the short leaves in full), every section's first and last paragraph was checked against
its title, and each service was composed in prayer mode for sample days (an ordinary Sunday/Monday, Rosh Chodesh,
Chanukah, Rosh Chodesh Tevet, 10 Tevet, Chol HaMoed Sukkot, Shabbat, Motzaei Shabbat) and compared with the full
edition, section by section, to find text the day engine hides although its section's condition holds.

## Levels (QA) — after the final review (2026-09-28; log: `docs/siddur/review-ashkenaz.md`)

| Service | Level | What remains |
|---|---|---|
| weekday-shacharit | TEXT COMPLETE / CONDITIONS PENDING | engine items of the embedded Musafim (leap-year line; ¶35 of the festival Musaf) |
| weekday-mincha | VERIFIED COMPLETE | (reopened and fixed: Erev Pesach, Ten Days, eves) |
| weekday-maariv | TEXT COMPLETE / CONDITIONS PENDING | ויהי נועם when Yom Tov falls in the coming week (no key); ויתן לך now from Birnbaum |
| bedtime-shema | VERIFIED COMPLETE | |
| kabbalat-shabbat | VERIFIED COMPLETE | (במה מדליקין now from Birnbaum; the Metsudah Kaddish DeRabbanan follows it) |
| shabbat-maariv | VERIFIED COMPLETE | (reopened and fixed: the Omer count) |
| shabbat-kiddush | VERIFIED COMPLETE | |
| shabbat-shacharit | TEXT COMPLETE / CONDITIONS PENDING | אב הרחמים on the Four Parshiyot / Mevarchim Av (no key); על הכל now from Birnbaum |
| shabbat-musaf | TEXT COMPLETE / CONDITIONS PENDING | inline בעש"ת words, Kaddish Ten-Days words, leap-year line (engine) |
| shabbat-kiddush-day | VERIFIED COMPLETE | |
| shabbat-mincha | TEXT COMPLETE / CONDITIONS PENDING | inline בש"ת, Kaddish Ten-Days words (engine), צדקתך on the Four Parshiyot; פרקי אבות and שיר המעלות now from Birnbaum |
| havdalah | VERIFIED COMPLETE | |
| birkat-hamazon | VERIFIED COMPLETE | (reopened and fixed: Ten Days) |
| hallel | VERIFIED COMPLETE | |
| rosh-chodesh-musaf | TEXT COMPLETE / CONDITIONS PENDING | leap-year line "ולכפרת פשע" (engine) |
| omer | VERIFIED COMPLETE | |
| festival-amidah | TEXT COMPLETE / CONDITIONS PENDING | small-print Shabbat words inside paragraphs (engine) |
| festival-musaf | TEXT COMPLETE / CONDITIONS PENDING | ¶35 "ושני תמידים כהלכתם" dropped by the engine; Shabbat words; Tal/Geshem |

Day-rule constants in the composition (engine workarounds, to be removed when the engine is fixed — see the review
log's engine requests): `PUBLIC_FAST` / `TORAH_READING` (Erev Pesach is not a public fast), `TACHANUN`,
`TACHANUN_MINCHA`, `NO_TACHANUN`, `AVINU_MALKEINU(_MINCHA)` (the Ten Days; Erev RH; Mincha of Erev Shabbat / Yom Tov
/ Chanukah), `FULL_HALLEL_PARTS` (festival keys, not the engine's full/half), `MUSAF_SEASON` (Musaf's season by the
festival).

## How the edition is laid out (read before editing)

- The pack's leaf order is Sefaria's and is **not** always the order of prayer (e.g. Weekday Maariv prints the first
  blessing before Barchu; Korbanot print "Laws of Sacrifices" before "Order of the Temple Service"; Kabbalat Shabbat
  prints Psalm 96 before Psalm 95; Shabbat Pesukei DeZimra prints Psalm 90 before Psalm 34; Tachanun's Shacharit pieces
  are scattered). The composition follows the order of the rite, not the order of the leaves.
- Many conditional passages are printed with a small-print caption in the same paragraph ("בעשי"ת:", "בראש חדש
  ובחול המועד אומרים זה:", "בחנוכה:" …). Those are left to the day engine. A section is cut only where a whole
  paragraph run is said on some days.
- The weekday Amidot (Shacharit, Mincha, Maariv) are cut blessing by blessing, one leaf per blessing, as in the
  Mincha template.
- Some leaves (Shabbat Musaf, Shabbat Mincha, Rosh Chodesh Musaf, the festival Amidah and Musaf) print the seasonal
  and Ten-Days lines as **plain paragraphs** ("בחורף - משיב הרוח", "בקיץ - מוריד הטל", "בעש"ת זכרנו לחיים", "בעש"ת מי
  כמוך"), not as small-print captions, so the day engine would show them every day. Each such paragraph is a
  conditional continuation section (`winter`, `summer`, `aseret`) — helpers `avotWithZachreinu` and
  `gevurotWithSeasons` in the composition. Note: "בקיץ - מוריד הטל" is the Land-of-Israel custom (Ashkenaz in the
  diaspora says nothing in summer); the edition prints it, so it is kept under `summer`.
- Where the edition prints יעלה ויבוא as one small-print paragraph (caption + text), it is its own section
  (`roshChodesh|cholHamoed`), as in the Mincha template — otherwise the engine also hid the following "ותחזינה" on an
  ordinary Shabbat (Shabbat Shacharit and Maariv).

## Services

### weekday-mincha (the template) — reviewed
Read in full (`--full`) against the edition. Kept as authored. Checked: Ashrei → half Kaddish → Amidah (19 named
blessings; Kedusha, chazzan's Aneinu, Modim DeRabbanan and fast-day Birkat Kohanim marked as repetition) → Avinu
Malkeinu → Tachanun (נפילת אפיים, שומר ישראל) → Kaddish Titkabal → Aleinu → Kaddish Yatom.
Doubt: Tisha B'Av נחם — the edition prints "ולירושלים עירך … תכין" and then, under "במנחת תשעה באב", נחם with its own
chatima, replacing only "ברוך … בונה ירושלים". The template follows that layout. Some Ashkenaz siddurim replace the
whole blessing with נחם; the edition does not, so nothing was changed.

### weekday-shacharit
Leaves: Weekday › Shacharit (Preparatory, Korbanot, Pesukei Dezimra, Blessings of the Shema, Amidah, Post Amidah,
Torah Reading, Concluding Prayers, Post Service); Festivals › Rosh Chodesh › Hallel; Festivals › Rosh Chodesh › Musaf;
Festivals › Shalosh Regalim › Mussaf (Chol HaMoed); Kaddish › Half Kaddish.
Order composed:
1. מודה אני · על נטילת ידים · אשר יצר · אלהי נשמה · ציצית · ברכות התורה · יברכך/אלו דברים · טלית · תפילין · מה טובו ·
   אדון עולם · יגדל · ברכות השחר · העקדה · לעולם יהא אדם. (The edition prints Asher Yatzar before Netilat Yadayim and
   the Tefillin before the Tallit; the composition puts them in the order they are said.)
2. Korbanot: כיור · תרומת הדשן · תמיד · קטורת · אביי הוה מסדר · אנא בכח · רבון העולמים · ובראשי חדשיכם (RC) ·
   איזהו מקומן · ברייתא דר' ישמעאל · קדיש דרבנן.
3. מזמור שיר חנוכת הבית · קדיש יתום · ברוך שאמר · הודו · מזמור לתודה · יהי כבוד · אשרי · Psalms 146–150 · ברוך ה׳
   לעולם · ויברך דוד · אתה הוא · שירת הים · ישתבח · שיר המעלות ממעמקים (עשי"ת) · חצי קדיש.
4. ברכו · יוצר אור · אהבה רבה · קריאת שמע · אמת ויציב.
5. Amidah blessing by blessing (Kedusha, chazzan's Aneinu, Modim DeRabbanan, Birkat Kohanim = repetition).
6. Hallel (when Hallel is said; לא לנו / אהבתי only on full-Hallel days) → Kaddish Titkabal on RC / Chol HaMoed.
7. אבינו מלכנו · וידוי (optional — see doubts) · והוא רחום (Mon/Thu) · נפילת אפיים · ה׳ אלהי ישראל (Mon/Thu) · שומר
   ישראל · חצי קדיש (not on RC/Chol HaMoed, where Kaddish Titkabal followed Hallel).
8. Torah reading (torahReading): אל ארך אפים (Torah-reading days with Tachanun) · ויהי בנסוע · בריך שמיה · גדלו ·
   אב הרחמים · ותגלה · ברכות העולה · ברכת הגומל (optional) · חצי קדיש · הגבהה · יהי רצון/אחינו (Mon/Thu with
   Tachanun) · יהללו · לדוד מזמור · ובנחה יאמר.
9. אשרי · למנצח · ובא לציון.
10. RC / Chol HaMoed: חצי קדיש, then Musaf (RC Musaf on Rosh Chodesh, the festival Musaf on Chol HaMoed).
11. קדיש תתקבל · עלינו · קדיש יתום · שיר של יום (one section per weekday, day0…day5) · ברכי נפשי (RC) · קדיש יתום ·
    לדוד ה׳ אורי + קדיש (Elul–Hoshana Rabba) · Land-of-Israel custom: קוה · אין כאלהינו · פטום הקטורת · קדיש דרבנן ·
    ברכו · שש זכירות, י"ג עיקרים (optional).
Doubts:
- וידוי ושלוש עשרה מידות: the edition prints it before Tachanun; many Ashkenaz congregations do not say it daily. Kept,
  marked `optional`.
- The order of the end of Shacharit in the Land of Israel (Ein Keloheinu / Pitum HaKetoret before or after Aleinu, the
  Song of the Day before Aleinu) varies; the composition uses Aleinu → Song of the Day → LeDavid → Ein Keloheinu block.
  The edition's own leaf order (Mourner's Kaddish before Aleinu, Kaddish Shalem after it) is not a prayer order.
- On Rosh Chodesh Barchi Nafshi is placed after the Song of the Day (after Musaf, as Ashkenaz says it).
- After Hallel on Chanukah the ordinary half Kaddish follows (the Tachanun half-Kaddish section, which is not
  conditioned on Tachanun); on RC and Chol HaMoed Kaddish Titkabal follows Hallel and the half Kaddish before Musaf is
  taken from the edition's Kaddish root.
- Tisha B'Av morning (no Tallit/Tefillin, no Birkat Kohanim, Lamenatze'ach omitted) — only Lamenatze'ach is
  conditioned; the rest has no section-level condition.
- Tefillin on Chol HaMoed: shown (no condition); customs differ (Israel: not worn).
מזמור לתודה and למנצח are conditioned on Erev Pesach / Erev Yom Kippur (and מזמור לתודה on Chol HaMoed Pesach); the
embedded Chol HaMoed Musaf has the day's offerings. Erev Pesach is not treated as a public fast (`PUBLIC_FAST`,
`TORAH_READING`), and Tachanun / Avinu Malkeinu follow `TACHANUN` / `AVINU_MALKEINU` (the Ten Days, Erev RH).

### weekday-maariv
Leaves: Weekday › Maariv.
Order: והוא רחום · ברכו · המעריב ערבים · אהבת עולם · שמע · אמת ואמונה · השכיבנו · ברוך ה׳ לעולם (diaspora only) ·
חצי קדיש · Amidah (with אתה חוננתנו on Motzaei Shabbat as its own section) · on a weekday night קדיש תתקבל; on Motzaei
Shabbat חצי קדיש → (ספירת העומר) → ויהי נועם → ואתה קדוש → קדיש תתקבל, as the edition's own caption over the
Kaddish says · ספירת העומר (weekday nights) · עלינו · קדיש יתום · לדוד ה׳ אורי + קדיש (Elul).
Omitted: the line "בחזרת הש"ץ אומרים כאן קדושה" printed in Maariv's קדושת השם (Maariv has no repetition).
Doubts: the Omer on Motzaei Shabbat is placed before ויהי נועם (the common Ashkenaz practice); the edition prints the
Omer leaf after the Motzaei Shabbat leaf without saying where it is said on that night.
Not in the edition: ויתן לך — now from Birnbaum (pp. 541–549, through שיר המעלות אשרי כל ירא ה׳), the last section,
`motzaeiShabbat&!tishaBav`. Doubt: Birnbaum prints it right after the Kaddish of Motzaei Shabbat and before Havdalah; the
composition keeps the Metsudah Aleinu (and Elul's לדוד) before it. The Havdalah said in the synagogue (Havdalah is its
own service), Kiddush Levana is printed (Birkat HaLevana) but belongs to no schema service — left out.
אתה חוננתנו `motzaeiShabbat|motzaeiYomTov`; the Omer shows only tonight's count. Pending: ויהי נועם is not said when a
Yom Tov falls in the coming week (no key).

### bedtime-shema
Leaf: Weekday › Maariv › Keri'at Shema al Hamita, cut into רבונו של עולם · המפיל · קריאת שמע · ויהי נועם/יושב בסתר ·
ה׳ מה רבו צרי · השכיבנו · ברוך ה׳ ביום/יראו עינינו · המלאך הגואל (the verses said three times) · אדון עולם.
The edition places המפיל right after the forgiveness prayer (before Shema); kept as printed.

### kabbalat-shabbat
Leaves: Shabbat › Kabbalat Shabbat. Order: ידיד נפש (optional) · לכו נרננה · שירו · ה׳ מלך תגל · מזמור שירו · ה׳ מלך
ירגזו · מזמור לדוד · אנא בכח · לכה דודי · מזמור שיר ליום השבת · ה׳ מלך גאות לבש · קדיש יתום.
Psalms 95–99 carry `!yomTov&!cholHamoed` (the edition's own note: on Yom Tov / Chol HaMoed that falls on Shabbat one
begins at מזמור לדוד). The note paragraph is a section of its own (see "composer" below).
במה מדליקין (not printed by Metsudah) is now taken from Birnbaum (pp. 251–255): במה מדליקין · אמר רבי אלעזר, then the
Metsudah edition's own Kabbalat Shabbat Kaddish DeRabbanan leaf (which until now stood alone). Condition
`!yomTov&!cholHamoed&!motzaeiYomTov` — Birnbaum p. 252 "omitted on festivals"; the days per Rema OC 270:1. Said on
Shabbat Chanukah. The `missing` entry is removed.

### shabbat-maariv
Leaves: Shabbat › Maariv. Order: ברכו · המעריב ערבים · אהבת עולם · שמע · אמת ואמונה · השכיבנו (ufros) · ושמרו
(וידבר משה on Yom Tov) · חצי קדיש · Amidah (אבות, גבורות, קדושת השם, אתה קדשת, רצה, מודים/על הנסים, שלום רב, אלהי
נצור) · ויכולו · ברכה מעין שבע/מגן אבות (minyan) · קדיש תתקבל · ספירת העומר · עלינו · קדיש יתום · לדוד (Elul) + קדיש ·
יגדל · אדון עולם (optional). The pack prints ושמרו after Aleinu; it is said after השכיבנו.

### shabbat-kiddush
ברכת הבנים (optional) · שלום עליכם · רבון כל העולמים (optional; the edition's note says it is said in the synagogue) ·
אשת חיל · קידוש · the edition's seven Friday-night zemirot (optional).

### shabbat-shacharit
Leaves: Shabbat › Shacharit (and the weekday Birchot HaTorah leaves, which the Shabbat part lacks).
Order: morning blessings as on weekdays (no Tefillin) → Korbanot with וביום השבת (and ובראשי חדשיכם on RC) → מזמור שיר
+ קדיש יתום → ברוך שאמר · הודו · Psalms 19, 34, 90, 91, 135, 136, 33, 92, 93 · יהי כבוד · אשרי · 146–150 · ברוך ה׳
לעולם · ויברך דוד · שירת הים · נשמת · שוכן עד · ישתבח · ממעמקים (Shabbat Shuva) · חצי קדיש → ברכו · הכל יודוך … ·
אהבה רבה · שמע · אמת ויציב → Amidah (Kedusha, Modim DeRabbanan, Birkat Kohanim = repetition) → Hallel (RC /
Chanukah / Chol HaMoed) → קדיש תתקבל → Torah service: אין כמוך/אב הרחמים · ויהי בנסוע · בריך שמיה · שמע/אחד/גדלו · לך
ה׳ · ויעזור · ברכות העולה · מי שברך (oleh, sick, births, bar mitzvah — optional) · הגומל · חצי קדיש · הגבהה · ברכות
ההפטרה (Shabbat / festival / Rosh HaShana endings cut by condition) · יקום פורקן · מי שברך לקהל · prayers for the State,
the soldiers, the captives (optional) · ברכת החודש · אב הרחמים · אשרי · יהללו/מזמור לדוד · ובנחה יאמר · חצי קדיש.
Omitted (with reasons in the file): the Yom-Tov-on-a-weekday המאיר לארץ; the 13 Attributes and רבונו של עולם said
when the ark is opened on a weekday Yom Tov; Psalm 24 for a weekday Yom Tov at the return of the Torah.
Source gaps inside the service: the edition's Shabbat Torah service has no "על הכל", no "אב הרחמים הוא ירחם", no
"ותגלה ותראה" — it goes from לך ה׳ to "ויעזור ויגן". על הכל and אב הרחמים הוא ירחם (role: chazzan) are now taken from
Birnbaum (p. 367) between לך ה׳ and ויעזור; Birnbaum's morning service also has no ותגלה ותראה (it prints it only at
Mincha), so that is not treated as a gap. The Shabbat "איזהו מקומן" leaf is truncated after the third
mishnah (4 paragraphs) — since 2026-09-29 the same edition's complete weekday leaf is read instead.
ברכת החודש `shabbatMevarchim`; אב הרחמים by the edition's own rule (not when Tachanun would not be said on a weekday,
not on Shabbat Mevarchim except Iyar/Sivan/Av; said on Shabbat Shuva). Pending: the Four Parshiyot, Mevarchim Av.

### shabbat-musaf
Amidah (Kedusha נעריצך; תכנת שבת, or אתה יצרת on Shabbat Rosh Chodesh; על הנסים; Birkat Kohanim; נשיאת כפיים in the
Land of Israel) · קדיש תתקבל · קוה · אין כאלהינו · פטום הקטורת · קדיש דרבנן · עלינו · קדיש יתום · שיר של יום (מזמור שיר
ליום השבת) · קדיש יתום · לדוד ה׳ אורי (Elul) + קדיש · אנעים זמירות · קדיש יתום · אדון עולם. Kaddish Yatom after the
Song of the Day, LeDavid and Anim Zemirot reuses the edition's one Musaf Mourner's Kaddish leaf (`rewind`).
The edition's second Kaddish Shalem leaf (inside the Amidah folder) is the same text and is not used.

### shabbat-kiddush-day
קידושא רבא (ושמרו · זכור · בורא פרי הגפן) and the edition's six day-meal zemirot (optional).

### shabbat-mincha
אשרי · ובא לציון · חצי קדיש · ואני תפלתי · Torah reading (ויהי בנסוע · בריך שמיה · גדלו · לך ה׳ · אב הרחמים · ותגלה ·
ברכות העולה · הגבהה · יהללו · לדוד מזמור · ובנחה יאמר) · חצי קדיש (the same leaf, `rewind`) · Amidah (אתה אחד +
אלהינו… רצה במנוחתנו, which the edition prints at the top of the "Temple Service" leaf; יעלה ויבוא; מודים; על הנסים for
Chanukah and for Purim — the Purim leaf also carries the end of Modim) · צדקתך · קדיש תתקבל · עלינו · קדיש יתום · ברכי
נפשי (winter: the `winter` key, from Shemini Atzeret to Pesach, stands for Shabbat Bereshit–Shabbat HaGadol).
Pirkei Avot (summer) and the Shir HaMa'alot psalms that follow ברכי נפשי are not printed by Metsudah — both now from
Birnbaum: שיר המעלות (Ps. 120–134, pp. 467–475) after ברכי נפשי under `winter`; פרקי אבות (pp. 477–533) after Kaddish
Yatom, one section per chapter (`avot1`…`avot6`, the luach schedule in `services/prayer/pirkeiAvot.mjs`; the last
weeks show two chapters). Each chapter is shown as Birnbaum prints it, with its own כל ישראל and רבי חנניא — on a
double week both appear twice (doubt: many say them once for the pair). Birnbaum prints no Kaddish DeRabbanan after
Pirkei Avot; none is added.
צדקתך `tachanunIfWeekday|shabbatShuva`. The Shabbat Shuva paragraphs (בש"ת וכתב, בש"ת בספר חיים) are sections of
their own (`aseret`) — the day engine does not know the abbreviation בש"ת. Pending: the Four Parshiyot.

### havdalah
הנה אל ישועתי · בורא פרי הגפן · בורא מיני בשמים · בורא מאורי האש · המבדיל.

### birkat-hamazon
על נהרות בבל (weekdays with Tachanun) / שיר המעלות (Shabbat, Yom Tov, days without Tachanun) · זימון · הזן · הארץ (על
הנסים) · בונה ירושלים (רצה on Shabbat; יעלה ויבוא) · הטוב והמטיב · הרחמן (conditional lines left to the day engine) ·
דיני שכחה (the edition's blessings for one who forgot רצה/יעלה ויבוא — kept, they belong to Birkat HaMazon).
The caption "בשבת קודם ברכת המזון אומרים:" is a continuation section of its own: the day engine reads it as "on
Shabbat" and hid שיר המעלות on Rosh Chodesh, Chanukah and the festivals when it shared the psalm's section.
Doubt: the edition's caption over יעלה ויבוא names only Rosh Chodesh and Chol HaMoed; the day engine may hide it on
Yom Tov (the section itself is conditioned `roshChodesh|yomTov|cholHamoed`).

### hallel
The edition's Hallel (under Rosh Chodesh): ברכה · 113 · 114 · לא לנו (full Hallel only) · 115 rest · אהבתי (full
Hallel only) · 116 rest · 117 · 118 · יהללוך.

### rosh-chodesh-musaf
Amidah of Rosh Chodesh (Kedusha נקדש; ראשי חדשים; על הנסים for Rosh Chodesh Tevet; Birkat Kohanim; נשיאת כפיים in
the Land of Israel) + קדיש תתקבל (weekday Shacharit's Kaddish Shalem leaf).

### omer
Weekday Maariv › Sefirat HaOmer, cut: לשם יחוד · ויהי נועם · ברכה · the 49 days · הרחמן · למנצח · אנא בכח · רבונו של
עולם. The edition prints all 49 counts, one paragraph each ("<date> n. היום …"); in today's prayer only tonight's
(`perDay: dayBlocks('omerDay', …)`), in the edition all 49. The weekday and Friday-night Maariv use the same table
(the Shabbat leaf prints only "היום [...]").

### festival-amidah
The edition's one Amidah for Maariv, Shacharit and Mincha of the festivals; the prayer of the hour decides:
כי שם ה׳ אקרא (Mincha), the Kedusha of Shacharit or of Mincha (none at Maariv), its closing לדור ודור (not printed in
this leaf — taken from the edition's festival Musaf Kedusha), Modim DeRabbanan (not at Maariv), Birkat Kohanim
(Shacharit), and the last blessing: שים שלום at Shacharit and at a Shabbat Mincha, שלום רב (the edition's Friday-night
leaf) at Maariv and a weekday Mincha (Rema OC 127:2). The festival names are cut one line per festival (`pesach`,
`shavuot`, `sukkot`, `sheminiAtzeret`); the whole-paragraph Shabbat lines by `shabbat`; ותודיענו by `motzaeiShabbat`.
The small-print Shabbat words inside paragraphs are left to the day engine (pending).

### festival-musaf
Kedusha: נעריצך on Yom Tov, Shabbat Chol HaMoed and Hoshana Rabba; נקדש on weekday Chol HaMoed; אדיר אדירנו not on
Shabbat Chol HaMoed (the edition's note). Omitted: a second "אני ה׳ אלהיכם" printed twice; the cross-reference
"או"א וכו׳"; the caption over והקרבתם (the day engine read it as Chol HaMoed only). Season by the festival
(`MUSAF_SEASON`). Offerings: ובחדש הראשון `pesachFirstDays`; והקרבתם `cholHamoedPesach|pesachLastDays`; Sukkot
`sukkotFirstDays`; Chol HaMoed Sukkot + Hoshana Rabba from the edition's per-day table — the Land of Israel the day's
verse (`sukkotDay` dayBlocks), the diaspora the two doubtful days (ספיקא דיומא); then ומנחתם ונסכיהם (the paragraph
printed once, said again after the later verses — `uminchatam-after`). Birkat Kohanim: ותערב inside רצה when the
priests go up (`yomTov|israel`), its closing in the edition's two customs (US congregations → diaspora; Gra and the
Land of Israel → Israel), the duchening after Modim, and on diaspora Chol HaMoed the chazzan's ברכנו (from the
festival Amidah leaf). Tefillat Tal / Geshem (separate leaves) are not composed.

## Suspicious text seen (not fixed)

- Weekday Shacharit › Torah Study ¶1: an empty paragraph.
- Shabbat › Shacharit › Amidah › Kaddish Shalem ¶0 (also Musaf and Mincha Kaddish Shalem, Kaddish › Kaddish Shalem):
  "יתגדל ויתקדש גרסת הגר"א: יתגדל ויתקדש…" — a variant note glued into the text, and the congregation's responses
  ("קהל: קבל ברחמים…") inline.
- Festivals › Rosh Chodesh › Musaf › Avot ¶4–5: "ברוך אתה ה'" and "מגן אברהם:" split into two paragraphs.
- Festivals › Shalosh Regalim › Mussaf › Kedusha ¶8–9: "אני ה' אלהיכם" printed twice (omitted once).
- Shabbat › Shacharit › Preparatory Prayers › Korbanot › Laws of Sacrifices: only mishnayot 1–3 (truncated).
- Shabbat › Shabbat Evening › Zemirot › Kol Mekadesh ¶32: ends with a stray "]".
- Festivals › Shalosh Regalim › Mussaf › Sanctity of the Day ¶12, ¶23, ¶68 and Amida … ¶23: "ו ישראל", "ו יום",
  "ו מועדים" — a Shabbat word dropped out leaving a lone ו (the edition's small-print "לשבת" alternatives).
- Weekday Maariv › Amidah › Knowledge ¶1: אתה חוננתנו ends with "ו..." (continues into חננו).
- Shabbat › Musaf LeShabbat › Amidah › Patriarchs ¶3, Divine Might ¶1–2, ¶4: the conditional lines (בעש"ת, בחורף,
  בקיץ) are not in small print here, so they are not captions for the day engine.
- Weekday Shacharit › Hallel is printed under "Rosh Chodesh" but serves every Hallel.

## Needed from the composer / schema (not edited here)

Superseded by the engine requests E1–E11 in `docs/siddur/review-ashkenaz.md` (final review). Items 1 (מדלגין) and the
שוכן עד part of 2 are fixed in the engine; item 0's truncation no longer happens (the words are shown as marked
alternatives instead); item 4's keys now exist except those listed as E6–E9.


0. **Day engine truncation (all rites, all services, the template included):** in prayer mode a Ten-Days alternative
   printed inline cuts off the words after it. Seen on an ordinary Tuesday in the weekday leaves: every Kaddish ends at
   "לעלא מן כל" (the "( בעשי"ת לעלא לעלא מכל) ברכתא ושירתא … ואמרו אמן" is lost), and "עשה ( בעשי"ת השלום) שלום
   במרומיו …" ends at "עשה"; in the Shabbat leaves "ברוך אתה ה׳ האל [בעשי"ת המלך] הקדוש" ends at "האל", Kaddish
   Titkabal ends at "לעילא מן כל", and "בעשי"ת - וכתב לחיים" hides the following "וכל החיים יודוך … להודות". The full
   edition mode shows everything. This is in `services/siddurBlocks.mjs` / `resolveConditionalMarkup` (currently being
   edited in the working tree) — not something a composition can fix.

1. **Day engine bug — Hallel:** the caption "בראש חודש ובחוה"מ פסח מדלגין:" is read by `rubricConditions.mjs` as
   "said on Rosh Chodesh" (`/^בראש חודש/`) because `SKIP_INSTRUCTIONS` knows "מדלגים" but not "מדלגין". On full-Hallel
   days (Chanukah, Sukkot, Yom Tov) לא לנו and אהבתי are therefore hidden in prayer mode. Fix: add "מדלגין" to
   `SKIP_INSTRUCTIONS` (the section conditions in the composition are already right).
2. **Day engine — notes that open with a day name:** a note like "ביום טוב שחל בשבת … מתחילים מזמור לדוד" is read as
   the caption "on Yom Tov" and hides the text after it. Worked around in Kabbalat Shabbat (the note is its own
   section) and in Birkat HaMazon ("בשבת קודם ברכת המזון אומרים:"). Not possible where caption and text share one
   paragraph: Shabbat שוכן עד — "ביום טוב ינגן החזן 'האל בתעצומות': האל בתעצומות עזך … המלך היושב על כסא רם ונשא" is
   hidden on Shabbat though everyone says it (only the chazzan's starting point differs); Mi Sheberach for the sick —
   "בשבת: שבת היא מלזעוק" is hidden on Shabbat itself.
3. Caption keys missing: "לשבת:" (with a colon; Shabbat Maariv ושמרו), "בחול קודם ברכת המזון אומרים:", "בראשון
   בשבת:" / "בשני בשבת:" … (Song of the Day captions; the sections carry `day0`…`day5`).
4. Condition keys missing: `shabbatMevarchim`; `avHarachamim` (Shabbat when Tachanun would not be said on a weekday);
   `tachanunIfWeekday` for צדקתך on Shabbat Mincha; `erevPesach`, `erevYomKippur` (Mizmor LeToda, Lamenatze'ach, El
   Erech Apayim); `yomTovNextWeek` (ויהי נועם); `motzaeiYomTov`; day of Chol HaMoed (Musaf offerings); first vs last
   days of Pesach; `prayerType` (to choose the Shacharit or Mincha Kedusha of the festival Amidah, and Birkat Kohanim
   only at Shacharit/Musaf).
5. The `tachanun` key does not cover Shavuot (6 Sivan) and Erev Shabbat Mincha in `jewishContextEngine`
   `tachanunOmitted` — Birkat HaMazon adds `yomTov`/`shabbat` explicitly to cover it.
6. Concepts missing in the schema: `zemirot`-like concepts exist, but nothing for the Mi Sheberach prayers, the prayer
   for the State, Yekum Purkan (used `torah-service`), the Six Remembrances / 13 Principles (used `closing-passages`),
   ברכת הבנים (used `kiddush`), רבון כל העולמים (used `shalom-aleichem`), אתה חוננתנו (used `motzaei-shabbat`),
   קבלת שבת psalms individually (used `kabbalat-shabbat`).

## Remaining Ashkenaz gaps after the Birnbaum import (2026-09-29)

- **Not text gaps any more:** במה מדליקין, פרקי אבות, שיר המעלות after ברכי נפשי, על הכל / אב הרחמים הוא ירחם, ויתן לך.
- **Shabbat איזהו מקומן truncated — closed 2026-09-29** by reading the Metsudah weekday leaf. Was: the Shabbat leaf (Daat) stops after the third mishnah: Birnbaum's Shabbat service
  prints no Korbanot (it refers back to the weekday pages), so it was not imported. The Metsudah *weekday* leaf
  (`Weekday, Shacharit, Preparatory Prayers, Korbanot, Laws of Sacrifices`) is complete (8 mishnayot) — using it in
  Shabbat Shacharit, like Birchot HaTorah, closes this without a new source — done 2026-09-29 (`review-ashkenaz.md`).
- **אל תירא** (Birnbaum pp. 463–465, after Aleinu of Shabbat Mincha) and Birnbaum's other passages not listed as missing
  were not imported.
- **Tefillat Tal / Geshem, the Four Parshiyot, Mevarchim Av, "Yom Tov later this week" (ויהי נועם), the leap-year line,
  the inline בעש"ת / Shabbat words**: day-engine keys (review-ashkenaz.md E1–E11), not missing text.
- **Motzaei Shabbat that is Tisha B'Av:** ויתן לך is left out; ויהי נועם is still shown (the Metsudah composition's
  `motzaeiShabbat` condition; Ashkenaz omits it that night) — a condition item, not text.
- The Birnbaum text is the Wikisource transcription: verses follow "Mikra al pi ha-Masorah", qamats qatan / holam haser
  are marked; Birnbaum's own printed readings, where different, are listed in `sources/birnbaum-ashkenaz/provenance.json`.
