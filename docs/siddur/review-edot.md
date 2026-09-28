# Final Siddur QA — Nusach Edot HaMizrach (review log)

Rite: `edot-hamizrach` (composition `src/data/nusach/compositions/edot.mjs`, edition "Siddur Edot HaMizrach",
Sefaria / Mordechai Shaliach Tzibur, CC0). Reviewer brief: `docs/siddur/final-qa-brief.md`. Date: 2026-09-28.
Branch `feature/smart-prayer-engine` (baseline de41ce7). Tests: `tests/siddurFinal-edot.test.mjs` (13 tests).

The rite's text is the established source: nothing was rewritten for consistency and no word was typed. Every change
below is a `when`, a `perDay` table, a section boundary, or an omit with its reason. Only `edot.mjs`,
`notes-edot-hamizrach.md`, this log and the new test file were edited.

## How it was read

- Services printed in prayer mode with the composer itself (a copy of `scripts/print-rite-service.mjs` that imports
  `edot.mjs` directly, because `compositions/index.mjs` could not load while another rite's file was mid-edit), and the
  section order listed for every service on the dates below; the changed and pending parts read with `--full`.
- An automatic sweep of all 18 services × 18–26 dates × Israel / diaspora in prayer mode: no empty section, no
  consecutive duplicated block, every Kaddish opens with יתגדל and is not cut (half Kaddish up to דאמירן בעלמא, a full
  Kaddish up to עושה שלום). It found one truncated Kaddish (Shabbat Arvit, fixed below). The sweep is now a test.
- Full edition mode printed for weekday Shacharit / Arvit, Kabbalat Shabbat, Shabbat Shacharit / Mincha / Arvit and the
  festival Amidah to check every alternative stays, labelled.

Dates used (Israel unless stated): ordinary Mon/Tue/Thu/Fri 2026-11-02, 11-03, 10-22, 10-23; BeHaB Monday 2026-10-19;
Rosh Chodesh 2026-10-12; 10 Tevet 2026-12-20; 17 Tammuz 2026-07-02; Tisha B'Av 2026-07-23; Chanukah day 1 2025-12-15,
day 2 2026-12-06, day 6 = RC Tevet 2026-12-10, day 8 2025-12-22; Purim 2026-03-03; 11 and 13 Tishrei 2026-09-22 / 09-24;
Aseret Yemei Teshuva 2026-09-15; Shabbat Shuva 2026-09-19; Sukkot 2026-09-26, CHM 09-28, Hoshana Rabbah 10-02,
Shemini Atzeret 10-03 (IL) / 10-04 (diaspora); Pesach CHM 2026-04-04 (Shabbat) / 04-05; Motzaei 7th of Pesach
2026-04-08 (IL); 22 Nisan diaspora 2026-04-09; Omer nights 1/2/7/8/33/49 (2026-04-02, 04-03, 04-08, 04-09, 05-04,
05-20); Shavuot Friday 2026-05-22 (IL and diaspora) and 05-23 diaspora; Shabbat Mevarchim 2026-10-10; Shabbat Chanukah
+ Mevarchim 2026-12-05; ordinary Shabbat 2026-10-17; Shabbat Erev Pesach 2025-04-12 (Friday 04-11); Pesach 5787
2027-04-22.

## Service by service

### weekday-shacharit — CONDITIONS PENDING → CONDITIONS PENDING (fewer, all real)
Read: whole order on ordinary Mon/Tue, RC, Chanukah 1/2/6/8, Purim, 11 & 13 Tishrei, Sukkot CHM, Pesach CHM, fasts.
- Fixed `chanukah-reading` (new): each day's reading from "Hanukkah, Shacharit" (`perDay: dayBlocks('chanukahDay', /^קריאה
  ליום …$/, 8)`, `keepHeading`), after `aliyah-before`; on RC Tevet it follows `rc-reading` (4th aliyah, second scroll —
  that leaf's ¶23). ¶0–2 (rules) and ¶22–27 (RC Tevet / Shabbat Chanukah instructions) omitted with reasons. Before:
  on Chanukah the aliyah blessings stood with no reading.
- Fixed `purim-reading` (new): ויבא עמלק from "Purim, Purim Day" ¶2, `when: purim`; ¶0–1 and ¶3–9 omitted with reasons.
  Before: on Purim the aliyah blessings stood with no reading.
- Decided `song-after-yom-kippur`: `afterYomKippur` now exists (11–14 Tishrei); shown with the edition's rubric
  "למחרת יום הכיפורים". Note: the edition says "the day after Yom Kippur"; the engine key covers until Sukkot (the usual
  Sephardi practice). Recorded, not changed.
- Fixed `song-mourners`: with `houseOfMourning` (unknown → undecided → always shown) the mourners' psalm appeared on
  Rosh Chodesh between `rc-ashrei` and `rc-uva-letzion`. Now `!roshChodesh`, under its title "בבית האבל" with the
  edition's rubric (engine request 1).
- Pending (kept, reasons in the composition): Chol HaMoed — the edition prints no CHM reading, lulav or Hoshanot (the
  whole pack was searched), Musaf is its own service; Purim Megillah is inside Uva LeSion ¶1; Chanukah's "לא יאמר השיר
  שהיו הלוים" is inside the Song-of-the-Day paragraph; house of mourning; text gap: Ps 30 (Hodu ¶5) lacks "מזמור שיר
  חנכת הבית לדוד".

### weekday-maariv — CONDITIONS PENDING → VERIFIED COMPLETE
- Decided Omer: `omer-count` has `perDay: dayBlocks('omerDay', n => /^<date line>$/)`. The edition prints each day as
  three lines — the Hebrew date of the night ("ט"ז ניסן", "כ ניסן", "א אייר" … "ה סיון"), the count, the Sefira line —
  so the day is matched by its date line (`omerDateLine`, exported and tested). Read days 1, 2, 7, 8, 33, 49 and the
  edition (49 counts).
- Decided אתה חוננתנו: `motzaeiShabbat|motzaeiYomTov`. The rubric "במוצאי שבת ויום טוב אומרים" (Amidah ¶8) is read by
  the text layer as Motzaei Shabbat only and removed the prayer on Motzaei Yom Tov, so the rubric is now its own
  continuation section (`ata-chonantanu-rubric`) and the prayer (¶9) its own section, both with the same `when`.
  Checked: Motzaei 7th of Pesach 2026-04-08 (shown), Motzaei Shabbat 2026-10-17 (shown), ordinary 11-03 (not).

### weekday-mincha — VERIFIED → VERIFIED (regression read: ordinary Tue, Friday, 10 Tevet, Tisha B'Av)
No defect in the composition. Engine findings: Tachanun is shown at Friday Mincha and on Tisha B'Av (requests 3, 4).

### bedtime-shema — CONDITIONS PENDING → CONDITIONS PENDING
- Decided אנא בכח: the edition says "אנא בכח כולו בכל לילה, ואחר שגמר … יחזור לומר הפסוק שכנגד אותו הלילה" — all seven
  lines are said every night, so the whole prayer (with "ליל א" … "ליל שבת") is right; the pending note was removed.
- Pending: Vidui ("אין לאומרו בליל שבת … במוצ"ש עד חצות … במוצאי יו"ט ור"ח"). The reader opens a service with no prayer
  type in the context of the civil day's Shacharit, not of the night, and nothing says "before midnight" (request 6).
  Shown with the edition's rule.

### kabbalat-shabbat — CONDITIONS PENDING → CONDITIONS PENDING (only the house of mourning left)
- Decided במה מדליקין: `!cholHamoed&!chanukah&!yomTov&!motzaeiYomTov&!erevYomTov&!erevChanukah`. Kabbalat Shabbat is
  read in the context of the Shabbat night, so a Friday of Yom Tov is `motzaeiYomTov`, a Shabbat that is Erev Yom Tov
  is `erevYomTov`, and 24 Kislev on Shabbat is `erevChanukah`. Checked: ordinary Fridays (said); Shavuot on Friday IL
  (after YT) and diaspora (2nd day); Shabbat Erev Pesach 5785; Shabbat Chanukah; Shemini Atzeret; RC Tevet in Chanukah
  (all not said; אמר רבי אלעזר always). 24 Kislev on Shabbat tested with a constructed context (5790).
- Pending: house of mourning (no key; the rubric at the head of the section states it).

### shabbat-maariv — VERIFIED → VERIFIED (defect fixed)
- Fixed truncated Kaddish: the edition's "קדיש יהא שלמא" (Magen Avot ¶44–46) starts at "תתקבל" — no יתגדל … דאמירן בעלמא,
  and a Titkabal line in a Yehe Shelama Kaddish. Omitted with its reason; the same edition's complete Kaddish Yehe
  Shelama (Rosh Hodesh, Barchi Nafshi — already used by the festival Musaf) is said. Same rite, same edition, no word
  typed.

### shabbat-kiddush — VERIFIED → CONDITIONS PENDING (text gap declared)
- Kiddush ¶12 reads "…תחלה למקראי קדש זכר ליציאת מצרים, ושבת קדשך" — "כי בנו בחרת ואותנו קדשת מכל העמים", which the Edot
  HaMizrach nusach says, is missing. Nothing can be supplied from this edition, so the gap is declared instead of
  marking the Kiddush VERIFIED. Needs the licensed completion (researcher).

### shabbat-shacharit — CONDITIONS PENDING → CONDITIONS PENDING
- Decided Birkat HaChodesh: `shabbatMevarchim` (the key now exists). Shown 2026-10-10 and 12-05, not 10-17.
- Fast announcement: `when: 'fastAnnouncement'` (unknown key → shown, with the edition's rubric; it will decide itself
  once the engine has the key — request 2). Pending.
- Pending: Ps 30 heading verse (shared morning order).
- Regression read: ordinary Shabbat, Shabbat Chanukah + Mevarchim (Hallel without its Kaddish, Kaddish Titkabal of the
  Shabbat Amidah after it), Shabbat Shuva.

### shabbat-mincha — CONDITIONS PENDING → VERIFIED COMPLETE
- Decided: `tzidkatcha` `tachanunIfWeekday`; `yehi-shem` now `!tachanunIfWeekday` ("ביום שאין אומרים בו תחנון במנחה אין
  אומרים בו צדקתך אלא אומרים יהי שם"). Before, יהי שם showed every Shabbat together with צדקתך. Checked 10-17 (צדקתך only),
  10-03 Shemini Atzeret and 12-05 Chanukah (יהי שם only), Shabbat Shuva (Avinu Malkeinu + יהי שם — the engine omits
  Tachanun all of 1–23 Tishrei, request 4).

### festival-amidah — VERIFIED → VERIFIED (defects fixed)
- The service takes the prayer of the hour. Fixed: `kedusha` and `modim-derabanan` `!maariv` (the edition: "קדושה
  בחזרת הש"ץ של שחרית ומנחה"; Arvit has no repetition); `birkat-kohanim` `shacharit` — no Nesiat Kapayim and no
  "אלהינו ואלהי אבותינו" at Mincha of Yom Tov (SA OC 129:1). Before, Arvit showed Kedusha and Birkat Kohanim, Mincha
  Birkat Kohanim. Checked Sukkot Shacharit/Mincha/Arvit, Shemini Atzeret (IL, diaspora Motzaei Shabbat with ותודיענו),
  Shavuot, Pesach 5787 diaspora.

### festival-musaf — CONDITIONS PENDING → CONDITIONS PENDING
- Read per festival and day: Yom Tov vs Chol HaMoed Kedusha and ending, Shabbat Chol HaMoed (Yom Tov Kedusha,
  Chol HaMoed ending), the festival's psalm (Pesach / Sukkot), Hoshana Rabbah (לדוד ה׳ אורי), Shemini Atzeret IL and
  Simchat Torah diaspora, 8th day of Pesach diaspora, Shavuot 2nd day on Shabbat (diaspora). The festival names inside
  אתה בחרתנו / את מוסף are chosen by the text layer from the edition's captions (בפסח / בשבועות / בסוכות / בש"ע) — correct
  on every date read.
- Pending (text gap, unchanged): the day's offering verses are not printed (¶26 → ¶27).
- Engine finding: the rain phrase in Musaf of the 1st day of Pesach and of Shemini Atzeret is wrong (request 5).

### omer — CONDITIONS PENDING → VERIFIED COMPLETE
Same `perDay` as Arvit. Outside the Omer (omerDay 0) the service opened by hand shows the whole table.

### VERIFIED services spot-checked, no regression
shabbat-musaf (ordinary, Chanukah — על הנסים), shabbat-kiddush-day, havdalah (Motzaei Shabbat), birkat-hamazon (Shabbat
Chanukah), hallel (full on Sukkot, half on Pesach CHM; Chanukah half Kaddish), rosh-chodesh-musaf.

## Engine requests (not done — shared files)

1. `undecidable`: an unknown key makes the whole `when` undecided, so `houseOfMourning&!roshChodesh` still shows on
   Rosh Chodesh. An unknown term should be treated as "maybe" while decided terms still apply (then `song-mourners` can
   go back to `houseOfMourning&!roshChodesh`).
2. New keys: `houseOfMourning` (a personal setting), `fastAnnouncement` (Shabbat before 17 Tammuz / 10 Tevet),
   `individualFast`; labels for them in `WHEN_LABELS`.
3. Tachanun at Mincha: not said at Mincha of Erev Shabbat / Erev Yom Tov (and, by custom, before other days without
   Tachanun). `tachanunOmitted` ignores the prayer type. Seen: weekday Mincha on Friday 2026-10-23 shows Vidui/נפילת אפים.
4. `tachanunOmitted` (jewishContextEngine): (a) omits Tachanun on all of 1–23 Tishrei — but it IS said in Aseret Yemei
   Teshuva (2026-09-15 shows no Vidui); (b) does not omit it on Tisha B'Av (2026-07-23 Mincha shows Vidui), 15 Av,
   15 Shevat, 14 Iyar, Lag BaOmer, 1–12 Sivan (Sephardi custom), Isru Chag. `tachanunIfWeekday` inherits both.
5. Rain phrase in Musaf: the reader (and `print-rite-service.mjs`) pass `prayerType: 'shacharit'` to
   `JewishContextEngine` for Musaf, so `mashivHaruch` never sees 'mussaf': Musaf of 15 Nisan shows "משיב הרוח" and Musaf of
   Shemini Atzeret (IL, 22 Tishrei) shows "מוריד הטל" — both reversed.
6. Bedtime Shema: a night context (the coming night's date, not the civil day's Shacharit) and a "before midnight" key,
   to decide the Vidui rule.
7. Ta'anit BeHaB is treated as a public fast (`fast` true on 2026-10-19): weekday Shacharit shows ויחל, עננו, Avinu
   Malkeinu. Not a public fast in this rite; a setting at most.
8. Text layer (`rubricConditions`): "במוצאי שבת ויום טוב" → `motzaeiShabbat` only; should be
   `motzaeiShabbat || motzaeiYomTov` (worked around by splitting the rubric, see weekday-maariv).
9. `scripts/print-rite-service.mjs` and `siddur-qa.mjs` import every rite: one rite's broken file stops the tools for all.

## Open Siddur / other editions

Open Siddur was not fetched in this pass. The disagreements recorded are with the standard Edot HaMizrach nusach as
printed in common Sephardi siddurim: Kiddush "כי בנו בחרת" missing (text gap); Ps 30 heading missing (text gap);
Shabbat Arvit Kaddish Yehe Shelama truncated (transcription, worked around); "למחרת יום הכיפורים" vs. 11–14 Tishrei
(edition wording vs. practice); typos already listed in the notes (glued "ועדיהוה", "ברצונובערב"; "שנמצע", "מובה").

## Summary

Before: 10 VERIFIED, 8 CONDITIONS PENDING. After: 12 VERIFIED, 6 CONDITIONS PENDING — weekday-maariv, shabbat-mincha
and omer became VERIFIED; weekday-shacharit, bedtime-shema, kabbalat-shabbat, shabbat-shacharit and festival-musaf stay
pending with fewer, stated reasons; shabbat-kiddush was lowered from VERIFIED to CONDITIONS PENDING for a text gap.
Defects fixed: truncated Kaddish (Shabbat Arvit), festival Amidah Kedusha / Birkat Kohanim by prayer, יהי שם with צדקתך
at Shabbat Mincha, mourners' psalm inside the Rosh Chodesh order, missing Chanukah and Purim readings, אתה חוננתנו on
Motzaei Yom Tov. `node --test tests/siddurFinal-edot.test.mjs`: 13/13.
