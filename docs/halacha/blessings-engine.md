# מנוע הברכות החכם — sources, licences, rules, counts, limits

A category of the Siddur's **ברכות** family (Siddur home → ברכות → "מנוע הברכות החכם", route `siddur-brachot`).
One large search field; each result is a card with the food, **לפני** and **אחרי** side by side, the conditions,
what Yalkut Yosef says beside the book, and a source line. Everything works offline.

No ruling in the engine comes from memory or from a data provider. Every card is one of three kinds, and says which:

| Kind (badge) | What it is | Source line |
|---|---|---|
| **מן הספר** | A row of the blessing table of *עונג שבת* (chapter כ״ו), or a halacha of chapter כ״ה, in the book's words | `עונג שבת, פרק כ״ו (לוח ברכות), עמ׳ …` + "פתיחה בספר" |
| **לפי הכלל** | A food named by open data, to which exactly one category rule applies. The card says "לפי הכלל: …", lists the rule's conditions and "נקבע לפי כלל — מומלץ לברר במקרה של ספק" | the rule's sources (שו״ע / ילקוט יוסף / עונג שבת), plus "Open Food Facts (ODbL)" or "ויקינתונים (CC0)" for the name |
| **יש בזה דעות** | A food whose blessing depends on conditions or opinions the data cannot decide (mixtures, עיקר וטפל, rice and corn products, grain drinks, breakfast cereals, fruit of unknown plant…) — the conditions are shown, "לשאול רב" | as above |

## 1. Sources and licences

| Source | Used for | Licence / basis |
|---|---|---|
| *עונג שבת*, הרב ישראל שריקי, מהדורה ראשונה תשע״ג — chapter כ״ו "לוח ברכות" (pp. 277–295) and chapter כ״ה (pp. 274–276) | The 294 table rows, word for word; the shiurim (27 g in 7.5 min, 81 ml); sweet rolls; baked vs cooked/fried | By permission of the author (`sources/ong-shabbat/provenance.json`, rightsBasis `author-permission`). The table itself says: "המקור לכל הברכות נמצא בספר ילקוט יוסף… למעט היכן שכתוב מקור ליד הברכה" |
| Kitzur Shulchan Arukh **Yalkut Yosef** (Torat Emet, already in the app) | Rules; the ruling beside a book row; the Ashkenazi practice for matzah and sweet dough as Yalkut Yosef reports it | CC BY-NC-SA 2.5 (the app is free, no ads) |
| **Shulchan Arukh** Orach Chayim (Sefaria pack, already in the app) — simanim קס״ח, ר״ב–רי״ב | Category rules | Public Domain; quoted without niqqud |
| **Mishnah Berurah** (Hebrew Wikisource pack, already in the app) — קס״ח ס״ק ל״ג–ל״ד | The Ashkenazi rule for sweet dough | CC BY-SA |
| **Open Food Facts** — products sold in Israel (the official daily export, filtered on `countries_tags = en:israel`) | Product names, brands, categories, ingredient ids — never a blessing | Database: **ODbL 1.0**; contents: DbCL 1.0. Attribution is on the page and in `foods.json.gz`; the derived database (`public/blessings/foods.json.gz`, `sources/blessings/open-food-facts-israel.json.gz`) is offered under ODbL (share-alike) |
| **Wikidata** — food items with a Hebrew label, by food class | Names, Hebrew aliases, English label, class, "made from" | CC0 1.0 |

The example chart the owner sent (Achinu, "מה מברכים עלי?") was used for nothing but the idea of a searchable list.
The owner's cornflakes example was **not** used as a ruling: the book's own row says "אם הקורנפלקס עשוי מגרגירי תירס:
ברכתו האדמה. ואם הקורנפלקס עשוי מקמח תירס [הקורנפלקס המיוצר כיום בחברת תלמה, עשוי מקמח תירס] ברכתו שהכל / נפשות"
(p. 292, citing אור לציון ח״ב מ״ו מ״א) — and that is what the card shows. There is no "מזונות if made of wheat" line for
cornflakes in any source used; a wheat-based product called "cornflakes" goes to the conditional breakfast-cereal rule.

## 2. The table — extraction and verification

`scripts/halacha/blessings/extract_table.py` (PyMuPDF 1.26.5, PDF SHA-256 `52aa13af…2c6e2df5`, not stored in the repo):
the words come from the library's own visual-order extraction (`scripts/library/ong-shabbat/extract.py`); rows are cut
where the book cuts them — **every entry opens with the food's name in bold** (Caligraph-Medium), and a bold line that
follows a line ending in bold is the name wrapping. Output: `sources/ong-shabbat/blessing-table.json` (294 rows, each
with its letter, pages and its bold letters).

Checks (all in `tests/blessingsEngine.test.mjs`):
- each row's text equals the extraction; the name cut at the first dash is the bold name (294/294);
- all rows together equal the library's chapter כ״ו letter for letter (whitespace aside), and every row lies inside the
  library unit its "פתיחה בספר" opens;
- all 19 pages were rendered and compared with the row list by eye.

**Finding:** the book has **294** entries, not 283. The library pack (and the earlier audit) joined 11 pairs of rows into
one unit (e.g. "בורקס [בצק עלים] …" with the two בורקס rows after it; "וופל"/"ויטמינים מתוקים"; "כרובית"/"כרפס";
"קורנפלקס"/"קרמבו"). The words are all there; only the boundaries differ. The library was not changed here.

A row's **לפני / אחרי** are read only from its own words: a bare blessing word ("העץ / נפשות.") gives both; a last blessing
named once inside the book's condition ("כשאכל 27 גרם … יברך על המחיה") is taken only when the first blessing is certain;
otherwise the box says "לפי התנאים" and the book's words follow in full. 260 rows have both blessings as plain words or a
single named blessing; 34 carry conditions. Where the table gives no last blessing (בירה, לימון, שום, בוטן אמריקאי…) the
card says so and quotes the book's general rule (כ״ה, א–ב).

## 3. Rules (`src/data/blessings/rules.mjs`)

Every quotation is cut by the build from the text the app already carries (start/end anchors only; the test re-checks
each one): 79 quotations — Shulchan Arukh 18, Mishnah Berurah 2, Yalkut Yosef 54, *עונג שבת* ch. כ״ה 5. The
rules (status `rule` unless marked *conditional*):

| Rule | לפני / אחרי | Sources |
|---|---|---|
| bread | המוציא / ברכת המזון | ילקו״י קס״ח ב; שו״ע קס״ח ו; עונג שבת כ״ה ד (sweet bread differs) |
| sweet-bread | מזונות / על המחיה (Sephardi) · המוציא / בהמ״ז (Ashkenazi) | עונג שבת כ״ה ד; ילקו״י קס״ח י, ט״ז; שו״ע קס״ח ז; מ״ב קס״ח ל״ג–ל״ד |
| kisnin, dry-crackers | מזונות / על המחיה | ילקו״י קס״ח ז; עונג שבת כ״ה א, ג |
| grain-cooked | מזונות / על המחיה (even קביעת סעודה) | ילקו״י ר״ד כ״ב; שו״ע ר״ח ב; עונג שבת כ״ה ה |
| tree-fruit, dried-fruit | העץ / נפשות (seven species: על העץ) | שו״ע ר״ב א, ר״ז א, ר״ח א |
| vegetable, legume, pickled | האדמה / נפשות, with raw/cooked conditions | שו״ע ר״ה א, ר״ח ח; ילקו״י ר״ה א, ו |
| animal, dairy | שהכל / נפשות | שו״ע ר״ד א; ילקו״י ר״ד א; עונג שבת כ״ה א–ב |
| drink, plant-milk | שהכל / נפשות (81 ml) | שו״ע ר״ב ח, ר״ד ז; ילקו״י ר״ב י״ג, ר״ד ט |
| wine | הגפן / על הגפן, when mostly wine | שו״ע ר״ב א; ילקו״י ר״ב ט״ו, ר״ד ח |
| spirits, hot-drink | שהכל / none | ילקו״י ר״ב י״ט, ר״ז ו, ט |
| candy, gum, chocolate, ice-cream, jam | שהכל / … | שו״ע ר״ב ט״ו, רי״ב א; ילקו״י ר״ב כ״א, ר״ד ו, כ״א, ר״ז ח, י״ג |
| *fruit-plant* | העץ or האדמה by the plant; in doubt האדמה | שו״ע ר״ג ב (רמ״א); ילקו״י ר״ב ג |
| *nut, corn, rice, potato, breakfast-cereal, soup, grain-sweet, grain-drink, grape-drink, mixture* | the conditions from the sources; "יש בזה דעות — לשאול רב" | שו״ע ר״ד י״ב, ר״ח ב, ז, רי״ב א; ילקו״י per rule |

## 4. Open data → rule: how a food is placed (build time, deterministic)

`scripts/halacha/blessings/build.mjs` + `offRules.mjs`. For **Wikidata**: an item whose label (or alias) is a row of the
table only adds its names (Hebrew aliases, English label) to that row; otherwise its class maps to one rule
(`WD_CLASS_RULE`); two classes with different rules → `mixture`; a bread/pasta "made from" rice, corn, potato, teff,
buckwheat or chickpea → `mixture`; a sweet/dairy item whose name says fruit, nuts or grain → `mixture`; matzah and beer go
to their book rows. For **Open Food Facts**, in order: (1) left out — spices, sauces, oils, flour, supplements, spreads,
baby food, non-kosher; (2) a product whose name begins with a row that names a product (במבה, ביסלי, דוריטוס, קרמבו,
תפוצ'יפס…) *is* that row — unless it is coated or holds one of the five grains where the row does not; (3) its category,
with its ingredients where the rule depends on them (five grains / rice / corn; a chocolate with a wafer →
`grain-sweet`); (4) the head word of its Hebrew name (for the many products without categories); otherwise left out.
The card says which (`לפי שם המוצר` / `לפי הקטגוריה` / `לפי רכיבי המוצר` / `לפי סוג המאכל בוויקינתונים`).
Every product left out is listed with its reason in `sources/blessings/build-report.json`.

## 5. The reader's rite (`settings.nusach`)

Edot HaMizrach (default) reads the book as printed. **Ashkenaz, the Chassidic Sefard and Chabad** follow the Rema
(`ASHKENAZI_RITES`) and see a different ruling only where a source in the app states the Ashkenazi practice:
- **מצה [לא בפסח]**: המוציא / ברכת המזון — ילקוט יוסף קס״ח ד: "ומנהג האשכנזים לברך על המצה המוציא וברכת המזון בכל השנה";
- **לחמניות מתוקות / חלה מתוקה** and the sweet-bread rule: המוציא / ברכת המזון unless the sweetness is the main thing —
  ילקוט יוסף קס״ח ט״ז ("ולדעת הרמ״א מברכים עליה המוציא"), משנה ברורה קס״ח ל״ג–ל״ד;
- **פיצה שנילושה בחלב או עם שמן…**: same sources.

A Sephardi reader sees the Ashkenazi note as a quiet line; an Ashkenazi reader sees the book's (Sephardi) ruling beside it.

## 6. Yalkut Yosef beside the book

`YALKUT_BESIDE` (55 rows) links a row to the Yalkut Yosef section on the same food, with the relation **מסכים / מוסיף פרט /
פוסק אחרת** and the exact words, plus the app's question page that quotes it. Differences are shown, never hidden:
- **במבה** — the book: שהכל / נפשות; Yalkut Yosef ר״ג ו: "על ה''במבה'' מברכים בורא פרי האדמה… והרבה נהגו לברך עליו שהכל"
  (the app's question `hal-brachot-bamba` answers האדמה);
- **קרמבו** — the book: the biscuit eaten alone at the end → מזונות; Yalkut Yosef רי״ב ד: "…אינו מברך מזונות";
- **ורד מרוקח בדבש** — the book: שהכל; Yalkut Yosef ר״ג ז: "אפשר לברך עליו בורא פרי האדמה… אף שהמנהג לברך עליו שהכל";
- details added by Yalkut Yosef: שומשום בסוכר (the majority decides), אתרוג בסוכר (outer vs inner peel), חלקום (wheat
  starch → מזונות), שוקולד (a last blessing only when chewed), שניצל.

## 7. Counts (build of 2026-09-29)

| | Records |
|---|---|
| Book: table rows (verbatim, with page) | **294** (260 with both blessings, 34 with the book's conditions) |
| Book: halachot of chapter כ״ה as a food | 1 (לחמניות מתוקות / חלה מתוקה) |
| Open data, one rule applies ("לפי הכלל") | **2,478** (Wikidata 1,088 · Open Food Facts 1,390; 394 of them point to a book row) |
| Open data, conditional ("יש בזה דעות — לשאול רב") | **1,022** (Wikidata 617 · Open Food Facts 405) |
| Total searchable foods | **3,795** |
| Left out (reason recorded) | 1,980 (1,092 no rule applies; 379+62 not eaten on their own; 358 merged with the same name and answer; 74 the same as their book row; 10 not kosher; 5 not food) |

Open Food Facts lists 7,472 products sold in Israel; 3,765 have a Hebrew name; 1,795 cards remain after the steps above.
Wikidata gave 1,791 Hebrew-labelled items of 40 food classes; 1,705 cards (the rest joined book rows or were left out).

## 8. Size and offline

- `public/blessings/foods.json.gz` — **76 KB** (all open-data records), fetched once and cached by the service worker;
  bundled in the native app.
- `src/data/blessings/bookTable.mjs` — a lazy chunk, **~180 KB minified / ~26 KB gzip** in the build (the 294 rows, the chapter-כ״ה item, all
  79 quotations).
- The page, rules and search service are in the main bundle (a few KB).
- `sources/blessings/` (build inputs, not shipped): Wikidata 228 KB, Open Food Facts snapshot 117 KB gzip, build report.

## 9. Rebuild

```
# the table (PDF outside the repo; throwaway venv with pymupdf==1.26.5)
python scripts/library/ong-shabbat/extract.py <book.pdf> <lines.json>
python scripts/halacha/blessings/extract_table.py <book.pdf> <lines.json> sources/ong-shabbat/blessing-table.json
node scripts/halacha/blessings/fetch-wikidata.mjs sources/blessings/wikidata-foods.json
node scripts/halacha/blessings/fetch-open-food-facts.mjs sources/blessings/open-food-facts-israel.json.gz
node scripts/halacha/blessings/build.mjs
node --test tests/blessingsEngine.test.mjs
```

## 10. Limits

- Open-data names are as the contributors wrote them; categories are missing for most Israeli products, so most are
  placed by the head word of their name (shown on the card). A product can change its recipe; the card lists the rule's
  conditions so the reader can check the package.
- "Kosher" filtering is by name only (pork, shellfish…); kashrut certification is not checked.
- The book is Sephardi (Yalkut Yosef). Ashkenazi differences are shown only for matzah and sweet dough, where a source in
  the app states them; other Ashkenazi differences (e.g. בורא נפשות after hot coffee, noted in Yalkut Yosef ר״ז ו) are
  not modelled as rite changes.
- Wikidata classes are broad (its "soft drink" class holds yogurt drinks; "berry" holds grape varieties); such conflicts go
  to the conditional `mixture` rule rather than to a guess.
- No rabbinic review has been done yet (see the open questions in the hand-off report).

## 11. The "סיימתי" hook

`BlessingsEngine` accepts an optional `completionSlot(record)` prop — a **placeholder** for the journal/"סיימתי" feature
owned by another change. When passed, whatever it returns is rendered at the foot of each card; the page itself records
nothing. It is not wired in `NewApp.jsx`.
