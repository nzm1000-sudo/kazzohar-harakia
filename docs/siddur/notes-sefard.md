# Nusach Sefard (Chassidic): composition notes

Composition: `src/data/nusach/compositions/sefard.mjs`. Edition: Sefaria "Siddur Sefard" (Torat Emet 357, Public Domain; the Metsudah siddur, CC-BY). Every section is a slice of this pack. No text from another rite is used.

QA (`node scripts/siddur-qa.mjs sefard`): no problems in any service (every anchor found, every paragraph of every leaf used is shown or omitted with a reason, and no paragraph is used twice).

| Service | Level | reviewed |
|---|---|---|
| weekday-shacharit | TEXT COMPLETE / CONDITIONS PENDING | true |
| weekday-mincha | VERIFIED COMPLETE | true |
| weekday-maariv | TEXT COMPLETE / CONDITIONS PENDING (Vihi No'am) | true |
| bedtime-shema | VERIFIED COMPLETE (see the text gap below) | true |
| kabbalat-shabbat | VERIFIED COMPLETE | true |
| shabbat-maariv | VERIFIED COMPLETE | true |
| shabbat-kiddush | VERIFIED COMPLETE | true |
| shabbat-shacharit | TEXT COMPLETE / CONDITIONS PENDING | true |
| shabbat-musaf | VERIFIED COMPLETE | true |
| shabbat-kiddush-day | VERIFIED COMPLETE | true |
| shabbat-mincha | TEXT COMPLETE / CONDITIONS PENDING | true |
| havdalah | VERIFIED COMPLETE | true |
| birkat-hamazon | TEXT COMPLETE / CONDITIONS PENDING (lost captions; the Shavuot line is now read from Torat Emet 357) | true |
| hallel | VERIFIED COMPLETE | true |
| rosh-chodesh-musaf | VERIFIED COMPLETE | true |
| omer | VERIFIED COMPLETE | true |
| festival-amidah | TEXT COMPLETE / CONDITIONS PENDING (engine: Gevurot season line) | true |
| festival-musaf | TEXT COMPLETE / CONDITIONS PENDING (engine, ותערב; the "נעשה ונקריב" gap filled 2026-09-29) | true |

The final QA pass (2026-09-28) is logged service by service in `docs/siddur/review-sefard.md`; that log supersedes the
older "Doubts" and "Pending" lists below where they differ. What each remaining pending item is and why is kept in the
composition's `conditionsPending`.

"Reviewed" means that I checked each section's boundaries (its first and last paragraph) and the order against the edition. I also read the long paragraphs in full to catch mixed content. The services left unreviewed have the same anchor checks, but they carry open questions of custom or condition, or I did not read their full text paragraph by paragraph.

## Methods used across the whole composition

- **Edition headings.** The edition prints a bold one-word heading above each blessing ("אבות", "בינה", "דין", "צדיקים", "קבלת תפלה", "עבודה", "הודאה", "שלום", and others such as "על הניסים", "קדיש שלם", "חצי קדיש:", "ק"ש וברכותיה", "סדר הלל"). The reader drops such a heading only when it is the section's first paragraph and matches the section title exactly. Otherwise it renders the heading as a line of prayer text. Where my title differs (ברכת אבות, חונן הדעת, השבת המשפט, על הצדיקים, שומע תפילה, רצה, מודים, שים שלום, קדיש תתקבל…), the heading paragraph is omitted with the reason "the edition's own heading… the section carries its reviewed title" (`heading()` helper). Where the edition's word is itself the proper name (גבורות, תשובה, סליחה, גאולה, רפואה, ברכת השנים, קיבוץ גליות, ברכת המינים, בנין ירושלים, מלכות בית דוד, קדושה, קדושת השם, מודים דרבנן, כתר, שיר של יום, קדיש יתום, בית יעקב, ברכי נפשי…), I use it as the title and the heading is dropped by the reader.
- **Directions that repeat a label.** Two direction paragraphs were omitted because the section's labels already say the same thing: "בחזרת הש"ץ אומרים כאן קדושה" (the role label says בחזרת שליח הציבור) and, at Mincha, "בתענית ציבור אומר כאן הש"ץ ברכת כהנים" (the condition and role labels). Both are in the weekday Amidot.
- **Birkat Kohanim printed once.** The Shabbat (Shacharit, Musaf), Rosh Chodesh Musaf and festival Amidot print only the caption "ברכת כהנים". The chazzan's words are taken from the edition's weekday Shacharit Amidah (`reusedBirkatKohanim`), and the rest of that leaf is omitted as "only its Birkat Kohanim is used". The festival Musaf uses the edition's own "סדר ברכת כהנים" (Priestly Blessing leaf) instead, because that is the Kohanim's duchening.
- **Reused Kaddish (rewind).** The weekday Torah Reading leaf prints no half Kaddish after the reading, so the half Kaddish of the "For Monday & Thursday" leaf is repeated. The Shabbat order prints no half Kaddish before Maftir, so the Shabbat half Kaddish (Av HaRachamim leaf ¶12–14) is repeated. The weekday Ashrei leaf's Kaddish is shown as a half Kaddish on Chol HaMoed, per the edition's note ¶16. The Rosh Chodesh Hallel Kaddish is shown as a half Kaddish on Chanukah, per ¶28/¶31.

## Weekday Shacharit (reviewed: false)

Leaves: Upon Arising (Modeh Ani, Tallit, Tefilin, Introductory Prayers, Upon Entering Synagogue), Weekday Shacharit (all leaves except Barchi Nafshi), Rosh Chodesh (Hallel, Song of the Day, Barchi Nafshi, Torah Reading, Ashrei Uva L'Tziyon, Returning Sefer Torah), Torah Readings (Fast Day, Rosh Chodesh), Weekday Mincha Amidah (only the chazzan's Aneinu).

Order: the edition's tree. Upon Arising → Morning Blessings → Torah blessings, then Birkot HaShachar → Akeda → Korbanot → Braita and Kaddish DeRabbanan → Hodu … Az Yashir → Yishtabach → half Kaddish → Barchu … Emet VeYatziv → Amidah → [Hallel with its Kaddish] → [Rosh Chodesh: Song of the Day and Barchi Nafshi with Kaddish Yatom] → Avinu Malkeinu → Vidui and the 13 Attributes → Nefilat Apayim → Vehu Rachum (Mon/Thu) → Shomer Yisrael → half Kaddish (`!hallel`) → Torah reading → Ashrei, Lamenatzeach, Uva LeTziyon → Kaddish Titkabal → Tefila LeDavid and Beit Yaakov → Song of the Day (day0…day5, then Hoshienu) → Kaddish Yatom → LeDavid (Elul) → mourner's-house psalms → Kaveh, Ein Keloheinu, Pitum HaKetoret, Tanna DeVei Eliyahu → Kaddish DeRabbanan → Aleinu → Kaddish Yatom.

Rosh Chodesh follows the edition's own Rosh Chodesh order: Hallel → Kaddish Shalem → Song of the Day → Barchi Nafshi → Torah reading → Ashrei and Uva LeTziyon → Beit Yaakov → the Torah returned → half Kaddish, then the separate "rosh-chodesh-musaf" service. On Rosh Chodesh and Chol HaMoed the weekday closing is hidden (`!roshChodesh&!cholHamoed`), because in the edition it follows Musaf.

Doubts (why the service is not marked reviewed):
1. **Where the Torah is returned on Monday and Thursday.** The edition prints Yehallelu and the return in the Ashrei leaf after Kaddish Titkabal (¶23–29). I placed it after the reading and Yehi Ratzon, before Ashrei, as the weekday order usually runs. On Chol HaMoed the Chassidic custom may be to return it after Uva LeTziyon, as the edition does on Rosh Chodesh.
2. **Tallit and tefillin before the morning blessings.** I followed the edition's tree ("Upon Arising": Modeh Ani, Tallit, Tefilin…). Many Sefard siddurim put the morning blessings first.
3. **Barchi Nafshi.** The weekday Barchi Nafshi leaf is not used; the Rosh Chodesh leaf (after the Song of the Day, before the reading) is used instead.
4. **"בבית האבל" psalms.** Lamenatzeach Livnei Korach on Tachanun days and Michtam LeDavid on other days show every day with role `optional`. There is no condition key for a house of mourning.
5. **Chanukah reading.** The Chanukah Torah reading (Chanukah, Torah Reading leaf, a reading for each day) and the Monday/Thursday parasha are not included: there is no key for the day of Chanukah or for the parasha. The fast-day reading (Vayechal) is included when `fast&!tishaBav`.
6. **Selichot on fast days.** The note at Tachanun ¶0 says "on a public fast Selichot are said". The edition's Selichot are per fast, and there is no key for which fast it is, so none are included.
7. **Tisha B'Av Shacharit** (no tallit or tefillin, Kinot, a different reading) is not composed.
8. **Unknown caption.** "ובימים שאין בהם תחנון אומרים זה:" (L'David ¶6) is handled here as a section with `!tachanun`.
9. **Conditions pending.** Lamenatzeach, Kel Erech Apayim and Beit Yaakov are skipped on Erev Pesach, Erev Yom Kippur and Purim Katan, but there are no keys for those days. The condition used is `!roshChodesh&!chanukah&!purim&!tishaBav`. Mizmor LeToda is skipped on Erev Pesach, Chol HaMoed Pesach and Erev Yom Kippur; that note is inside the text.

## Weekday Mincha (reviewed, VERIFIED COMPLETE)

Leaves: Weekday Mincha (Korbanot, Torah Reading for Fast Day, Amidah, Tachanun, Avinu Malkeinu), Torah Readings (Fast Day Torah Reading, Fast Day Mincha Haftara).

Order: Tamid → Ketoret → Ana BeKoach → Ashrei → [fast day: the edition's direction, the Vayechal reading and the Haftarah] → half Kaddish → Amidah → Avinu Malkeinu → Vidui and the 13 Attributes → Nefilat Apayim → Shomer Yisrael and VaAnachnu → Kaddish Titkabal → Aleinu → Kaddish Yatom → LeDavid (Elul) → mourner's-house Lamenatzeach.

On a fast day the half Kaddish comes after the reading, following the edition's direction in "Torah Reading for Fast Day" ¶1 ("ואין אומרים קדיש אחר הקריאה ומכניסין הס"ת להיכל ואומרים חצי קדיש ומתפללים").

Amidah: Aneinu (repetition, `fast`), Nachem (`tishaBav`; the edition's "(את צמח וגו')" is kept inside it), Yaale VeYavo, Modim DeRabbanan, Al HaNisim, Birkat Kohanim (`fast`, repetition), Sim Shalom (this rite says it at Mincha too; the edition has no Shalom Rav).

LeDavid: the edition's note (¶32) calls it "a good custom after every prayer, especially from Rosh Chodesh Elul to Hoshana Rabba". I condition it on `ledavid`.

## Weekday Maariv (reviewed, conditions pending)

Leaves: Weekday Maariv (The Shema, Amidah, Motzaei Shabbat, Sefirat HaOmer), Third Meal / Motzaei Shabbat Prayers (Vayiten Lecha).

Order: Vehu Rachum → Barchu → HaMaariv Aravim → Ahavat Olam → Shema → Emet VeEmuna → Hashkiveinu → Baruch Hashem LeOlam → half Kaddish → Amidah (Atah Chonantanu `motzaeiShabbat`) → Kaddish Titkabal (`!motzaeiShabbat`) / [Motzaei Shabbat: half Kaddish, Vihi No'am, VeAtah Kadosh, Kaddish Titkabal] → Omer (`omer`) → Shir LaMa'alot and Kaddish Yatom (`israel`, optional, per the edition's ¶103) → Barchu → Aleinu → Kaddish Yatom → Vayiten Lecha (`motzaeiShabbat`, "after Maariv of Motzaei Shabbat").

The Motzaei Shabbat leaf prints Aleinu and Kaddish a second time (¶17–24). I omitted that copy as a duplicate printing.

Pending: Vihi No'am and VeAtah Kadosh are skipped when a festival falls in the coming week, and there is no key for that. The Omer lists all 49 days in a row; there is no key for today's day.

## Bedtime Shema (reviewed)

Text gap (filled 2026-09-29 from the Torat Emet 357 version of the same leaf, ¶6–7, as "יש אומרים"): the edition's own note (¶2) says that some must say both paragraphs (Shema and Vehaya Im Shamoa, or all three), but the Metsudah leaf prints only Shema and VeAhavta (¶4–7). Originally: nothing was borrowed to fill the gap.

## Kabbalat Shabbat and Friday Maariv (reviewed)

- Lechu Neranena … (¶0–4) and the middle verses of Lecha Dodi (¶22–32) are hidden on Shabbat Chol HaMoed (`!cholHamoed`), following the edition's own directions (¶5, ¶22). Yom Tov is outside these services.
- Kegavna is hidden on Shabbat Chol HaMoed (¶0). I used concept `kabbalat-shabbat`; there is no Kegavna concept.
- Omitted as festival-only: "וידבר משה" (Shema & Blessings ¶16–17) and the pointer to the festival Amidah (¶21).
- Omer: after the second Barchu, following the edition's direction (Vayechulu ¶15), taken from the weekday Omer leaf.
- Suspicious: Shema & Blessings ¶13, the Shabbat Hashkiveinu, contains the weekday words "ושמר צאתנו ובואנו לחיים טובים ולשלום מעתה ועד עולם" and "ופרוש עלינו סכת שלומך" twice before the Shabbat ending "הפורש סכת שלום". I did not change them.

## Friday night Kiddush (not reviewed)

Order: Birkat HaBanim → Shalom Aleichem → Ribon Kol HaOlamim → Eshet Chayil → Atkinu → Azamer BiShvachin → Kiddush → LeShev BaSukka (`sukkot`). Birkat HaBanim has no concept of its own, so it uses `shalom-aleichem`.

## Shabbat Shacharit (not reviewed)

The edition says "pray as on a weekday until Hodu". The service starts at the Shabbat Hodu, and the morning blessings and Korbanot are not repeated here.

Order: Pesukei DeZimra → Nishmat and Yishtabach → Barchu … Emet VeYatziv → Amidah (Yismach Moshe) → [Rosh Chodesh: Hallel] → Kaddish Titkabal → Song of the Day and Kaddish → [Rosh Chodesh: Barchi Nafshi and Kaddish] → [Elul: LeDavid and Kaddish] → the Torah service. On Shabbat the Song of the Day comes right after Shacharit, as the edition prints it (Chassidic custom).

Omitted:
- Shabbat Torah Reading ¶5–15: the 13 Attributes, their Ribbono shel Olam and the Ten Days' additions, printed for festivals falling on a weekday, Rosh Hashana, Yom Kippur and Hoshana Rabba. **Doubt:** ¶11–15 is headed "ביום ב' של ר"ה ובעשרת ימי תשובה". I treat it as part of the 13-Attributes rite, which is not said on Shabbat.
- Haftarah Blessings ¶15–18: the Rosh Hashana and Yom Kippur endings.
- The weekday Kaddish after Hallel.
- Av HaRachamim ¶8–9: the festival-on-a-weekday psalm.

Pending (no keys): Birkat HaChodesh, Mi Sheberach for BaHaB, and Av HaRachamim / Hazkarat Neshamot (not said on Shabbatot on which Tachanun would not be said).

The reading texts (the parasha and the Haftarah) are not part of this edition's Shabbat order.

## Shabbat Musaf (not reviewed)

Keter (repetition), then Atah Yatzarta (`roshChodesh`) or Tikanta Shabbat (`!roshChodesh`). After the Amidah come Kaddish Titkabal, Kaveh, Ein Keloheinu, Pitum HaKetoret and HaShir Shehalviyim, Tanna DeVei Eliyahu, Kaddish DeRabbanan, Barchu, Aleinu, Kaddish Yatom, Shir HaYichud, Shir HaKavod, Kaddish Yatom, Adon Olam and Lechem HaPanim (optional).

## Shabbat day Kiddush (not reviewed)

The service is: Asader LiSeudata, Chai Hashem, then Kiddusha Rabba (Mizmor LeDavid, Im Tashiv, VeShamru, Zachor, and the blessing). "לישב בסוכה" is shown when `sukkot`.

## Shabbat Mincha (not reviewed)

Order: Korbanot → Ashrei → Uva LeTziyon → half Kaddish → VaAni Tefilati → the Torah service → the reading's blessings → Baruch Shepatrani → Hagbaha → Psalms 111–112 → the Torah returned → half Kaddish → Amidah (Atah Echad) → Tzidkatcha → Kaddish Titkabal → Aleinu → Kaddish Yatom → LeDavid → Barchi Nafshi and the Songs of Ascents → Pirkei Avot.

Doubts:
- Psalms 111–112 (Korbanot ¶41–42) come after Hagbaha, before "ומחזירין". I placed them with the return of the Torah.
- The season's texts carry no condition: Barchi Nafshi and the Songs of Ascents are said from Sukkot to Shabbat HaGadol, and Pirkei Avot, one chapter a week, from Pesach to Rosh Hashana. There are no season or chapter keys.
- Tzidkatcha is not said on Shabbatot on which Tachanun would not be said, but there is no key for that.
- Suspicious: Shabbat Mincha, Korbanot ¶10 "אומר ג' פעמים:" is followed directly by Ana BeKoach (¶11). The verses it introduces (ה' צבאות עמנו…) are missing from this leaf.

## Havdalah (reviewed)

Havdala, then HaMavdil (optional). "Gott fun Avraham" (Third Meal) is not included; it is a Motzaei Shabbat supplication, not Havdalah.

## Birkat HaMazon (not reviewed)

The edition's leaf has lost all its small-print captions: about 40 empty paragraphs, for example ¶0, 2, 4–7, 9, 11, 15, 17, 19, 21–22, 24, 26, 28, 31, 33, 39, 41, 43, 48, 50, 54, 58, 60, 71, 73, 76, 91–92, 94, 96–98, 100, 102, 104. I cut the alternatives into sections instead:
- Al Naharot Bavel (`tachanun`) or Shir HaMa'alot (`!tachanun`)
- the Zimun, and the wedding Zimun (optional)
- Al HaNisim (`chanukah|purim`)
- Retze (`shabbat`)
- Yaale VeYavo (`roshChodesh|cholHamoed|yomTov|roshHashana`)
- the blessings for someone who forgot Retze or Yaale VeYavo (optional; the title is inferred from their words, since the captions are lost).

## Hallel (reviewed, conditions pending) and Rosh Chodesh Musaf (not reviewed)

Hallel uses the Rosh Chodesh leaf. The Kaddish after it is Kaddish Shalem (`!chanukah`), or a half Kaddish on Chanukah, following the edition's ¶28 and ¶31. Rosh Chodesh Musaf: Rosh Chodesh Mussaf leaf. The edition has no LeDavid (Elul) after the Rosh Chodesh Musaf closing.

## The festival Amidah and festival Musaf (not reviewed)

- **Festival Amidah.** This one service is shared by Maariv, Shacharit and Mincha. It opens with "וידבר משה" and a half Kaddish (Maariv only), and ends with Kaddish, the note ¶58, Aleinu and Kaddish Yatom. There is no key for the prayer type, so the Maariv-only part and the Kedusha (Shacharit and Mincha only) are left to the captions inside the text. The caption "לערבית ולשחרית:" is unknown to the engine.
- **Festival Musaf.** Keter for the festival or for a weekday of Chol HaMoed (`!cholHamoed|shabbat` / `cholHamoed&!shabbat`). The day's offerings are split by the rubricConditions keys `pesach`, `shavuot`, `sukkot`, `hoshanaRabbah` and `sheminiAtzeret`; none of these has a label in WHEN_LABELS. The last days of Pesach cannot be told apart from the first days, so on the last days the first days' verses show. Ve'Te'erav is marked repetition. Birkat Kohanim comes from the Kohanim's order.

## Concepts and condition keys the schema or composer lacks

- **Concepts.**
  - `birkat-habanim` (used `shalom-aleichem`)
  - `kegavna` (used `kabbalat-shabbat`)
  - `yekum-purkan` / `mi-sheberach` (used `torah-service`)
  - `mourners-psalms` (used `closing-passages`)
  - `vayiten-lecha` (used `motzaei-shabbat`)
  - `selichot` and `hoshanot` (not composed)
  - `vayedaber-moshe` (used `shema-blessings`)
- **Keys to add to WHEN_LABELS.** These keys exist in `compositionConditions` but have no label, so the full-edition mode shows no condition label for them: `shabbat`, `yomTov`, `roshHashana`, `pesach`, `shavuot`, `sukkot`, `sheminiAtzeret`, `hoshanaRabbah`. The same applies to compound expressions such as `!roshChodesh&!chanukah&!purim&!tishaBav` and `!roshChodesh&!cholHamoed&…`.
- **Missing keys.**
  - `erevPesach`, `erevYomKippur`, `purimKatan`: Lamenatzeach, Kel Erech Apayim, Beit Yaakov, Mizmor LeToda
  - `houseOfMourning`
  - `shabbatMevarchim` and `bahab`
  - `avHarachamim`: a Shabbat on which Tachanun would be omitted
  - `festivalNextWeek`: Vihi No'am
  - `omerDay` and `chanukahDay`: the Omer count and the Chanukah reading
  - `parasha`
  - `winterShabbatMincha` / `pirkeiAvotChapter`
  - `prayerType` as a when-key, for the shared festival Amidah
  - `specificFast`: Selichot
  - `firstDaysPesach` versus `lastDaysPesach`
  - `sukkotDayNumber`

## Final QA pass (2026-09-28) — what changed

- **Omer**: `perDay: dayBlocks('omerDay', …)` — tonight's paragraph only (date, count, sefira); the edition keeps the 49.
- **Hallel**: whole/half by the edition's own caption (לא לנו and אהבתי skipped on Rosh Chodesh, Chol HaMoed Pesach and
  the last days of Pesach; Rosh Chodesh Tevet whole); ואברהם זקן · זבדיה only on Rosh Chodesh; Hallel also on Shabbat
  Chanukah and Shabbat Chol HaMoed; Kaddish Titkabal after Hallel on Rosh Chodesh Tevet.
- **Weekday Shacharit**: Erev Pesach / Erev Yom Kippur keys for Lamenatzeach, Kel Erech Apayim, Beit Yaakov and Mizmor
  LeToda; Lamenatzeach not on Chol HaMoed; Ta'anit Bechorot no longer treated as a public fast (`FAST`, `TORAH_DAYS`);
  Chanukah reading of the day, Chol HaMoed Sukkot reading (Eretz Yisrael by day, diaspora table), Chol HaMoed Pesach
  reading by date.
- **Weekday Maariv**: Atah Chonantanu also on Motzaei Yom Tov.
- **Shabbat Shacharit**: Birkat HaChodesh `shabbatMevarchim&!roshChodesh`; Av HaRachamim and Hazkarat Neshamot by the
  edition's rule (`AV_HARACHAMIM`).
- **Shabbat Mincha**: the verses "אומר ג' פעמים" shown from the weekday Mincha leaf; Barchi Nafshi / Pirkei Avot by season.
- **Birkat HaMazon**: Al HaNisim split Chanukah / Purim; Ya'aleh VeYavo day lines split (the engine showed Shemini
  Atzeret and Rosh Hashana lines every day); the three הרחמן alternatives as alternatives, guest before אותנו.
- **Kabbalat Shabbat**: Psalm 29 was hidden every Friday by the caption "ביום טוב … מתחילים כאן" — fixed.
- **Rosh Chodesh Musaf**: כי שם was hidden by the pointer "אם חל בשבת ראה" — fixed; LeDavid after Musaf in Elul.
- **Festival Amidah**: prayer-of-the-hour sections (Vayedaber, half Kaddish, Kedusha, Birkat Kohanim, Modim DeRabbanan,
  Kaddish, Aleinu); one line per festival name; Veshamru / Vayechulu / Magen Avot on Shabbat.
- **Festival Musaf**: offerings by `pesachFirstDays`, `cholHamoedPesach|pesachLastDays`, `sukkotFirstDays`, the day of
  Chol HaMoed Sukkot (Eretz Yisrael) and ספיקא דיומא (diaspora), Hoshana Rabba, Shemini Atzeret; Keter of Hoshana Rabba;
  Kohanim (Eretz Yisrael daily, diaspora on Yom Tov) or the chazzan's words; LeDavid through Hoshana Rabba.
