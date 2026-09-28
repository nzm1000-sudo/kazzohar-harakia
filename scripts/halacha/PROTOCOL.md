# Protocol: Halacha Engine entries (Sephardic halacha, kazzohar-harakia app)

Your job: produce practical Q&A halacha entries, each grounded in ONE section of the licensed corpus
"קיצור שולחן ערוך ילקוט יוסף" (Rav Yitzhak Yosef; CC BY-NC-SA via Torat Emet — licensed for this free app).
You are given a JSON file of corpus sections: { id, section (siman title), n (halacha number), text }.

## Step 1 — which questions (web research, leads only)
Look at what people actually ask on Hebrew halacha Q&A sites for your topic (e.g. halachayomit.co.il, yeshiva.org.il
"שאל את הרב", dinonline.org, hidabroot.org, moreshet.co.il, kipa.co.il). Use them ONLY to learn which questions are
common and how people phrase them. NEVER copy answer text from those sites. You may record the URL of a page where the
question is asked in "askedOn" (0–2 URLs; real pages you actually opened).

## Step 2 — answer from the corpus only
For each question, find the corpus section that answers it and write the entry:
- "sectionId": the corpus id (e.g. "yalkut-yosef-15-5-5"). The app computes the siman/halacha reference from it —
  do NOT write any siman/seif yourself.
- "excerpt": VERBATIM contiguous span from that section's text (40–400 chars, no ellipses, no changes). It must contain
  the ruling the answer states. Checked mechanically.
- "shortAnswer": 1–2 plain Hebrew sentences, faithful to the excerpt, adding nothing (no extra conditions, no other
  opinions, no leniencies/stringencies not in the text). If the text has conditions, keep them. If it says "יש אומרים"
  / "נהגו" / "טוב" / "המחמיר", keep that level. Never state more certainty than the text.
- "question": natural Hebrew question as people ask it; "variants": 2–5 other phrasings/keywords people search.
- "ruleType": "din" (plain ruling), "minhag" (custom: נהגו/המנהג), "chumra" (stringency: המחמיר/טוב להחמיר/ראוי),
  "machloket" (the text itself presents disagreeing views). Only as the text supports.
- "topic" (Hebrew, e.g. "ברכות הנהנין"), "subtopic" (Hebrew), "tags" (Hebrew keywords, 3–8).
- "contexts": when this halacha is relevant — subset of:
  daily, weekday-morning, friday, shabbat, motzei-shabbat, erev-rosh-chodesh, rosh-chodesh, kiddush-levana, pesach-prep,
  pesach, chol-hamoed, omer, lag-baomer, shavuot, three-weeks, nine-days, tisha-bav, fast-day, elul, rosh-hashana,
  aseret-yemei-teshuva, yom-kippur, pre-sukkot, sukkot, hoshana-raba, simchat-torah, chanukah, tu-bishvat, adar, purim,
  yom-tov, meal, travel, home, life-cycle
- "timeOfDay": optional "morning" | "afternoon" | "evening" | "night" when the halacha belongs to a time.
- "id": kebab-case English, prefix given in your task, unique.

## Quality bar
Only practical, commonly needed halachot a Sephardic user would look up. Skip obscure, technical, or sensitive
(intimate) matters. One ruling per entry. No duplicates. Quality over quantity — but reach the target with good items.
Output ONLY a JSON array to the path given. Reply with the count, topics covered, and doubts.
