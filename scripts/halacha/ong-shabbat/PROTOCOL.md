# Protocol: question records from עונג שבת (הרב ישראל שריקי, מהדורה ראשונה תשע״ג)

The book is used in the app with the author's permission (rights basis `author-permission`; see
`docs/halacha/ong-shabbat-audit.md` §M). These records join the existing Halacha Engine layer
(`src/data/practicalHalachaQa.mjs`); they are not a separate engine.

You receive `in-gNN.json`: every halacha of your chapters, as extracted from the book:
`{ unit: "4.18", chapter, section, label, title, pages, text, footnotes: [{ n, text }], indexTerms }`.
`text` is the book's own wording (the footnote markers removed); `footnotes` are the book's "מקורות וטעמים" for
that halacha; `indexTerms` are the words the book's own subject index uses for it.

## Three layers, never mixed

1. **לשון הספר — `excerpt`**: a VERBATIM contiguous span of `text` (25–700 characters, no ellipses, no edits, same
   punctuation and spacing). It must contain the ruling your short answer states. Checked mechanically.
2. **תשובה קצרה — `shortAnswer`**: 1–2 plain Hebrew sentences (≤ 260 characters) that say nothing the book does not
   say. Keep the book's level exactly:
   - "טוב / ראוי / נכון / יש להחמיר / המחמיר תבוא עליו ברכה / נוהגים / לכתחילה" never become "חייב / אסור".
   - "מותר" never becomes "מצוה". "יש להקל" stays a leniency, "מעיקר הדין מותר, וטוב להחמיר" keeps both halves.
   - Every condition stays: in the answer or in `conditions` (אם…, רק…, אלא…, בתנאי…, ובלבד…, לכתחילה/בדיעבד,
     במקום צורך). Do not generalise a specific case ("קופסת טונה") into a rule about everything.
   - No other opinions, no reasons, no advice of your own, no "לפי הספר", no "מומלץ".
3. **הסבר — `explanation`** (optional, ≤ 420 characters): plain language for a lay reader — what the case is and,
   where the footnote gives it, the reason ("כי אין בישול אחר בישול"). Never a quote, never a new ruling, never a word
   like אסור/חייב/מצוה that neither the halacha nor its footnotes use.

## One record per real halacha

- One canonical `question` per ruling, phrased the way a person would ask it (natural Hebrew, ends with "?").
  If one halacha holds two distinct rulings (e.g. eggs in the cholent AND ג׳חנון), write two records (`-a`, `-b`),
  each with its own excerpt. Most halachot need exactly one.
- `variants`: 2–6 other real ways people ask it: the object, the action, the situation, everyday words
  ("מגבון לח", "טישו רטוב"), and the `indexTerms`. No fake variants, no padding, no repeated wording.
- `keywords`: 2–10 search words: objects, actions, the melacha (בורר, מבשל…), index terms.
- A halacha that is not a practical question (a preface such as "הקדמה להבנת המלאכה", a list of reasons) may be
  skipped: `{ "unit": "18.1", "skip": "<reason>" }`. Every unit of your file must appear: a record or a skip.
- `id`: `ong-<chapter>-<unit n>` (the numbers of `unit`, e.g. `ong-4-18`), with `-a`, `-b` for a second record.

## Classification (a flag, not a ruling)

`currentness` and a short `currentnessNote` (why):
- `STABLE_CLASSICAL_RULE` — a classic rule that does not depend on devices or products (לחם משנה, כוס פגומה).
- `LIKELY_CURRENT` — contemporary but not device-dependent (לגו, מגבת, פתיחת שקית חלב).
- `TECHNOLOGY_REVIEW_NEEDED` — depends on how a device works (electricity, refrigerator light/sensors, שעון שבת,
  מזגן, מעלית, חיישן/עין אלקטרונית, אינטרקום, מצלמות, רכב, GPS, a plata or urn when the ruling depends on the device).
  Any excerpt that names a modern device must be this (or REALITY_DEPENDENT / HIGH_STAKES).
- `REALITY_DEPENDENT` — depends on facts that may have changed: a product's make-up or manufacture (brands of coffee,
  wet wipes, a specific packaging), a public-facility arrangement.
- `HIGH_STAKES_REVIEW` — illness, medicine, childbirth / יולדת, infants' health, danger, travel to a doctor or hospital.
  Every halacha of chapters כ׳ (חולה) and כ״א (יולדת) is HIGH_STAKES_REVIEW; elsewhere use it when the case is
  medical. A HIGH_STAKES record has NO `shortAnswer` (the app shows the book's words and routes to a rabbi); give the
  excerpt, question, variants, keywords, conditions (may be empty) and explanation. If the halacha itself says that in
  danger one acts at once (e.g. "להזדרז לחלל עליו את השבת"), put those exact words in `dangerExcerpt`.

`ruleType`: `din` (plain ruling), `chumra` (טוב/ראוי/יש להחמיר/המחמיר), `minhag` (נוהגים/נהגו), `machloket` (the
text itself brings disagreeing views). `contexts`: from friday, shabbat, motzei-shabbat, meal, home, daily, chanukah,
purim, yom-tov, tisha-bav, tu-bishvat, travel, life-cycle (usually `shabbat`; `friday` for Friday preparation;
`motzei-shabbat` for havdalah).

## Category and topic (use these)

| chapter | category / topic |
|---|---|
| א׳ יום השישי | shabbat/הכנה לשבת · kashrut/בשר וחלב · kashrut/הפרשת חלה |
| ב׳ הטמנה | shabbat/שהייה והטמנה |
| ג׳ קבלת שבת, נרות, נר חנוכה | shabbat/כניסת שבת · shabbat/הדלקת נרות · holidays/חנוכה |
| ד׳ בורר | shabbat/בורר |
| ה׳ סוחט, הכנת סלט, לישה וטוחן | shabbat/סוחט · shabbat/הכנת סלט · shabbat/לש וטוחן |
| ו׳ קידוש | shabbat/קידוש |
| ז׳ נטילה, סעודה, זמירות, סעודה שלישית, מים אחרונים | shabbat/סעודות שבת · blessings/נטילת ידיים · blessings/דברים הבאים בתוך הסעודה · blessings/מים אחרונים · shabbat/זמירות שבת |
| ח׳ הדחת כלים | shabbat/הדחת כלים |
| ט׳ בישול | shabbat/בישול · shabbat/חימום אוכל בשבת · shabbat/פלטה |
| י׳ מוקצה | shabbat/מוקצה |
| י״א השמעת קול, מוצרי חשמל | shabbat/השמעת קול · shabbat/חשמל · tech/שעון שבת ובית חכם · tech/מקרר ומכשירי מטבח · tech/מעליות ודלתות · tech/מצלמות וחיישנים |
| י״ב משחקי ילדים | shabbat/משחקי ילדים |
| י״ג רחיצה, שיניים, קוסמטיקה, שיער | shabbat/רחצה · shabbat/ניקוי שיניים · shabbat/קוסמטיקה וטיפוח · shabbat/טיפול בשיער |
| י״ד ניקיון הבית, בגדים | shabbat/ניקיון · shabbat/בגדים |
| ט״ו אוהל, בונה ומתקן | shabbat/עשיית אוהל · shabbat/בונה ומתקן כלי |
| ט״ז קורע ותופר, קושר, צובע | shabbat/קורע ותופר · shabbat/פתיחת אריזות · shabbat/קושר ומתיר · shabbat/צובע |
| י״ז בעלי חיים | shabbat/בעלי חיים |
| י״ח זורע, קוצר, חורש | shabbat/זורע, קוצר וחורש |
| י״ט כותב ומוחק, קריאה ודיבור | shabbat/כותב ומוחק · shabbat/קריאה ודיבור בשבת |
| כ׳ חולה | health/חולה בשבת · health/תרופות · health/פיקוח נפש · health/מכשור רפואי |
| כ״א יולדת | health/יולדת בשבת |
| כ״ב הנאה מחילול שבת | shabbat/הנאה ממלאכת שבת · tech/מעליות ודלתות · tech/מצלמות וחיישנים |
| כ״ג אמירה לגוי | shabbat/אמירה לנכרי |
| כ״ד יציאת שבת, הבדלה, סעודה רביעית | shabbat/הבדלה · shabbat/מוצאי שבת |
| כ״ה ברכות | blessings/ברכה אחרונה · blessings/ברכת המוציא ומזונות |

## Output and self-check

Write ONLY a JSON array to `out-gNN.json`. Then run
`node <repo>/scripts/halacha/ong-shabbat/verify.mjs --book <book.json> out-gNN.json` and fix every ✗ until it
reports 0 errors (warnings "!" need a look, not necessarily a change). The verifier checks: the excerpt is verbatim;
no strong word the book does not use; the book's soft level kept; conditions not dropped; device items flagged;
chapters כ׳–כ״א high-stakes; no duplicate of a question already published in the app.
