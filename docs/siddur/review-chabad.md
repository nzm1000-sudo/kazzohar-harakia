# Final Siddur QA — Nusach Chabad (review log)

Reviewer for `chabad` (Nusach HaAri as printed in Chabad siddurim). Brief: `docs/siddur/final-qa-brief.md`. Files
changed: `src/data/nusach/compositions/chabad.mjs`, `docs/siddur/notes-chabad.md`, this log,
`tests/siddurFinal-chabad.test.mjs`. Date: 2026-09-28.

Editions: **Siddur Torah Or** (Sefaria "Weekday Siddur Chabad") for the weekday services, Birkat HaMazon, Hallel, the
weekday Rosh Chodesh Musaf and the Omer; **Siddur Tehillat Hashem** (Open Siddur transcription) for Shabbat, Havdalah
and Yom Tov. No word typed in, nothing taken from another rite. A full re-audit: every service was composed and read,
none was assumed right because it was VERIFIED.

## Status before → after

| Service | Before | After | Why |
|---|---|---|---|
| weekday-shacharit | VERIFIED | VERIFIED (reopened, fixed) | Tisha B'Av: Tachanun, Avinu Malkeinu, the morning Priestly Blessing and "תתקבל" were shown |
| weekday-mincha | VERIFIED | CONDITIONS PENDING (reopened) | Tachanun on Tisha B'Av and at Mincha of Erev Shabbat / Erev Yom Tov / Erev Chanukah fixed; Nachem double chatima is text-level (pending) |
| weekday-maariv | VERIFIED | CONDITIONS PENDING (reopened) | Atah Chonantanu now `motzaeiShabbat\|motzaeiYomTov`, but its caption still hides it on Motzaei Yom Tov (engine) |
| bedtime-shema | VERIFIED | VERIFIED | spot-checked |
| kabbalat-shabbat | VERIFIED | VERIFIED | read |
| shabbat-maariv | VERIFIED | VERIFIED (reopened, fixed) | Magen Avot "המלך" was shown every week; the Omer now shows tonight's line |
| shabbat-kiddush | VERIFIED | VERIFIED | read |
| shabbat-shacharit | CONDITIONS PENDING | **SOURCE GAP** | Kedusha fixed, Hallel added, Av HaRachamim decided; הכל יודוך … מי דומה לך is missing from the edition |
| shabbat-musaf | VERIFIED | VERIFIED (reopened, fixed) | Kedusha was the weekday נקדישך; now כתר |
| shabbat-kiddush-day | VERIFIED | VERIFIED | read |
| shabbat-mincha | CONDITIONS PENDING | CONDITIONS PENDING | Tzidkatcha decided by `tachanunIfWeekday`; Chabad's own Tachanun calendar still needs an engine key |
| havdalah | VERIFIED | VERIFIED | read |
| birkat-hamazon | VERIFIED | VERIFIED | Chanukah, Rosh Chodesh read |
| hallel | VERIFIED | VERIFIED | full / half checked |
| rosh-chodesh-musaf | VERIFIED | VERIFIED | Keter, Al HaNisim on Rosh Chodesh Tevet |
| omer | VERIFIED | VERIFIED (fixed) | now `perDay`: only tonight's line in prayer mode |
| festival-amidah | CONDITIONS PENDING | **VERIFIED** | Kedusha, Birkat Kohanim and closing direction by the prayer of the hour |
| festival-musaf | CONDITIONS PENDING | CONDITIONS PENDING (narrower) | Pesach first/last days, Tal, Sukkot first days, Chol HaMoed Sukkot abroad decided; Israel's Chol HaMoed and Geshem abroad pending |

## Dates printed (prayer mode unless noted; Israel unless noted)

- Ordinary Monday 2026-11-02 (Shacharit, Mincha, Maariv), Friday 2026-10-30 (Mincha), Rosh Chodesh Kislev 2026-11-10/11,
  Chanukah Monday 2026-12-07, Rosh Chodesh Tevet 2026-12-10 (Musaf), Asara BeTevet 2026-12-20, Tisha B'Av 2026-07-23,
  Chol HaMoed Sukkot 2026-09-28/29 (Israel and abroad), Chol HaMoed Pesach 2027-04-25, Motzaei Shabbat + Omer 2027-05-01,
  Motzaei Yom Tov 2027-04-28.
- Shabbat: ordinary 2026-10-17, Mevarchim Cheshvan 2026-10-10, Mevarchim Kislev 2026-11-07, Mevarchim Sivan 2027-06-05,
  Shabbat Rosh Chodesh 2027-01-09, Shabbat Chanukah + Mevarchim 2026-12-05, Shabbat in Nisan 2027-04-10, Shabbat in the
  Omer 2027-05-29, Shabbat Shuva eve 2026-09-18, Friday night in the Omer 2027-05-14.
- Festivals: Sukkot I (Shabbat) 2026-09-26 (Shacharit, Mincha, Maariv, Musaf), Hoshana Rabbah 2026-10-02 (abroad),
  Shemini Atzeret (Shabbat) 2026-10-03, Pesach I 2027-04-22 (Israel and abroad), Pesach II abroad 2027-04-23, Pesach VII
  2027-04-28, Shavuot eve 2027-06-10.
- Omer nights 1, 2, 7, 8, 27, 33, 49 (2027-04-22 … 2027-06-09); edition mode for every service on 2026-11-02.
- A sweep composes all 18 services on 15 of these dates in prayer mode and once in edition mode: no error, no duplicate
  section, every Kaddish whole (half Kaddish to "דאמירן בעלמא", the others to "עשה שלום").

## What was read, service by service

- **Weekday Shacharit.** Read end to end on Monday (structure and every section's first/last words; Amidah, Kedusha,
  Tachanun, Torah service and Kaddishes in full). Order checked against both editions: Tehillat Hashem's weekday leaves
  agree with Torah Or on every point I checked (Hodu → Mizmor Shir → יי מלך → הושיענו → למנצח בנגינות; Vidui → Nefilat
  Apayim → Monday/Thursday Vehu Rachum ending with שומר ישראל → Avinu Malkeinu → Va'anachnu; after Uva LeZion the Kaddish
  Titkabal, *then* Yehalelu — Chabad keeps the Torah on the bimah until after the Kaddish, both editions print it so).
  Rosh Chodesh, Chanukah, Chol HaMoed (both festivals), Tisha B'Av and a fast diffed against the Monday: Hallel,
  Ya'aleh VeYavo, Al HaNisim, the Rosh Chodesh / Chol HaMoed Musaf, Barchi Nafshi, LeDavid, no Tefillin on Chol HaMoed —
  all as the edition's instruction (Hallel ¶25–27) says.
- **Weekday Mincha, Maariv.** Read end to end; seasonal words (משיב הרוח / מוריד הטל, טל ומטר) checked in winter and
  summer; Aneinu, Nachem, Birkat Kohanim on fasts; Motzaei Shabbat (Vihi Noam, Ve'atah Kadosh, Omer after the Kaddish).
- **Shabbat.** Kabbalat Shabbat, Maariv (Magen Avot, Psalm 23, half Kaddish, Barchu), Shacharit (Shabbat psalms,
  Nishmat, El Adon, Amidah, Torah service, Yekum Purkan, Birkat HaChodesh, Av HaRachamim), Musaf (Kedusha, Tikanta /
  Ata Yatzarta, Kaveh … Six Remembrances), Mincha (Torah reading, Amidah, Tzidkatcha, Kaddish). Kiddush, Kiddusha Rabba,
  Havdalah.
- **Festivals.** The festival Amidah at each prayer; the festival Musaf on every kind of day (above).
- **Omer, Hallel, Rosh Chodesh Musaf, Birkat HaMazon.** Read on their days.

## Defects found and fixed

1. **Shabbat Musaf Kedusha was נקדישך** (`shabbat-musaf/kedusha`). Chabad says כתר יתנו לך at every Musaf. The
   transcription prints under Shabbat Musaf (Musaf Amidah ¶24–35) a block that is *identical, paragraph for paragraph,*
   to the weekday Kedusha it prints under Shabbat Shacharit and Shabbat Mincha — a copied template (the same block also
   appears in its weekday Rosh Chodesh Musaf, ¶19). The same edition prints "Kedushah for Shabbat and Festival Days"
   (כתר … ממקומו הוא יפן … שמע ישראל … הן גאלתי אתכם … אני יי אלהיכם) in its festival Musaf (¶18–35); that is now the
   Shabbat Musaf Kedusha, with the printed block and the rest of that leaf omitted with their reasons. Torah Or's
   Rosh Chodesh Musaf also prints כתר, and it is what the weekday Rosh Chodesh Musaf uses.
2. **Shabbat Shacharit Kedusha was the short weekday one** (`shabbat-shacharit/kedusha`). In Nusach HaAri the Shabbat
   and Yom Tov morning Kedusha is the long one (נקדישך … אז בקול רעש גדול … ממקומך מלכנו תופיע …). The same copied block
   stood here (Shemoneh Esrei ¶24–35). Now taken from the same edition's festival Amidah, "Kedushah for Shacharit"
   (¶20–31). Shabbat Mincha keeps the short Kedusha, which is right for Mincha. *Please confirm both Kedushot against a
   printed Tehillat Hashem* — the fix rests on the edition's own festival pages and on standard Chabad practice.
3. **No Hallel on Shabbat Rosh Chodesh / Shabbat Chanukah** (`shabbat-shacharit`). Added from Tehillat Hashem's Hallel
   leaf, scoped `hallel`, after the Amidah and before the Kaddish Shalem (the leaf's ¶64: on Shabbat and Rosh Chodesh the
   full Kaddish follows). Half Hallel skips לא לנו and אהבתי (`fullHallel`), ואברהם זקן on Rosh Chodesh (`optional`). The
   leaf's own Kaddish is omitted (the Shabbat Amidah's Kaddish Shalem follows), and its Hoshanot note (not on Shabbat).
4. **Omer: all 49 days shown every night** (`omer/omer-count`, `weekday-maariv/maariv-omer-count`,
   `shabbat-maariv/omer-count`). Now `perDay: dayBlocks('omerDay', …)` matching each edition's line: Torah Or
   "ט"ז ניסן 1. היום…" (`\s${n}\. היום`), Tehillat Hashem's chart "1 היום…" (`^${n} היום`). Torah Or's direction "יכוין
   לספירה של אותו הלילה…" (¶2) now closes the blessing section, so it is not lost to the filter.
5. **Tisha B'Av** (weekday Shacharit and Mincha). The app's `tachanun` key is true on Tisha B'Av, so Tachanun, the
   Monday/Thursday supplications, El Erech Apayim, Lamenatzeach, Tefila LeDavid, the morning Yehi Ratzon passages and
   Avinu Malkeinu were shown. The edition lists Tisha B'Av among the days without Tachanun (Ashrei Uva LeZion ¶1). Now
   `TACHANUN = 'tachanun&!tishaBav'` and Avinu Malkeinu `avinuMalkeinu&!tishaBav`. Also: no chazzan's Priestly Blessing
   at Shacharit (`birkat-kohanim` `!tishaBav`; it is said at Mincha), and the Kaddish after Uva LeZion without "תתקבל"
   (SA OC 559:4) — the edition prints that line as its own paragraph (¶6), now its own section
   (`kaddish-titkabal-line`).
6. **Mincha of Erev Shabbat, Erev Yom Tov, Erev Chanukah showed Tachanun** (`weekday-mincha`). Edition: "גם במנחה ערב
   ראש חדש וערב חנוכה … אין אומרים תחנון"; Kabbalat Shabbat: Friday Mincha "excluding Tachanun". Now
   `MINCHA_TACHANUN = 'tachanun&!tishaBav&!erevShabbat&!erevYomTov&!erevChanukah'`. (Erev Rosh Chodesh needs a key.)
7. **Magen Avot showed "המלך" every Friday night** (`shabbat-maariv`). The Ten Days' word is its own paragraph (¶78);
   it is now `magen-avot-aseret`. In the Ten Days the line reads "האל המלך הקדוש" because the edition's "האל" sits in
   ¶77 — text-level, reported.
8. **Festival Amidah** (`festival-amidah`, conditions pending resolved): Kedusha for Shacharit `shacharit`, for Mincha
   `mincha`, none at Maariv; the chazzan's Birkat Kohanim `shacharit`; the edition's closing directions split into
   AT MAARIV / AT SHACHARIT / AT MINCHA, each with its prayer key.
9. **Festival Musaf** (`festival-musaf`): Pesach first-days verses `pesachFirstDays` (were `pesach&yomTov`, so shown also
   on the 7th/8th day together with the last-days verses), last six days `pesach&!pesachFirstDays`, Sukkot first days
   `sukkotFirstDays`; Tal `pesachFirstDays&!omer` — the first day of Pesach is the only Yom Tov day of Pesach before the
   Omer begins, so this excludes the second day abroad; Chol HaMoed Sukkot abroad: one section over the four paragraphs
   with `perDay: dayBlocks('sukkotDay', …)` (17–20 Tishrei → "first … fourth day of Chol haMoed"), `diaspora`.
10. **Av HaRachamim** (`shabbat-shacharit`): `tachanunIfWeekday&!shabbatMevarchim|tachanunIfWeekday&omer`, exactly the
    edition's ¶167: not on Shabbat Mevarchim except Mevarchim Sivan (the only Mevarchim in the Omer with Tachanun),
    not when Tachanun is omitted for a festive day. Birkat HaChodesh was already `shabbatMevarchim`.
11. **Atah Chonantanu** (`weekday-maariv/atah-chonantanu`): `motzaeiShabbat|motzaeiYomTov` (the caption itself says
    "במוצאי שבת ויום טוב"). See pending: the engine still hides its words on Motzaei Yom Tov.

## Pending, and exactly why

- **shabbat-shacharit — SOURCE GAP.** The transcription has no הכל יודוך · האל הפותח · אין ערוך · אפס בלתך · מי דומה
  לך between יוצר אור (Verses of Praise ¶181) and אל אדון (¶183); searched the whole pack and the raw Open Siddur files.
  Said every Shabbat in Chabad. Nothing borrowed; `sourceGap` declared until the text is imported. Also not printed:
  the Kaddish Yatom after Mizmor Shir Chanukat HaBayit (weekday Shacharit supplies it from Torah Or's Mourner's Kaddish
  leaf; on Shabbat it is not added).
- **Chabad's Tachanun calendar** (Av HaRachamim, Tzidkatcha, and all weekday Tachanun sections). The app's
  `tachanunOmitted` knows Shabbat, Rosh Chodesh, Chanukah, Purim, Nisan, 1–23 Tishrei, 6–7 Sivan. The edition (Ashrei
  Uva LeZion ¶1) also omits: Pesach Sheni, Lag BaOmer, 1–12 Sivan, 15 Av, Erev Rosh HaShanah, Erev Yom Kippur to the end
  of Tishrei, 15 Shevat, 14–15 Adar I; and at Mincha, Erev Rosh Chodesh, Erev Purim (and Katan), Erev Lag BaOmer, Erev
  15 Av, Erev 15 Shevat. On those days the app still shows Tachanun (and on such a Shabbat, Av HaRachamim /
  Tzidkatcha). Engine request 1.
- **weekday-mincha — Nachem.** Torah Or prints "(בתשעה באב אומרים כאן נחם) ברוך אתה יי, בונה ירושלים" inside the
  blessing's paragraph (Amidah ¶22); Nachem (¶23) has its own chatima "מנחם ציון ובונה ירושלים". On Tisha B'Av both
  chatimot show. Engine request 4.
- **weekday-maariv — Atah Chonantanu on Motzaei Yom Tov.** The paragraph opens with the caption "במוצאי שבת ויום טוב
  אומרים:", which `rubricConditions` maps to `motzaeiShabbat` only, so its words are hidden on Motzaei Yom Tov even
  though the section's `when` holds. Engine request 5.
- **festival-musaf — Israel's Chol HaMoed Sukkot and Hoshana Rabbah.** The edition prints only the diaspora paragraphs,
  each with two days' verses (ספק יום). In Eretz Yisrael (one day's verse) no paragraph matches; the whole table stays
  with its captions (`korbanot-sukkot-chm-il`, `israel`), and on Hoshana Rabbah the "וביום הששי … וביום השביעי"
  paragraph shows. Needs either a text import or a text-level cut.
- **festival-musaf — Geshem abroad.** `sheminiAtzeret` holds on 22 and 23 Tishrei abroad; Geshem is 22 only. Engine
  request 3. Decided in Israel.
- **Text-level (not composition) defects, reported:**
  - Birkat HaShanim in winter (Torah Or, all three Amidot ¶17/¶33): "וְתֵן <small>בקיץ</small> בְּרָכָה (<small>בחורף</small>
    טַל וּמָטָר לִבְרָכָה)" — in winter the reader shows "ותן [בקיץ] ברכה (טל ומטר לברכה)"; the word "ברכה" should go.
    The unbracketed mid-sentence caption is kept "as printed" by `conditionalMarkup`. Engine request 2.
  - Tehillat Hashem's inline English alternatives ("( During the Ten Days of Penitence substitute - המלך הקדוש:) האל
    הקדוש", "( On Shabbat add : שבתות למנוחה ו)") show both wordings every day (notes-chabad, engine observation 4).
    Engine request 6.
  - Tehillat Hashem Shabbat Sim Shalom (Shabbat Maariv ¶54, Shacharit ¶82, Musaf, Mincha): "כלנו כאחד באור פניך נתת
    לנו" without "כי באור פניך", and "וטו בעיניך". The festival leaves print it correctly (FMU ¶139). Not repaired (the
    packs are never changed); for the text-correction owner.
  - Weekday Rosh Chodesh Musaf (Torah Or ¶12) has no "ולכפרת פשע" for a leap year.

## Engine requests (for the engine owner; nothing was changed outside my files)

1. **Chabad Tachanun calendar**: a rite-aware `tachanun` (or `tachanunChabad`) with the edition's list above, including
   the Mincha-only eves; and `tachanun` false on Tisha B'Av for every rite (today the composition guards it locally with
   `!tishaBav`, and Mincha with `!erevShabbat&!erevYomTov&!erevChanukah`).
2. **Either/or captions inside a sentence**: "X <small>בקיץ</small> A (<small>בחורף</small> B) Y" → summer "X A Y",
   winter "X B Y".
3. **`sheminiAtzeretFirstDay`** (22 Tishrei only; abroad 23 is Simchat Torah) — for Geshem; a `pesachFirstDay` (15 Nisan)
   would also replace the `pesachFirstDays&!omer` device for Tal.
4. **Nachem**: on Tisha B'Av, hide the ordinary chatima that follows "(בתשעה באב אומרים כאן נחם)" in the same paragraph.
5. **Caption "במוצאי שבת ויום טוב"** → `motzaeiShabbat || motzaeiYomTov` (rubricConditions lines 78, 112).
6. **Tehillat Hashem inline English alternatives**: "( During the Ten Days of Penitence substitute - X) Y" → aseret ? X : Y;
   "( On Shabbat add : X)" → shabbat ? X : nothing; "( During Festivals add - X)".
7. **A key for "a Yom Tov falls in the coming week"** (Vihi Noam and Ve'atah Kadosh are not said on such a Motzaei
   Shabbat); today they are shown every Motzaei Shabbat.

## Open Siddur / other sources consulted, and disagreements

- The two licensed editions themselves, cross-checked against each other: Tehillat Hashem's weekday leaves (Shacharit
  Tachanun, Torah reading, Maariv, Mincha Amidah, Hallel, Rosh Chodesh Musaf) against Torah Or; Torah Or's Chabad
  Tachanun calendar (Ashrei Uva LeZion ¶1); the raw Open Siddur files under `sources/opensiddur-chabad/`.
- A web search (Open Siddur PDFs of the Chabad Weekday Shacharit and Kabbalat Shabbat came up) did not give the
  printed Shabbat pages; no text was copied.
- Disagreements recorded:
  - *Transcription (template copy)*: the weekday Kedusha printed under Shabbat Shacharit, Shabbat Musaf, and Rosh Chodesh
    Musaf in Tehillat Hashem (fixed by selection for Shabbat; weekday Rosh Chodesh Musaf uses Torah Or).
  - *Transcription (omission)*: הכל יודוך … מי דומה לך missing from Shabbat Yotzer.
  - *Transcription (typos)*: Shabbat Sim Shalom (above); Tehillat Hashem weekday Mincha ¶83 "ותשכון כאשר דברת" without
    "בתוכה"; Musaf for Festivals ¶73 "ולראות ולראות"; ¶108 a stray "וביום הרביעי" line after "וביום הששי"; Yehalelu "לכ
    חסידיו"; Torah reading "חרגל".
  - *Edition difference*: Tehillat Hashem's Chol HaMoed Sukkot Musaf prints the diaspora double verses only.
  - *Minhag*: Chabad's Tachanun calendar (above); Tefillin not worn on Chol HaMoed (kept).

## Summary

Eighteen services re-read. Five VERIFIED services reopened and fixed (weekday Shacharit, weekday Mincha, weekday Maariv,
Shabbat Maariv, Shabbat Musaf — the Musaf Kedusha was the weekday נקדישך instead of כתר), plus the Omer. The four
CONDITIONS PENDING services resolved as far as the day keys allow: the festival Amidah is VERIFIED; the festival Musaf
keeps only Israel's Chol HaMoed table and Geshem abroad pending; Shabbat Mincha keeps only Chabad's Tachanun calendar;
Shabbat Shacharit gained the long Kedusha, Hallel on Shabbat Rosh Chodesh / Chanukah and Av HaRachamim, but is now
honestly a SOURCE GAP (הכל יודוך missing in the edition). Levels: 13 VERIFIED, 4 CONDITIONS PENDING, 1 SOURCE GAP.
Tests: `tests/siddurFinal-chabad.test.mjs`, 11 tests.

## Source audit — completeness and mapping of the two open editions (2026-09-29)

Scope: are the open Chabad sources in the app complete and correctly mapped? No prayer word was changed. Regression
tests: `tests/chabadSources.test.mjs` (8 tests).

**Siddur Tehillat Hashem (Open Siddur, Shmuel Gonzales; CC0 Hebrew / CC BY instructions).**
- *Archive.* The 18 files in `sources/opensiddur-chabad/` match the SHA-256 table in its README. Each is also the
  **latest** Wayback capture of its URL: every capture listed in the Wayback CDX index for `opensiddur.org/wp-content/uploads/2010/08/` was
  checked, and the newest one was downloaded again and was byte-identical.
- *Build.* `scripts/build-chabad-tehillat-hashem.mjs` rebuilt from the archive gives the committed pack byte for byte.
- *Nothing dropped.* Each ✶ heading became a leaf: 72 leaves, 3,851 paragraphs, and no empty leaf. For each of the 18
  files, the Hebrew words of the body (first ✶ up to the licence line) were compared as a multiset with the pack's
  leaves (titles + paragraphs). There is no lost or added word except the documented heading corrections (import doc
  §3). The only reordering is the one the importer is designed to make: the Ana Bekoach acronyms are paired with their
  lines. All 247 `<ref>` footnotes are in the pack as notes. The English instructions were compared word by word too,
  and nothing is lost. The only thing after each file's licence line is wiki furniture (`----`, `<references/>`).
- *Licence.* All 18 files end with the same statement: transcription CC0, instructions "Creative Commons By
  Attribution", credit "Contributors to the Open Siddur Project" with Shmuel/Shmueli Gonzales. The Bedtime Shema file
  says "except where noted", but nothing in it is noted. The post (archived 2024-12-02 copy) states CC BY 4.0. The
  manifest, the pack and every leaf all read `CC0 (Hebrew) / CC BY 4.0 (instructions)`.
- **The Chanukah file: the "not archived" record was wrong.** The post links
  `Ḥanukkah-Blessings-Nusaḥ-Ha-Ari-ḤaBaD.txt`, which the Wayback Machine holds only as a 404. The same file under its
  earlier name, `Ḥanukah-Blessings-Nusaḥ-Ha-Ari-ḤaBaD.txt`, is archived:
  `https://web.archive.org/web/20150507155325id_/http://opensiddur.org/wp-content/uploads/2010/08/%E1%B8%A4anukah-Blessings-Nusa%E1%B8%A5-Ha-Ari-%E1%B8%A4aBaD.txt`
  - Size: 4,345 bytes. SHA-256: `d92eb587997ce3045e2a005e5bdcc65e3e4b2337e93c204ef7238b190b53c097`.
  - Version 3.0, December 2011.
  - Contents: one ✶ section with the candle blessings, שהחיינו and הנרות הללו, plus English instructions and
    translations.
  - Licence: the same clear CC0 / CC BY statement as the other files.
  - The ODT and PDF are archived too.

  It is **not imported**. Copying it into `sources/` and updating its README and the import doc are outside this
  review's files. The app also does not need it for content: Siddur Torah Or (CC BY-SA) already has a "Chanukah" leaf
  with the same blessings and הנרות הללו. No service in `prayerSchema.mjs` lights Chanukah candles. **Fixed:** the
  pack's `source.missing` now gives the true reason and the archived URL. Only this metadata changed: the texts and
  schema are identical, checked after the rebuild.
- *Newer versions not imported.* A v3.2 of the Blessing Book was archived as ODT only
  (`The-Blessing-Book-…-3.2.odt`, 2015). Its TXT is a 404. The pack uses the TXT v3.1 (March 2011). This is for
  information: an ODT import would be a new import.

**Siddur Torah Or (Sefaria "Weekday Siddur Chabad", Wikisource).** A fresh dump from the Sefaria API (2026-09-29)
matches the bundled pack exactly: 47 of 47 leaves identical, paragraph for paragraph. There is one version,
"Wikisource", and Sefaria gives its licence as "unknown". The manifest vouches for it as CC BY-SA: he.wikisource
סידור תורה אור, the transcription of the 1940 Schulzinger scan. The Wikisource page and the scan index linked in the
manifest both exist. That page lists 24 sub-pages, including דיני חנוכה.

**Mapping.** All 18 services were resolved and every section was listed with its leaf, its paragraph range and its
first and last words (about 700 sections). Each section points at the right leaf of the edition its service uses.
The mixed-leaf uses are deliberate and documented:
- the long Kedusha and כתר from the festival leaves;
- the Shabbat Mincha Kaddish Shalem taken from the Musaf leaf;
- the Kaddish Titkabal reused after Hallel and after the Chol HaMoed Musaf.

No section points at the other edition, and none at another rite. No mapping defect was found.

**Reader source line.** `RiteServiceReader` credits each edition whose leaves the composed page uses. This was checked
for all 18 services, in edition mode and in prayer mode on four dates:
- Torah Or services show only the CC BY-SA 3.0 Torah Or line;
- Shabbat, Havdalah and Yom Tov services show only the Tehillat Hashem CC0 / CC BY line.

There is no per-section line: the credit is per page, and no Chabad service mixes the two editions.

**Found, not fixed (outside this review's files):**
1. `manifest.mjs` `extraEditions[0].version` says "v3.3–3.82 (2015)". The files actually run from v3.0 (Prayer for
   Travelers, August 2010) to v3.82 (Morning Blessings, April 2015). It should read "v3.0–3.82 (2010–2015)".
2. `sources/opensiddur-chabad/README.md`, `chabad-tehillat-hashem-import.md` §5.4 and `open-siddur-sources.md` (Chabad
   row and note 3) still say the Chanukah file is unrecoverable. It is archived under the single-k name (above).
3. `SourceReader.jsx` shows `SIDDUR_SOURCES[rite].attribution`, the Torah Or line, for any Chabad reference. If a
   "Siddur Tehillat Hashem, …" leaf is ever opened there, from search, a bookmark or saved progress, it would carry
   the wrong licence line. Today no normal UI path reaches it: the Chabad book tree is Torah Or's schema only. The
   fix is to pick the edition by the reference's index, as `RiteServiceReader` does.
4. Most Tehillat Hashem leaves outside the composed services have no place in the UI. These include Tikkun Chatzot,
   the Blessing Book, Sukkot, Kiddush Levana, the Megillah, the Travelers' Prayer and Yizkor. They are imported but
   not browsable.
