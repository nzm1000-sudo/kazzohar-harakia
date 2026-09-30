# Halacha — practical gaps (stage 6, 2026-09-30)

## Baseline
2,282 published answers in 12 of the 14 categories (prayer 212, blessings 220, Shabbat 1,081, holidays 411, kashrut 120,
family 93, health 78, tech 30, travel 26, daily 6, money 4, women 1; "בין אדם לחברו" and "טהרת המשפחה" had source
questions only). 1,380 answers quote Yalkut Yosef, 976 come from עונג שבת.

## Gap analysis
- **Critical / everyday, missing:** blessings when you move (room to room, outside, walking, the bathroom in between);
  pareve food fried in meat oil; a sharp vegetable cut with a meat knife; a spoon in a hot pot; bread or fish baked with
  meat; buying and selling (overcharging, backing out after a deposit, stolen goods, lottery for Sephardim, haggling);
  lost property; interest in words; asking forgiveness; honouring parents today (bus, phone, moving away, visits);
  mezuzah in real homes (small rooms, parking, lift, shelter, balcony, paint, a fallen mezuzah).
- **Thin categories:** money (4), between people (0), daily (6), women (1), travel (26), tech (30).
- **Hard to find although answered:** microwave at work, "בירכתי שהכל במקום מזונות", "טסתי לחו"ל", fried food in a meat
  pan — fixed with search phrasings on the existing answers (`src/data/halachaAliases.mjs`).
- **Search-language gaps:** צ'יפס/ציפס/צ׳יפס (geresh), "ביקורת" matched "ביקור" (a visit), colloquial openings
  ("אכלתי…", "שכחתי…", "הילד שלי…").
- **Seasonal:** Sukkot is well covered by the curated guide; no seasonal batch was needed now.
- **Open (modern, no verified source in the ruling line):** WhatsApp forwarding and screenshots, Google reviews, robot
  vacuum/mop, smartwatch, induction cooktop, charging before Shabbat, an extra item delivered by mistake, chips in a meat
  restaurant when the fryer is unknown — see `scripts/halacha/practical/needs-review.json`.

## What was added
74 new answers (kashrut 11, blessings 9, money 12, between people 7, family 21, prayer 5, women 6, travel 2, tech 1), each
from one Yalkut Yosef section, verified word for word, with conditions that change the law, related cases, search
phrasings, a dispute where the source has one, and provenance; 55 phrasings on 19 existing answers. Rule types: din 65,
minhag 3, machloket 5, chumra 1.

Semantic duplicates were merged, not added: a spicy dairy dish in a non-ben-yomo meat pot (same ruling as the existing
answer → phrasings only); a shared microwave (the existing microwave answer → phrasings only).

## Pipeline
`scripts/halacha/practical/batch-*.mjs` → `HALACHA_STAGE=practical node verify.mjs` → `HALACHA_STAGE=practical node
convert.mjs` → `src/data/halachaPracticalEntries.mjs`. Tests: `tests/halachaPracticalGaps.test.mjs`,
`tests/halachaSearchQuality.test.mjs`.
