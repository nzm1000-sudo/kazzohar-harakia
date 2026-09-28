# Protocol: drafting tradition records for "המסורת שלי" (kazzohar-harakia app)

You draft customs records from ONE given source file. Output: a JSON array written to the output path you are given.
Accuracy beats quantity. A record that overstates its source is worse than no record.

## Hard rules
1. One record = one clear custom claim (atomic). Never bundle several customs into one record.
2. `excerpt` MUST be copied VERBATIM from the source text you were given (a contiguous span, 20–260 characters, no
   nikud, no ellipses inside, no changes of any kind). It is checked mechanically; any mismatch discards the record.
3. Keep the source's certainty and scope. "יש נוהגים" stays "יש נוהגים"; "בעירנו בגדאד נהגו" is Baghdad only, never "Iraqi
   Jews". A custom the author says was changed/abolished → say so (israelContinuity "changed").
4. Custom vs. law: only draft when the text itself states a CUSTOM (נוהגין / נהגו / המנהג / מנהג / יש נוהגים / ונהגו ...).
   Skip plain halachic rulings. Skip anything where the custom is unclear, mystical-technical, commercial, or about
   laws of damages/finance. Skip anything you'd have to interpret heavily.
5. Hebrew, plain and respectful. No invented facts, names, pages, reasons. Reasons only if the text gives them.
6. For the Rema (Shulchan Arukh glosses): the custom must be in the part AFTER "הגה:" and be the Rema's own words.
   communityIds ["ashkenaz"]. The Rema describes Ashkenazi lands of his time; do not claim anything about today.
7. For the Ben Ish Hai: communityIds from the text — "iraq-baghdad" (Baghdad: בגדאד/עירנו/עירינו), "jerusalem-sephardi"
   (ירושלים/ערי הקודש), "jerusalem-beit-el" (בית אל). Several if the text says so explicitly.

## Record shape (JSON)
{
  "id": "kebab-case-unique-english",            // prefix with the source key given to you, e.g. "rema-oc-", "bih-"
  "topic": "kebab-case topic shared by records about the same practice (e.g. birkat-kohanim-frequency)",
  "title": "Hebrew, ≤ 60 chars",
  "shortSummary": "One Hebrew sentence, faithful to the source, stating whose custom it is",
  "body": "1–3 Hebrew sentences: what the source says, in your words, may include a short quote",
  "traditionType": one of halacha|halachic_custom|prayer_custom|prayer_text_variant|piyut|melody|torah_reading|pronunciation|holiday_custom|shabbat_custom|food_custom|life_cycle|wedding|birth|brit_milah|bar_mitzvah|mourning|synagogue|clothing|language|judeo_language|folk_custom|community_history|family_custom|oral_tradition,
  "normativeType": one of law|halachic_custom|community_custom|liturgical_custom|cultural_tradition|oral_tradition,
  "practicalHalacha": true if following it is a halachic question for the reader (then a rabbi should be asked), else false,
  "communityIds": [...],
  "calendarTriggers": [ ... ] or [],   // only when the custom belongs to specific days:
       // {"month": M, "from": D, "to": D} with Hebcal months: 1 Nisan, 2 Iyar, 3 Sivan, 4 Tammuz, 5 Av, 6 Elul,
       // 7 Tishrei, 8 Cheshvan, 9 Kislev, 10 Tevet, 11 Shvat, 12 Adar, 13 Adar II; "adar" = Adar (Adar II in leap years)
       // {"weekday": 6} = Shabbat (0 Sunday … 6 Saturday)
       // Include the eve when the custom is performed on the eve. Rosh Chodesh: {"dayFrom":1,"dayTo":1} and {"dayFrom":30,"dayTo":30}.
  "lifecycleTriggers": [] or subset of ["birth","brit_milah","zeved_habat","education","bar_mitzvah","engagement","wedding","new_home","mourning","yahrzeit"],
  "tags": ["Hebrew keywords", ...],
  "reference": "exact place, Hebrew, e.g. שולחן ערוך, אורח חיים תצג, ב (הגה)  /  בן איש חי, הלכות שנה ראשונה, פרשת תצוה, אות לח",
  "excerpt": "verbatim span from the text",
  "verificationStatus": "primary_verified" (primary source says it directly) | "single_reliable_source" (hearsay like "שמעתי", or secondary),
  "israelContinuity": "unknown" unless the text says otherwise ("changed" if abolished/changed),
  "historicalPeriod": {"from": "המאה ה־16"} for the Rema, {"from": "המאה ה־19"} for the Ben Ish Hai,
  "notes": optional Hebrew caveat, e.g. "למעשה יש לשאול רב." when practicalHalacha is true
}

Hebrew reference numbering: use Hebrew numerals for siman/seif (e.g. תצג, ב) and for אות in the Ben Ish Hai.
The source key and file path are given in your task. Write ONLY the JSON array to the output file (valid JSON, UTF-8).
At the end, reply with: number of records written, number of passages skipped, and any doubts.
