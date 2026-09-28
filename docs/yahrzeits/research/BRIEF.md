# נר ה' נשמת אדם — research brief (for each researcher)

Goal: a curated, offline list of the yahrzeit / hilula dates of FAMOUS tzaddikim — people a reasonably knowledgeable
observant Jewish user would recognize. Quality over quantity. Never invent a name or a date; never fill days.

For every candidate in your area (the seed names you were given, plus a broad search for other genuinely famous
figures in the same area):
1. Is the figure famous enough? (famousTier "A" = universally/very widely recognized, "B" = very prominent within
   major Torah communities; anything less → reject with reason "insufficiently prominent").
2. The Hebrew date of passing / the date the hilula is observed. Use at least two independent reputable sources
   where possible: Chabad.org (historical calendar / "Today in Jewish History"), Breslov.org, official
   institutions/yeshivot/family sites, Sefaria/classical sources, authoritative biographies, Hebrew Wikipedia (as a
   secondary check only), Da'at, Hamichlol, Kikar/Yeshiva sites. Use WebSearch/WebFetch. Record URLs.
3. dateType: documented_death | traditional_yahrzeit | traditional_hilula | disputed.
   (Biblical and Tannaitic dates are nearly always traditional_* — say so.)
4. If good sources disagree: record every date in conflictingDates with its source; choose a production date only
   with a stated reason (the date most widely observed), else leave the record disputed.
5. Adar: record whether the death was in אדר, אדר א' or אדר ב', and leapYearPolicy: "adar2" (observed in Adar II in a
   leap year — the common practice), "adar1", or "both" — follow the documented practice for that figure/community.
6. Honorific the figure is conventionally given: זצ"ל / זצוק"ל / זיע"א / ע"ה / ע"ה for biblical figures etc. Never
   default. Female figures: gender "f".

Output: write ONLY your file `docs/yahrzeits/research/<your-group>.json`:
```json
{ "group": "...", "accepted": [ {
  "id": "latin-kebab-id", "displayNameHe": "רבי ... ", "canonicalNameHe": "...", "aliases": ["..."],
  "gender": "m", "honorific": "זיע\"א",
  "hebrewDate": { "day": 18, "month": "Iyar", "leapYearPolicy": null },
  "deathYearHebrew": "ה'תקנ\"ט", "deathYearGregorian": 1799,
  "dateType": "traditional_hilula", "tradition": "Sephardi|Ashkenazi|Chassidic|Chabad|Breslov|Lithuanian|Tanach|Tannaim|Kabbalah|Mizrahi|Moroccan|Yemenite|Rishonim|Geonim|Religious-Zionist",
  "region": "...", "famousTier": "A",
  "sources": [ { "name": "Chabad.org — Today in Jewish History", "url": "https://...", "says": "18 Iyar" } ],
  "verificationStatus": "VERIFIED_2_SOURCES|VERIFIED_1_SOURCE|DISPUTED",
  "conflictingDates": [ { "date": "...", "source": "...", "note": "..." } ],
  "notes": "short" } ],
  "rejected": [ { "name": "...", "reason": "insufficiently prominent|unreliable date|only one weak source|conflict unresolved|duplicate|no established yahrzeit", "notes": "..." } ] }
```
Month names exactly: Tishrei, Cheshvan, Kislev, Tevet, Shevat, Adar, AdarI, AdarII, Nisan, Iyar, Sivan, Tamuz, Av, Elul.
Aim for roughly 25–45 accepted records in your area if research supports them. Do not change any other file.
