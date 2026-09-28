# Final Siddur QA — Nusach Ashkenaz (review log)

Reviewer: final QA pass, 2026-09-28, following `docs/siddur/final-qa-brief.md` (rite id `ashkenaz`).
Files edited: `src/data/nusach/compositions/ashkenaz.mjs`, `docs/siddur/notes-ashkenaz.md`, this log,
`tests/siddurFinal-ashkenaz.test.mjs`. No engine file was touched; engine items are under **Engine requests**.

How the services were read: `node scripts/print-rite-service.mjs ashkenaz <service> <date> <prayer> <il|diaspora>
<prayer|edition> [--full]`, prayer mode for each date listed and edition mode once per changed service; block types
checked with the composer directly where the printer does not show them (alternatives, notes). `node scripts/siddur-qa.mjs
ashkenaz` after every change (no problem: every anchor found, every paragraph covered or omitted with a reason, spine
in order).

Dates used (5787/5788): Pesach 1 2027-04-22 (Thu), Pesach 2 (diaspora) 04-23, Shabbat Chol HaMoed 04-24, Chol HaMoed
04-26, 7th day 04-28, 8th day (diaspora) 04-29; Sukkot 1 (Shabbat) 2026-09-26, 09-27, Chol HaMoed 09-28 / 10-01,
Hoshana Rabba 10-02, Shemini Atzeret (Shabbat) 10-03, Simchat Torah (diaspora) 10-04; Shavuot 2027-06-11 / 06-12;
Rosh Chodesh 2026-11-10, 2027-11-01 (non-leap), Rosh Chodesh Tevet 2026-12-11, Chanukah 12-06, Shabbat Chanukah /
Mevarchim Tevet 12-05; Erev Pesach 2027-04-21; 10 Tevet 2026-12-20; Tzom Gedaliah 2027-10-04, Ten Days 10-06 and
10-08 (Fri), Erev Yom Kippur 10-10, Erev Rosh Hashana 10-01; Shabbat Shuva 2027-10-09; ordinary Shabbat 2026-10-17;
Shabbat Mevarchim Kislev 11-07, Mevarchim Iyar 2027-05-01, Mevarchim Av 07-31; Omer nights 1/2/7/8/33/49
(2027-04-22/23/28/29, 05-24, 06-09), Motzaei Shabbat in the Omer 05-01, Friday night 04-30; Fridays 2026-10-16.

## Statuses

| Service | Before | After |
|---|---|---|
| weekday-shacharit | CONDITIONS PENDING | CONDITIONS PENDING (engine items only) |
| weekday-mincha | VERIFIED | **reopened** → fixed → VERIFIED |
| weekday-maariv | CONDITIONS PENDING | CONDITIONS PENDING (ויהי נועם only) |
| bedtime-shema | VERIFIED | VERIFIED (not changed) |
| kabbalat-shabbat | VERIFIED | VERIFIED (spot-checked) |
| shabbat-maariv | VERIFIED | **reopened** → fixed → VERIFIED |
| shabbat-kiddush | VERIFIED | VERIFIED (not changed) |
| shabbat-shacharit | CONDITIONS PENDING | CONDITIONS PENDING (Four Parshiyot / Mevarchim Av) |
| shabbat-musaf | CONDITIONS PENDING | CONDITIONS PENDING (engine items; a defect fixed) |
| shabbat-kiddush-day | VERIFIED | VERIFIED (not changed) |
| shabbat-mincha | CONDITIONS PENDING | CONDITIONS PENDING (engine items; a defect fixed) |
| havdalah | VERIFIED | VERIFIED (not changed) |
| birkat-hamazon | VERIFIED | **reopened** → fixed → VERIFIED |
| hallel | CONDITIONS PENDING | **VERIFIED** |
| rosh-chodesh-musaf | CONDITIONS PENDING | CONDITIONS PENDING (leap-year caption, engine) |
| omer | CONDITIONS PENDING | **VERIFIED** |
| festival-amidah | UNVERIFIED | CONDITIONS PENDING (reviewed; Shabbat inline words, engine) |
| festival-musaf | UNVERIFIED | CONDITIONS PENDING (reviewed; engine items) |

## Services

### festival-amidah (UNVERIFIED → CONDITIONS PENDING)
Printed: Maariv 2027-04-21, Shacharit and Mincha 04-22 (IL); Mincha 2026-09-26 (Shabbat Sukkot); Maariv 10-03
diaspora (Simchat Torah on Motzaei Shabbat); Shacharit 2027-06-11 diaspora; edition mode. Read `--full`.
Defects found and fixed:
- `avot`: the edition's first paragraph "למנחה - כי שם ה׳ אקרא" was shown at every prayer → own section `ki-shem`, `mincha`.
- `kedusha-shacharit` / `kedusha-mincha`: both Kedushot were shown at every prayer (and at Maariv, which has no
  repetition) → `shacharit` / `mincha`.
- The chazzan's closing of the Kedusha (לדור ודור … האל הקדוש) is not printed in this leaf → `kedusha-ledor`, from the
  edition's festival Musaf Kedusha (same edition; the rest of that leaf omitted with a reason).
- `modim-derabanan`: not at Maariv → `!maariv`. `birkat-kohanim`: only at Shacharit → `shacharit`.
- The last blessing: the leaf prints only שים שלום; Ashkenaz says שלום רב at Maariv and Mincha (Rema OC 127:2), שים
  שלום at Shacharit and at a Shabbat Mincha (Torah read; the edition's own Shabbat Mincha prints שים שלום) →
  `sim-shalom` `shacharit|mincha&shabbat`, `shalom-rav` (the edition's Friday-night שלום רב) `maariv|mincha&!shabbat`.
Checked: festival names cut by `pesach/shavuot/sukkot/sheminiAtzeret` (Simchat Torah abroad = sheminiAtzeret); the
season follows the prayer (משיב הרוח at Maariv/Shacharit of Pesach 1, מוריד הטל from its Mincha); ותודיענו on
Motzaei Shabbat only; Shabbat lines (השבת הזה, רצה במנוחתנו) by `shabbat`.
Pending: the small-print Shabbat words inside paragraphs ("לשבת שבתות למנוחה ו", "לשבת באהבה", "שבת ו", "השבת ו")
stay on screen as marked alternatives on weekday festivals (engine request E1).

### festival-musaf (UNVERIFIED → CONDITIONS PENDING)
Printed: every day of Pesach (IL and diaspora), every day of Sukkot incl. Hoshana Rabba and Shemini Atzeret/Simchat
Torah, Shavuot, Shabbat Chol HaMoed Pesach; edition mode. Read `--full` on 2026-09-28 IL.
Defects found and fixed:
- Offerings: the first-days Pesach verses (ובחדש הראשון) were shown on the last days too (`pesach&yomTov`) →
  `pesachFirstDays`; והקרבתם → `cholHamoedPesach|pesachLastDays`.
- On the last days of Pesach the day engine read the edition's caption "בחול המועד פסח ובשני ימים אחרונים של פסח
  אומרים זה" as "Chol HaMoed" and hid the verse → caption omitted (with reason), the section keeps the condition.
- ומנחתם ונסכיהם came *before* the offering on Chol HaMoed and the last days (printed once after the Yom Tov verses)
  → `uminchatam` only on the days whose verse precedes it, `uminchatam-after` (same paragraph, rewind) after the others.
  The edition's cross-reference "או"א וכו׳" is omitted (the full paragraph follows).
- Chol HaMoed Sukkot showed all five days: now the per-day table — Land of Israel the day's verse (`sukkotDay`
  dayBlocks), diaspora two verses (ספיקא דיומא, the edition's note ¶40), Hoshana Rabba included.
- Season: Musaf is after the change of season, but the reader computes the season for Shacharit (it passes Shacharit
  for Musaf) — Shemini Atzeret showed מוריד הטל and the first day of Pesach משיב הרוח → `sheminiAtzeret` /
  `!sheminiAtzeret`.
- Birkat Kohanim: the whole edition leaf (ותערב, its two endings, the duchening) was one section after Modim → ותערב
  is inside רצה (`vetearev`, `yomTov|israel`), endings by place (the edition's own labels: "ברוב קהילות ארה״ב" →
  diaspora on Yom Tov; "נוסח הגר״א ומנהג ארץ ישראל" → Israel), the duchening after Modim (`yomTov|israel`), and on
  diaspora Chol HaMoed the chazzan's אלהינו ואלהי אבותינו ברכנו (from the festival Amidah leaf).
Checked: Kedusha נעריצך on Yom Tov / Shabbat Chol HaMoed / Hoshana Rabba, נקדש on weekday Chol HaMoed, אדיר אדירנו
not on Shabbat Chol HaMoed (edition's note); the festival lines; ישמחו on Shabbat.
Pending: (1) ¶35 "…ושעיר לכפר. <small>בשבועות ושני שעירים לכפר</small> ושני תמידים כהלכתם" — on every day but Shavuot
the day engine drops "ושני תמידים כהלכתם" (E2; the composition cannot cut inside a paragraph). (2) small-print
Shabbat words (E1). (3) Tefillat Tal / Geshem not composed (separate leaves with "וכו׳"; needs E6).

### weekday-shacharit (CONDITIONS PENDING → CONDITIONS PENDING)
Printed: ordinary Tuesday, Rosh Chodesh, RC Tevet, Chanukah, Chol HaMoed Pesach (IL) and Sukkot (IL, diaspora),
Erev Pesach, Erev Yom Kippur, Tzom Gedaliah, Ten Days Wed/Fri, Erev Rosh Hashana.
Resolved: מזמור לתודה `!erevPesach&!cholHamoedPesach&!erevYomKippur`; למנצח adds `!erevPesach&!erevYomKippur`;
Hallel's לא לנו / אהבתי now written with the festival keys (the engine's "מדלגין" bug is fixed; the engine's
full/half keys are wrong on some days, E3); the embedded Chol HaMoed Musaf gets the festival-Musaf fixes.
Defects fixed: Erev Pesach was treated as a public fast (עננו in the repetition, a Torah reading) — `PUBLIC_FAST`,
`TORAH_READING` (E4); in the Ten Days Tachanun and Avinu Malkeinu were hidden (engine rule "no Tachanun 1–23 Tishrei",
E5) — `TACHANUN`, `AVINU_MALKEINU`; Tachanun on Erev Rosh Hashana → `!erevYomTov`.
Pending: leap-year line in the embedded RC Musaf (E7); the festival Musaf engine items.

### weekday-mincha (VERIFIED → reopened → VERIFIED)
Defects: Erev Pesach Mincha showed עננו ×2, Birkat Kohanim and שים שלום (fast of the firstborn read as a public fast)
→ `PUBLIC_FAST` / `NOT_PUBLIC_FAST`; Ten Days: Tachanun and Avinu Malkeinu hidden → `TACHANUN_MINCHA`,
`AVINU_MALKEINU_MINCHA`; Tachanun shown at Mincha of every Friday, Erev Yom Tov (Erev Shavuot) and Erev Chanukah →
`!erevShabbat&!erevChanukah&!erevYomTov`. Re-read on 10 Tevet (all fast parts present), Erev Pesach, a Friday.

### weekday-maariv (CONDITIONS PENDING → CONDITIONS PENDING)
Resolved: אתה חוננתנו `motzaeiShabbat|motzaeiYomTov` (checked: night of 16 Nisan IL, 23 Nisan diaspora); the Omer cut
into opening / today's count (`omerDay` dayBlocks) / closing, twice (Motzaei Shabbat after ויהי-נועם's half Kaddish,
other nights after Kaddish Titkabal). Read `--full` on Motzaei Shabbat 2027-05-01: order, Kaddish complete.
Pending: ויהי נועם / ואתה קדוש when a Yom Tov falls in the coming week (no key, E8).

### shabbat-maariv (VERIFIED → reopened → VERIFIED)
Defect: the Shabbat Omer leaf prints the count as "היום [...]" — a placeholder was shown as prayer. Now the night's
line from the edition's weekday table (omitted placeholder and the weekday opening/closing, with reasons). Checked
Friday 2027-04-30 (day 9), edition shows all 49.

### shabbat-shacharit (CONDITIONS PENDING → CONDITIONS PENDING)
Resolved: ברכת החודש was already `shabbatMevarchim` (pending note removed); שוכן עד is now right (engine knows "ינגן");
Hallel as above; אב הרחמים by the edition's own rule (its ¶0): `tachanunIfWeekday&!shabbatMevarchim |
shabbatMevarchim&omer | shabbatShuva` (checked: ordinary, Mevarchim Kislev — no, Mevarchim Iyar — yes, Chanukah — no,
Shabbat Shuva — yes).
Pending: the Four Parshiyot (no key) and Mevarchim Av (said per the edition; no month key — hidden today), E9.

### shabbat-musaf (CONDITIONS PENDING → CONDITIONS PENDING)
Defect fixed: "<small>בעש"ת</small> וכתב לחיים…" and "<small>בעש"ת</small> בספר חיים…" (whole paragraphs) were shown
as ordinary text every Shabbat → `uchtov` / `besefer-chayim` (`aseret`). The old pending note ("drops the words") is
obsolete — the engine no longer truncates.
Pending: inline "האל [בעש"ת המלך] הקדוש", "עשה [בעש"ת השלום]" visible as alternatives (E1b); Kaddish leaves' inline
Ten-Days words (E1c); the leap-year line in אתה יצרת (E7).

### shabbat-mincha (CONDITIONS PENDING → CONDITIONS PENDING)
Defect fixed: the Shabbat Shuva paragraphs "בש"ת וכתב…", "בש"ת בספר חיים…" shown every Shabbat → `aseret` sections.
צדקתך: `tachanunIfWeekday|shabbatShuva` (checked ordinary — yes, Chanukah — no, RC — no, Shabbat Shuva — yes).
Pending: inline "עשה [בש"ת השלום]" (E1b), Kaddish Ten-Days words (E1c), צדקתך on the Four Parshiyot (E9).

### birkat-hamazon (VERIFIED → reopened → VERIFIED)
Defect: on the weekdays of the Ten Days שיר המעלות was shown instead of על נהרות בבל (engine Tachanun rule) → the
conditions now use `TACHANUN` / `NO_TACHANUN`. Checked Ten Days Wednesday, ordinary day, Chanukah, Erev RH.

### hallel (CONDITIONS PENDING → VERIFIED)
`FULL_HALLEL_PARTS = '!roshChodesh&!pesach|pesachFirstDays|chanukah'`. Checked full: Chanukah, RC Tevet, Chol HaMoed
Sukkot, Shemini Atzeret, Simchat Torah (dia), Shavuot 1/2 (dia), Pesach 1, Pesach 2 (dia); half: RC, Chol HaMoed
Pesach, 7th, 8th (dia). The engine's `fullHallel`/`halfHallel` are wrong on Shemini Atzeret and the diaspora's second
days (E3), so they are not used.

### rosh-chodesh-musaf (CONDITIONS PENDING → CONDITIONS PENDING)
Read `--full` on 30 Cheshvan 5787. The old INLINE_ASERET note does not apply (these leaves write בעשי"ת, which the
engine resolves). Pending: "ולכפרת פשע" under "בשנת העיבור עד חודש ניסן" shown in every year (E7).

### omer (CONDITIONS PENDING → VERIFIED)
`count` has `perDay: dayBlocks('omerDay', n => /(?:^|\s)n\. היום /)` — the edition prints each night as "<date> n.
היום …"; only that paragraph is shown. Checked nights 1, 2, 7, 8, 33, 49; the night after 49 (no omerDay) shows the
table, as the dsl intends.

### Spot-checked, unchanged: kabbalat-shabbat, bedtime-shema, shabbat-kiddush, shabbat-kiddush-day, havdalah.

## Editions / Open Siddur / disagreements (recorded, not changed)
- Consulted: the pack's own notes and captions; Sefaria's "Siddur Ashkenaz" pages for the festival Amidah leaves (the
  same edition); Wikipedia "Sim Shalom" for the Ashkenaz rule שים שלום at Shacharit / שלום רב at Mincha and Maariv.
  Nothing was copied into the app.
- Festival Musaf, Sanctity of the Name ¶1 "כי אל מלך גדול וקדוש אתה" inside the silent אתה קדוש: not in the common
  Ashkenaz editions (Rödelheim, ArtScroll); edition's wording, kept.
- Festival Musaf ¶35 "בשבועות ושני שעירים לכפר": an edition-specific small-print variant for Shavuot.
- "בקיץ מוריד הטל": printed and shown in summer everywhere — the Land-of-Israel Ashkenaz custom; diaspora Ashkenaz
  says nothing (Rema OC 114:3). Minhag difference, documented, not conditioned (the weekday template does the same).
- ותערב endings: the edition itself gives both customs (US congregations / Gra and the Land of Israel); cut by place.
- Duchening on a Shabbat Yom Tov in the diaspora: customs differ; shown (edition gives no rule).
- Kaddish Shalem (Shabbat leaves) "גרסת הגר"א: יתגדל ויתקדש" — a variant note inline; shown as a marked alternative.
- Weekday Shacharit / Maariv editorial halachic notes (טור, קיצור שו"ע) are typed as notes, not prayer — OK.

## Engine requests
- **E1** (siddurBlocks / conditionalMarkup): a small-print group whose caption and words are one group ("<small>לשבת
  שַׁבָּתות לִמְנוּחָה וּ</small>", "<small>לשבת רְצֵה בִמְנוּחָתֵנוּ</small>", and bare "<small>שַׁבָּת וּ</small>") is not
  resolved: the Shabbat words show on weekdays (FA Sanctity of the Day ¶5, 11, 22, 23; FM Sanctity of the Day ¶1, 7,
  12, 66, 67, 68). **E1b**: the abbreviations בעש"ת and בש"ת are unknown to `rubricConditions` (MSA Holiness of God
  ¶1, Kedushah ¶12, Concluding Passage ¶4; SMIA Concluding Passage ¶4). **E1c**: "<small>בעשי”ת:</small>" inside the
  Shabbat Kaddish leaves stays as an alternative though the caption is known.
- **E2**: FM Sanctity of the Day ¶35 — after a false caption group ("בשבועות ושני שעירים לכפר") the following recited
  words "ושני תמידים כהלכתם" are dropped.
- **E3**: `prayerContext.hallel` — Shemini Atzeret (IL) and Simchat Torah (dia) give no Hallel; Pesach 2 (dia) gives
  half; Shavuot 2 (dia) none; 8th of Pesach (dia) none.
- **E4**: `fast` is true on Erev Pesach (Ta'anit Bechorot is not a public fast).
- **E5**: `tachanunOmitted` / `prayerContext.omitTachanun` — Tishrei 1–23 wholesale (Ten Days wrong); missing:
  Erev RH, Mincha of Erev Shabbat / Erev Yom Tov / Erev Chanukah, Pesach Sheni, Lag BaOmer, 1–12 Sivan, Isru Chag,
  15 Av, Purim Katan; 30 Tishrei is not `roshChodesh` (whole weekday Shacharit of RC Cheshvan day 1 is wrong).
- **E6**: keys for the first day of Pesach alone and Shemini Atzeret without Simchat Torah (Tal/Geshem abroad).
- **E7**: caption "בשנת העיבור עד חודש ניסן" → `leapYear` (and the month before Nisan).
- **E8**: a key for "Yom Tov later this week" (ויהי נועם / ואתה קדוש on Motzaei Shabbat).
- **E9**: keys for the Four Parshiyot and for the month being blessed (Mevarchim Av).
- **E10**: the season key for Musaf is computed for Shacharit (the reader passes Shacharit) — wrong on Pesach 1 and
  Shemini Atzeret (worked around in the festival Musaf only).
- **E11**: `whenLabel` builds long labels for compound conditions; allow a composition-supplied label.

## Tests
`tests/siddurFinal-ashkenaz.test.mjs` (15 tests): levels; festival Amidah per prayer; names/season/ותודיענו;
Pesach and Sukkot offerings day by day (IL / diaspora, edition table); season and priests in Musaf; Hallel full /
half / none; Omer 1/2/7/8/33/49 in three services; אתה חוננתנו; Erev Pesach / Erev YK; Ten Days; eves; Mevarchim /
Av HaRachamim; Shabbat Shuva paragraphs; complete Kaddish; only Ashkenaz leaves.

## Summary
Two UNVERIFIED services reviewed end to end and fixed (festival Amidah: 6 defects; festival Musaf: 6 defects); Hallel
and Omer promoted to VERIFIED; four VERIFIED services reopened for real defects (weekday Mincha: Erev Pesach, Ten
Days, eves; Shabbat Maariv: Omer placeholder; Birkat HaMazon: Ten Days) and re-verified; Shabbat Musaf and Mincha
had Shabbat Shuva paragraphs shown every week (fixed). What remains pending is named per service and each item is
an engine request above — nothing is silently chosen.

## Addendum 2026-09-29 — Birnbaum *HaSiddur HaShalem* (1949) as a second Ashkenaz edition

Owner-approved import of the Hebrew Wikisource page transcription (CC BY-SA 4.0), **only** for text the Metsudah
edition does not print. Its own pack (`HaSiddur HaShalem Birnbaum`, `src/data/nusach/siddurAshkenazBirnbaum.mjs`),
manifest entry (`SIDDUR_SOURCES.ashkenaz.extraEditions`), provenance (`sources/birnbaum-ashkenaz/provenance.json`) and
notes (`docs/siddur/birnbaum-ashkenaz-import.md`). 43 printed pages, all proofread (one validated); no page was refused.

| Service | Added (section id ← leaf) | Condition | Status |
|---|---|---|---|
| kabbalat-shabbat | `bameh-madlikin` ← Bameh Madlikin (pp. 251–253), `rabbi-elazar` ← Amar Rabbi Elazar (253–255), then the Metsudah `kaddish-derabanan` (its Kabbalat Shabbat leaf, unused until now) | `!yomTov&!cholHamoed&!motzaeiYomTov` | VERIFIED (source gap closed) |
| shabbat-shacharit | `al-hakol`, `av-harachamim-hu` (chazzan) ← Torah Service, Al HaKol (p. 367), between לך ה׳ and ויעזור | — | CONDITIONS PENDING (unchanged items) |
| shabbat-mincha | `shir-hamaalot` ← Shir HaMaalot, Ps. 120–134 (467–475) after ברכי נפשי; `pirkei-avot-1…6` ← Pirkei Avot, Chapter 1…6 (477–533) after Kaddish Yatom | `winter`; `avot1`…`avot6` | CONDITIONS PENDING (unchanged items; Pirkei Avot gap closed) |
| weekday-maariv | `veyiten-lecha` ← Veyiten Lecha (541–549), last section | `motzaeiShabbat&!tishaBav` | CONDITIONS PENDING (unchanged item) |

Printed and read (prayer mode unless noted; `--full` for the new sections): Kabbalat Shabbat 2026-10-16 (IL), Chanukah
Friday 2026-12-11 (IL, diaspora — said), Shemini Atzeret eve 2026-10-02, Shabbat Chol HaMoed Pesach eve 2027-04-23 (IL
and diaspora), Friday Shavuot 2027-06-11 (IL: the Shabbat after a Friday Yom Tov; diaspora: Yom Tov) — not said; Shabbat
Shacharit 2026-10-17; Shabbat Mincha 2026-10-17 (winter: ברכי נפשי + שיר המעלות), 2027-05-01 (chapter 1, IL and
diaspora), 2027-07-17 (6), 2027-09-18 (3–4), 2027-09-25 (5–6), 2027-06-12 diaspora (none: 2nd day Shavuot), 2027-04-24
(none: Chol HaMoed), edition mode (all six, labelled); weekday Maariv 2026-10-17 (Motzaei Shabbat), 2026-10-19 (not
said), 2029-07-21 (Motzaei Shabbat Tisha B'Av: not said). Each new section was compared with the rendered Birnbaum page
(the test checks every paragraph verbatim against the cached page).

Engine additions (shared files, minimal): `services/prayer/pirkeiAvot.mjs` (the luach schedule, as Hebcal's
`pirkeiAvotSummer`) and the keys `pirkeiAvot`, `avot1`…`avot6` in `compositionConditions` / `WHEN_LABELS`;
`services/siddurBlocks.mjs` treats `<small class="direction">` (the Wikisource editors' Hebrew directions, source lines
and Reader marks) as the edition's notes, like Tehillat Hashem's `class="en"`. Reader: a per-section credit line for
sections of this edition, and the licence link in the footer when such a section is shown; the sources page lists the
edition's licence, sections, pages and changes.

Findings recorded, not changed:
- Motzaei Shabbat that is Tisha B'Av: the Metsudah `vihi-noam` / `veata-kadosh` are still shown (condition
  `motzaeiShabbat` only) — Ashkenaz omits ויהי נועם that night. Engine/condition item.
- Pirkei Avot on a double week: each chapter keeps its own כל ישראל and רבי חנניא (as Birnbaum prints each chapter);
  customs differ on saying them once for the pair.
- ויתן לך placement: Birnbaum prints it after the Motzaei Shabbat Kaddish, before Havdalah (Aleinu not shown there); the
  composition keeps Metsudah's Aleinu before it.
- The transcription follows Wikisource's editing rules (verses per "Mikra al pi ha-Masorah", qamats qatan, holam haser,
  maqaf); 48 notes on the imported pages give Birnbaum's different printed reading (provenance `variants`).
- The Shabbat איזהו מקומן leaf is still truncated; the complete Metsudah weekday leaf could be used (not done).

Tests: `tests/birnbaumAshkenaz.test.mjs` (11 tests: pack source and page status, verbatim fidelity to the proofread
pages, provenance, licence separation, which sections read Birnbaum, placement and conditions of each addition, the
Pirkei Avot schedule, the Open Siddur statuses); `tests/siddurFinal-ashkenaz.test.mjs` now allows the second Ashkenaz
edition (and nothing else). `node scripts/siddur-qa.mjs <rite>` for all four rites: no problem; text findings unchanged
(574 / 48 / 290 / 2041). Full suite 1151/1151; `npx vite build` passes (the pack is its own 135 kB chunk).
