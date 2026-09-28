# Final Siddur QA — Nusach Sefard (Chassidic) review log

Rite id `sefard`. Edition: Sefaria "Siddur Sefard" (Torat Emet 357 / Metsudah). Reviewer pass of 2026-09-28, following
`docs/siddur/final-qa-brief.md`. Files touched: `src/data/nusach/compositions/sefard.mjs`, `docs/siddur/notes-sefard.md`,
this log, `tests/siddurFinal-sefard.test.mjs`. No engine file was edited.

Method: each service was printed in prayer mode on several real dates (Israel and diaspora where it matters) and in
edition mode, and read section by section; the long services were read with the first/last words of every paragraph
and in full where a boundary, a Kaddish, a caption or a seasonal line was involved. A scan compared, for every
unconditioned section, the words shown in today's prayer with the words of the edition, to find captions that silently
hide words every day (it found two, below).

Date shorthand (Hebrew → civil): 22 Cheshvan 5787 = 2026-11-02 (Mon, Tachanun); 1 Kislev = 2026-11-11 (RC, Wed);
27 Kislev = 2026-12-07 (Chanukah day 3); 30 Kislev = 2026-12-10 (RC Tevet, Chanukah 6); 17 Tishrei = 2026-09-28 (CHM
Sukkot); 21 Tishrei = 2026-10-02 (Hoshana Rabba); 22 Tishrei = 2026-10-03 (Shemini Atzeret, Shabbat); 14 Nisan 5787 =
2027-04-21 (Erev Pesach); 15/16/18/21/22 Nisan = 2027-04-22/23/25/28/29; 6 Sivan = 2027-06-11; 17 Tammuz = 2027-07-22;
3 Tishrei = 2026-09-14 (Tzom Gedaliah); Omer 5786: nights of 16, 17, 22, 23 Nisan, 18 Iyar, 5 Sivan.

## Service by service

### weekday-shacharit — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 22 Cheshvan (full), 1 Kislev, 27 & 30 Kislev, 17 Tishrei (IL + diaspora), 18 Nisan, 14 Nisan, 9 Tishrei,
3 Tishrei, 17 Tammuz. Read end to end on the Monday; the Rosh Chodesh, Chanukah and Chol HaMoed blocks by outline and
boundaries.
Defects fixed:
- Hallel was always whole: לא לנו / אהבתי now skipped by the edition's caption on RC, CHM Pesach, last days of Pesach
  (`hallel-lo-lanu`, `hallel-ahavti`); ואברהם זקן · זבדיה (`hallel-veavraham`) only on RC (was every Hallel day).
- RC Tevet: Kaddish Titkabal after Hallel (was half Kaddish) and the Chanukah reading from a second scroll
  (`rc-chanukah-torah-text`).
- Ta'anit Bechorot (Erev Pesach) was a public fast: Aneinu, the Vayechal reading and the Torah service showed on every
  Erev Pesach. `FAST = fast&!erevPesach`, `TORAH_DAYS` (also used by Mincha's Aneinu / Birkat Kohanim / readings).
- Lamenatzeach, Kel Erech Apayim, Beit Yaakov: now left out on Erev Pesach and Erev Yom Kippur (new keys); Lamenatzeach
  also on Chol HaMoed (was shown).
- Mizmor LeToda: `!erevPesach&!cholHamoedPesach&!erevYomKippur` (was every day).
- New readings: Chanukah (`chanukah-torah-text`, today's day only via `dayBlocks('chanukahDay')`), CHM Sukkot (Israel:
  the day via `sukkotDay`; diaspora: the edition's table with its ספיקא rule), CHM Pesach (the date's block via
  `pesachDay`; the edition's own "if it is Sunday…" directions are inside the block).
Pending (why): Purim Katan and house of mourning (no key); Mon/Thu parasha and the Purim reading (no parasha key; the
`purim` key also holds on Shushan Purim); lulav and Hoshanot on CHM Sukkot (no concept); Selichot of each fast, Tisha
B'Av Shacharit (not composed). Order doubts kept from the author (Torah returned before Ashrei on Mon/Thu; tallit and
tefillin before the morning blessings, as the edition's tree).

### weekday-maariv — CONDITIONS PENDING → CONDITIONS PENDING (reviewed)
Printed: 22 Cheshvan, Motzaei Shabbat 27 Cheshvan, Motzaei Yom Tov 21→22 Nisan (IL), Omer nights.
Fixed: Omer shows tonight's count only; Atah Chonantanu `motzaeiShabbat|motzaeiYomTov`.
Pending: Vihi No'am / VeAtah Kadosh are skipped when a Yom Tov falls in the coming week — no key.

### shabbat-maariv — CONDITIONS PENDING → VERIFIED COMPLETE
Printed: 20 Cheshvan eve, 24 Nisan 5786 eve (Omer). Fixed: Omer per day (section `omer` → `omer-direction` + `omer`,
`omer-count`, `omer-after`).

### hallel — CONDITIONS PENDING → VERIFIED COMPLETE
Printed on 1 Kislev, 27 Kislev, 30 Kislev, 17 Tishrei, 15 Nisan, 16 Nisan (diaspora), 18/21 Nisan, 22 Nisan
(diaspora), 6 Sivan, 22/23 Tishrei, an ordinary day. Whole / half as above; on a day with no Hallel the whole Hallel.
Why not the engine's `fullHallel/halfHallel`: they miss Shemini Atzeret, 16 Nisan and 7 Sivan (diaspora) and 22 Nisan.

### omer — CONDITIONS PENDING → VERIFIED COMPLETE
Days 1, 2, 7, 8, 33 (34 checked too), 49: only that night's paragraph ("ט"ז ניסן" / "1. הַיּוֹם…" / sefira); the
intention and blessing before, הרחמן · למנצח · אנא בכח after; the edition mode keeps the 49.

### shabbat-kiddush — UNVERIFIED → VERIFIED COMPLETE
Read in full. Order: Birkat HaBanim, Shalom Aleichem, Ribon Kol HaOlamim, Eshet Chayil, Atkinu, Azamer, Kiddush,
לישב בסוכה (`sukkot`, now labelled). No defect.

### shabbat-shacharit — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 20 Cheshvan (full), 27 Cheshvan (Mevarchim), 25 Kislev (Chanukah + Mevarchim), 1 Shevat (RC), 29 Shevat,
24 Nisan (Mevarchim Iyar).
Fixed: Hallel on Shabbat Chanukah and Shabbat Chol HaMoed (was only RC), whole/half; Birkat HaChodesh
`shabbatMevarchim&!roshChodesh`; Av HaRachamim + Hazkarat Neshamot `!shabbatMevarchim&tachanunIfWeekday|shabbatMevarchim&omer&!roshChodesh`
(the edition's rule: not when Tachanun would be omitted, not on Mevarchim except Iyar, Sivan, Av).
Pending: BaHaB Mi Sheberach (month of Mevarchim unknown — shown "יש אומרים"); Av HaRachamim on Mevarchim Av (hidden,
should show) and on the four parshiyot (shown, should hide); the parasha/haftarah texts are not in the edition's order.
Seen, not changed: "(בעשי"ת ולעלא מכל)" and similar Ten-Days parentheses remain visible all year (engine).

### shabbat-musaf — UNVERIFIED → VERIFIED COMPLETE
Read in full on 1 Shevat (Shabbat RC: Atah Yatzarta, leap-year ולכפרת פשע) and outline on 20 Cheshvan (Tikanta) and
25 Kislev (Al HaNisim Chanukah only). No defect. (Kaddish DeRabbanan prints "בא"י / קדישא" as the edition does.)

### shabbat-kiddush-day — UNVERIFIED → VERIFIED COMPLETE
Read in full (Atkinu / Asader, Chai Hashem, Kiddusha Rabba). No defect.

### shabbat-mincha — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 20 Cheshvan (full up to Pirkei Avot), 1 Iyar (Shabbat RC, summer).
Fixed: after "אומר ג' פעמים:" the Shabbat leaf skips the verses (ה' צבאות עמנו… אתה סתר לי); they are now shown from the
edition's own weekday Mincha (`ketoret-verses`, rest of that leaf omitted with reason). Barchi Nafshi
`winter&!sheminiAtzeret`, Pirkei Avot `summer&!pesach&!roshHashana&!aseret&!afterYomKippur&!sukkot` (edition ¶68).
Pending: Tzidkatcha on the four parshiyot (no key); the week's chapter of Avot (all six shown); "עד שבת הגדול".

### birkat-hamazon — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 22 Cheshvan, 1 Kislev, 27 Kislev, 17 Tishrei, 20 Cheshvan (Shabbat). Read in full.
Defects fixed: on Chanukah both בימי מתתיהו and בימי מרדכי were shown (captions lost) — split `al-hanisim-chanukah` /
`al-hanisim-purim`; Ya'aleh VeYavo showed "שמיני עצרת החג הזה" and "הזכרון הזה" on every day (captions "לש"ע וש"ת:",
"לר"ה:" unknown to the engine) — one section per day line; the three הרחמן יברך alternatives (parents' table, own table,
guest) are now alternatives (`יש אומרים`) with the guest's before אותנו ואת כל אשר לנו.
~~Pending (source gap): the Shavuot line of Ya'aleh VeYavo is an empty paragraph (¶54).~~ **Filled 2026-09-29** from the
Torat Emet 357 version of the same Sefaria leaf (Public Domain): on Shavuot the whole Ya'aleh VeYavo is read from it
(¶51 opening, ¶54 "בשבועות: חַג הַשָּׁבֻעוֹת", ¶59 "הַזֶּה. זָכְרֵנוּ…"); every other day keeps the Metsudah paragraphs.

### rosh-chodesh-musaf — UNVERIFIED → VERIFIED COMPLETE
Printed: 1 Kislev (full), 1 Sivan 5786 (non-leap: the leap-year words stay visible with their caption), 30 Kislev
(Al HaNisim), 1 Elul.
Defects fixed: כי שם יהוה אקרא was hidden on every weekday RC by the pointer "אם חל בשבת ראה" read as a caption
(`amidah-opening-pointer` omitted); LeDavid + Kaddish Yatom after Musaf in Elul (`ledavidAfterMusaf`) — the weekday
closing where Shacharit prints LeDavid is hidden on RC.

### festival-amidah — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 15 Nisan Maariv / Shacharit (read) / Mincha, 6 Sivan, 15 Tishrei Maariv (Shabbat), 22 Tishrei Shacharit,
23 Tishrei Maariv diaspora (Motzaei Shabbat: ותודיענו).
Fixed: Vayedaber Moshe + half Kaddish only at Maariv; "לערבית ולשחרית:" / "למנחה:" (unknown caption) → conditions;
Kedusha of Shacharit / of Mincha by prayer; Modim DeRabbanan not at Maariv; Birkat Kohanim only at Shacharit (was at
every prayer); the festival's name one line per festival (the engine showed "שמיני עצרת" every festival); Kaddish,
Aleinu, Kaddish Yatom not after the Shacharit Amidah (Hallel and Musaf follow); Veshamru, Vayechulu and Magen Avot on
Yom Tov that is Shabbat, from the edition's Friday-night order; the ¶58 direction shown at Maariv.
Pending: Gevurot's one-paragraph "בקיץ: מוריד הטל. בחורף: משיב הרוח" shows neither on winter festival prayers (engine).

### festival-musaf — UNVERIFIED → TEXT COMPLETE / CONDITIONS PENDING (reviewed)
Printed: 15 Nisan, 16 Nisan (diaspora), 18 & 21 Nisan, 6 Sivan, 15 Tishrei (Shabbat), 17 Tishrei IL + diaspora,
21 Tishrei IL + diaspora, 22 Tishrei.
Fixed: last days of Pesach took the first-days verses (now `pesachFirstDays` / `cholHamoedPesach|pesachLastDays`);
Sukkot first days `sukkotFirstDays`; CHM Sukkot: Eretz Yisrael the day's block, diaspora ספיקא דיומא (the day before and
the day, with the rule); Hoshana Rabba its own verses and the festival Keter (was the Chol HaMoed Keter); the festival's
name lines split; Shabbat verses by `shabbat`; Kohanim bless in Eretz Yisrael daily and in the diaspora on Yom Tov not
Shabbat, else the chazzan's "אלהינו ואלהי אבותינו ברכנו"; LeDavid through Hoshana Rabba.
~~Source gap — "…הזה, נעשה ונקריב… כאמור" printed only in the Shemini Atzeret line (¶26).~~ **Filled 2026-09-29**: the
edition prints the continuation once, after the last festival line, for every line; the Torat Emet pack carries ¶26 split
at "הַזֶּה, נַעֲשֶׂה" (markup only), and `musaf-name-continuation` follows the name on Pesach, Shavuot and Sukkot.
Pending: Gevurot season line (engine, and the reader computes
the season at Musaf as at Shacharit); Tefilat Tal / Geshem not composed; ותערב printed unconditionally.

### Spot-checks of VERIFIED services
- weekday-mincha (Erev Pesach, 17 Tammuz): after the `FAST` fix Erev Pesach has no Aneinu / reading / Birkat Kohanim;
  17 Tammuz complete (reading, Haftarah, both Aneinu, Birkat Kohanim, Avinu Malkeinu, Tachanun).
- kabbalat-shabbat: **defect** — Psalm 29 (מזמור לדוד הבו לה') was hidden every Friday: its caption "ביום טוב ובשבת חול
  המועד מתחילים כאן" was read as "only on Yom Tov". Fixed (`mizmor-ledavid-direction` omitted with reason).
- shabbat-maariv, bedtime-shema, havdalah: outlines and the hidden-words scan clean.

## Engine requests (not done — shared files)
1. `tachanunOmitted` (jewishContextEngine): Tishrei 1–23 is all "no Tachanun", so on Tzom Gedaliah and 4–8 Tishrei
   there is no Tachanun and no Avinu Malkeinu (`avinuMalkeinu = tachanun && …`), and `tachanunIfWeekday` is false on
   Shabbat Shuva. Also missing: Sivan 1–12 (Sefard), 14–15 Adar I, Lag BaOmer, 15 Av, 15 Shevat, Pesach Sheni, 9 Av.
2. `fast` includes Ta'anit Bechorot (hebcal MINOR_FAST) — worked around here with `fast&!erevPesach`.
3. `shabbatMevarchim` holds on the 30th (Shabbat Rosh Chodesh) — should be days 23–29; worked around with `&!roshChodesh`.
4. `fullHallel` / `halfHallel`: Shemini Atzeret, diaspora 16 Nisan and 7 Sivan missing from full; 22 Nisan missing from
   half; 16 Nisan diaspora counted half.
5. siddurBlocks / conditionalMarkup: a paragraph "בקיץ: X. בחורף: Y." in one small-print paragraph shows neither in
   winter (festival Amidah ¶8, festival Musaf ¶5).
6. RiteServiceReader / print script pass prayerType `shacharit` for Musaf, so `mashivHaruch` at Musaf of 15 Nisan and
   22 Tishrei is computed as for Shacharit (Tal / Geshem switch).
7. Rubric table: "לש"ע וש"ת:", "בשמ"ע וש"ת:", "לר"ה:", "אם חל בשבת ראה" (a pointer), "ביום טוב … מתחילים כאן" (a starting
   point, not a condition) — handled here by sections.
8. Keys wanted: `purimKatan`, `shushanPurim`/walled city, `houseOfMourning`, `festivalNextWeek` (Vihi No'am),
   `arbaParshiyot`, month of Mevarchim (BaHaB, Mevarchim Av), `parasha`, `pirkeiAvotChapter`, `shabbatHagadol`,
   `specificFast` (Selichot); concept `hoshanot` / `lulav`, `tal-geshem`.
9. `whenLabel` of compound expressions reads mechanically ("… לא בערב פסח ובשני ובחמישי, בערב פסח").

## Open Siddur and other references
Open Siddur (opensiddur.org) returned HTTP 403 to every fetch (Sefard/Ari weekday Shacharit PDF, Siddur Torah Or page);
only search listings were visible — no text was compared or copied. A web search on the Kaddish after Hallel on
Rosh Chodesh Tevet (breslev.co.il, daat.ac.il, din.org.il via search summary) gave "Rosh Chodesh: Kaddish Titkabal;
Chanukah weekday: half Kaddish" without settling RC Tevet; the choice (Titkabal, as a day with Musaf) is logged here
as a minhag doubt. Disagreements noted in the edition itself: the Hallel blessing is printed only as "לקרא את ההלל"
(many Chassidim say "לגמור" on every Hallel) — edition kept; Mizmor LeToda's note omits Erev Yom Kippur (added, Rema
51:9); the edition prints ותערב and "ביו"ט" הרחמן without the Chol HaMoed / duchening conditions.

## Summary
Before: 10 UNVERIFIED, 4 CONDITIONS PENDING, 4 VERIFIED (weekday Mincha, Bedtime Shema, Kabbalat Shabbat, Havdalah). After: 0 UNVERIFIED; VERIFIED COMPLETE 11 (weekday Mincha, Bedtime Shema, Kabbalat Shabbat, Friday Maariv,
Friday Kiddush, Shabbat Musaf, Kiddusha Rabba, Havdalah, Hallel, Rosh Chodesh Musaf, Omer); CONDITIONS PENDING 7
(weekday Shacharit, weekday Maariv, Shabbat Shacharit, Shabbat Mincha, Birkat HaMazon, festival Amidah, festival
Musaf), each with its exact reason. Tests: `tests/siddurFinal-sefard.test.mjs` (13 tests); full suite green.

## Text gaps filled (2026-09-29)

A second version of the same Sefaria index, *Torat Emet 357* (Public Domain; `src/data/nusach/siddurSefardToratEmet.mjs`,
built by `scripts/build-sefard-torat-emet.mjs`, provenance in `sources/sefard-torat-emet/`), is read only where the
bundled Metsudah version of a leaf lost words:

| Where | Metsudah (bundled) | Filled from Torat Emet 357 | Days |
|---|---|---|---|
| Birkat HaMazon, Ya'aleh VeYavo | ¶54 empty — no Shavuot line | ¶51, ¶54 "בשבועות: חַג הַשָּׁבֻעוֹת", ¶59 "הַזֶּה. זָכְרֵנוּ…" (`yv-shavuot-*`) | Shavuot only |
| Festival Musaf, "ואת מוסף יום …" | (Torat Emet itself) the continuation printed once, after the Shemini Atzeret line | ¶26 split at "הַזֶּה, נַעֲשֶׂה" → `musaf-name-continuation` | Pesach, Shavuot, Sukkot (incl. Chol HaMoed) |
| Bedtime Shema | only שמע and ואהבת, though the edition's note (¶2) asks for והיה אם שמוע (and ויאמר, Rabbenu Yerucham) | ¶6 והיה אם שמוע, ¶7 ויאמר (`vehaya-vayomer`, "יש אומרים") | every night |

Not text gaps, left as they are (they need engine or schema work, not text): the Torah reading of Monday/Thursday and
Purim, Hoshanot and Netilat Lulav in Chol HaMoed Sukkot (the text is in the edition — `Holidays, Shaking Lulav`,
`Sukkot, Order of Hoshanot` — but the schema has no `hoshanot` concept), the fast-day Selichot, the Shabbat Torah reading.
Tests: `tests/siddurTextGaps.test.mjs`.

## Engine conditions (2026-09-29)

Day-engine work only; the words are the edition's. Tests: `tests/engineConditions.test.mjs`.

| Item | Resolution | Source |
|---|---|---|
| ויהי נועם / ואתה קדוש, Motzaei Shabbat before a Yom Tov week; Tisha B'Av | `yomTovThisWeek` → the weekday Kaddish Titkabal; Tisha B'Av → no ויהי נועם (ואתה קדוש said), and no ויתן לך | Rema OC 295:1, MB 295:3; SA / Rema OC 559:2 |
| אב הרחמים and אל מלא רחמים: Four Parshiyot, Mevarchim Av | `arbaParshiyot`, `mevarchimAv` | the edition's note, Av HaRachamim ¶0 |
| צדקתך on the Four Parshiyot | `tachanunIfWeekday&!arbaParshiyot` | the edition's note, Shabbat Mincha Amidah ¶49 |
| Pirkei Avot, one chapter a week | the leaf cut into its six chapters (each from כל ישראל to רבי חנניא), `avot1` … `avot6` (pirkeiAvot.mjs). ¶0 opens with the title and goes on with כל ישראל and mishnah א: `siddurBlocks` now parts a leading `<big>` title from the words after its line break (before, the whole paragraph — כל ישראל and mishnah א — was dropped as a heading) | the edition's note ¶68; the common luach schedule |
| ברכי נפשי "עד שבת הגדול" | already right: `winter` at Shabbat Mincha ends with Shabbat HaGadol (the wording turns at Musaf of 15 Nisan) — checked | the edition's note ¶68 |
| Gevurot, festival Amidah and Musaf (winter shows neither) | already resolved by the caption engine — checked at Arvit/Shacharit of 15 Nisan, Mincha of 22 Tishrei, Musaf of 22 Tishrei (משיב הרוח) and of 15 Nisan (מוריד הטל) | — |
| Tefillat Tal / Geshem | the edition's leaves (Holidays › Prayer for Dew / Rain) through "מכלכל חיים", as `repetition` sections after the individual's Gevurot; the rest of each leaf (Keter to Kaddish, the Musaf printed again) omitted with its reason | the leaves |
| Purim Katan (למנצח, בית יעקב) | `purimKatan` (14–15 Adar I) | the edition's notes |
| Monday / Thursday reading | the edition's table "קריאות לשבת במנחה, ושני וחמישי", only the portion of the next Shabbat on which one is read (`weeklyReading`, hebcal Sedra; after Ha'azinu until Simchat Torah: וזאת הברכה); not on Rosh Chodesh, Chanukah, Chol HaMoed, Purim, a public fast (Erev Pesach reads it) | SA OC 135:2 |
| Purim reading | "ויבא עמלק" (Purim › Torah Reading) on 14 Adar (`purimDay`); the app has no walled-city residence, so Shushan Purim is not a reading day | SA OC 693:4 |
| The fast's Selichot | Asara BeTevet, Taanit Esther, 17 Tammuz (Fast Days leaves) after the repetition, before Avinu Malkeinu | the leaves |

Still pending, with the reason in the composition: house of mourning (no user state), Hoshanot (no schema concept),
Tzom Gedaliah Selichot (not in the edition), Tisha B'Av order, BaHaB (the edition gives no Shabbat), the Shabbat
Torah reading, Birkat HaMazon's lost captions, ותערב.
