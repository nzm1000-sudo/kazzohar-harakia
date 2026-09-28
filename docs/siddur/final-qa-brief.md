# Final Siddur QA — brief for each rite reviewer

Repository: /Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia (branch feature/smart-prayer-engine). NO new features.

## You own ONLY
- `src/data/nusach/compositions/<rite>.mjs` and `docs/siddur/notes-<rite>.md`
- a new review log `docs/siddur/review-<rite>.md`
- new test file `tests/siddurFinal-<rite>.test.mjs`
Do not edit any other file (the engine is shared by four reviewers working in parallel). If you need a new day key or
an engine change, write it under "Engine requests" in your review log and leave the item pending.

## Tools
- `node scripts/siddur-qa.mjs <rite>` — levels and problems for your rite (with the rite argument it writes nothing).
- `node scripts/print-rite-service.mjs <rite> <serviceId> <YYYY-MM-DD> <shacharit|mincha|maariv|mussaf> <il|diaspora> <prayer|edition> [--full]`
  prints the composed service exactly as the reader shows it. Use --full to read every word. Pick real dates to test
  conditions (e.g. a Rosh Chodesh, a Chanukah day, Chol HaMoed, a fast, a Shabbat Mevarchim, Omer day 1/2/7/8/33/49).
- The rite's pack: `loadSiddur(rite)` from src/services/nusach.mjs → `pack.texts[ref].he` (paragraph arrays).
- Day keys available to `when` (src/services/prayer/riteServiceComposer.mjs → compositionConditions / WHEN_LABELS):
  everything already there plus NEW: omerDay, chanukahDay, cholHamoedDay, sukkotDay, pesachDay, pesachFirstDays,
  pesachLastDays, cholHamoedPesach, cholHamoedSukkot, sukkotFirstDays, motzaeiYomTov, erevYomTov, erevChanukah,
  shacharit, mincha, maariv, musaf (prayer type; the festival Amidah gets the prayer of the hour), afterYomKippur,
  erevPesach, erevYomKippur, shabbatMevarchim, tachanunIfWeekday, pesach, shavuot, sukkot, sheminiAtzeret,
  hoshanaRabbah, yomTov, fullHallel, halfHallel, israel, diaspora, day0..day6.
- Per-day tables: `import { dayBlocks } from './dsl.mjs'` and on the section `perDay: dayBlocks('omerDay', n => /regex of day n's FIRST paragraph/)`.
  In today's prayer only that day's paragraphs show; in the edition the whole table. Match YOUR edition's printing exactly.

## Work, service by service (start with UNVERIFIED, then CONDITIONS PENDING, then spot-check 2–3 VERIFIED ones)
1. Print the service (prayer mode, several relevant dates; and edition mode) and READ IT END TO END with --full.
2. Check: first words; order of sections; Shema/blessings; the Amidah complete (all blessings, correct seasonal
   additions); Kedusha and repetition roles; Kaddish placement and completeness (no truncated Kaddish); Tachanun;
   Aleinu; ending. No editorial text shown as prayer; no duplicated block; nothing cut mid-sentence; no text of
   another rite.
3. Replace each `conditionsPending` note you can now decide with a real `when` using the keys above (Omer → perDay;
   the festival Amidah's Maariv/Shacharit/Mincha parts → maariv/shacharit/mincha; festival names → pesach/shavuot/
   sukkot/sheminiAtzeret; Musaf korbanot → the exact festival/day keys; Birkat HaChodesh → shabbatMevarchim; צדקתך /
   אב הרחמים → tachanunIfWeekday where that IS the rule for this rite; Motzaei Yom Tov → motzaeiYomTov).
   Where the rule differs by minhag or the engine cannot decide, keep it visible (a `when` with a label, never a
   silent choice) and keep a pending note saying exactly why.
4. Mark `reviewed: true` ONLY after you read the composed service end to end and fixed what you found. A service
   stays UNVERIFIED / PARTIAL / SOURCE GAP if its text is incomplete — never invent liturgy, never borrow from another
   rite (Sefard ≠ Edot HaMizrach; Chabad ≠ generic Sefard; Ashkenaz ≠ Sefard).
5. Open Siddur (https://opensiddur.org) may be used as a REFERENCE to check order and wording (WebFetch/WebSearch).
   Do not copy text from it into the app — a separate researcher handles licensing and import. Record every
   disagreement you find (typo / transcription / minhag / edition difference) in your review log.
6. Add regression tests in tests/siddurFinal-<rite>.test.mjs for what you fixed (sequence, Omer day 1/2/7/8/33/49
   shows only that day, Hallel full/half/none on the right days, festival Amidah per prayer, no mixed rite,
   no truncated Kaddish). Use composeRiteService + loadSiddur directly.
7. Run `node --test tests/*.test.mjs` at the end: all must pass.

## Review log (docs/siddur/review-<rite>.md)
For every service: status before → after, dates printed, what you read, defects found and fixed (with the section
id), what remains pending and exactly why, Open Siddur/other editions consulted and disagreements.
Finish with a short summary.
