# עונג שבת — deep audit, library import and Halacha Engine integration

Book: **עונג שבת · הלכות שבת**, הרב ישראל שריקי, מהדורה ראשונה תשע״ג (פתח דבר: "אור לאלול התשע״ג"; שער: "אלול תשע״ג,
פעיה״ק ירושלים"). 319 PDF pages, Adobe InDesign CS4, PDF SHA-256
`52aa13afd39c69d0728738bdf27426092b4a918290ed3605301d758c1c6e2df5` (7,224,617 bytes). Printed "כל הזכויות שמורות".
Used in the app **with the author's permission** (rights basis `author-permission`; §M). Audit date: 2026-09-29.

Everything below was measured on the extracted text, not assumed. Where a number comes from a script, the script is in
the repository (`scripts/library/ong-shabbat/`, `scripts/library/build-ong-shabbat.mjs`, `scripts/halacha/ong-shabbat/`).

---

## A. Executive summary

**What the book is.** A contemporary Sephardic digest of practical Shabbat halacha (chapters א׳–כ״ד), with a short
section on blessings (כ״ה) and an alphabetical blessing table (כ״ו). Every halacha is a short, titled ruling in plain
modern Hebrew, followed by a footnote ("מקורות וטעמים") that gives its source and, often, its reason. The author says in
his introduction (p. 12) that "שום דבר לא בדיתי מליבי ... ובפרט מרן ... רבי עובדיה יוסף ... וכן בנו הרה״ג הרב יצחק יוסף";
the notes bear this out: 388 of 958 notes cite the full ילקוט יוסף series, 227 חזון עובדיה, 51 הליכות עולם, 61 קיצור
שולחן ערוך ילקוט יוסף (§G). It is therefore placed under **ספרים › הלכה › פסיקה ספרדית** (`sephardic-psak`), beside
the Yalkut Yosef it summarises. The author also adds his own careful caveat (p. 13, "הבהרה"): realities change and a
specific case goes to a rabbi — which is exactly the app's policy for devices and high-stakes cases.

**Product value.** The app already had Yalkut Yosef (קיצור שו״ע, מהדורת תשס״ז) and ~1,300 verified entries built on it.
עונג שבת adds what a raw Yalkut Yosef search cannot give:

1. **The question people actually ask, already titled.** 748 of the 752 halachot carry a heading that *is* the everyday
   question ("נפל זבוב לכוס", "מגבונים לחים", "פלטה שכבתה", "לגו, קליקס, סברס", "מזגן אינוורטר", "דלת הנפתחת על ידי עין
   אלקטרונית"). Yalkut Yosef's sections are titled by siman ("הלכות בורר"); a user who types "מגבונים" rarely lands on the
   right se'if there.
2. **Modern objects and devices, by name.** Wet wipes, Lego, deodorant speed-stick, instant-coffee brands, Metarna,
   Shabbat clocks, modern (fan/no-frost) refrigerators, inverter air conditioners, LED indicator bulbs, intercoms,
   security cameras, card/fingerprint locks, GPS on the way to a birth, the "סילוקית" toilet pump, a "כוס הפלא" mug. Many
   of these are simply absent from the קיצור.
3. **A subject index of 944 terms** (pp. 296–312) — the author's own vocabulary for finding a halacha — now used as
   search aliases (933 of the 976 question records carry at least one index term).
4. **Source depth for free.** Each halacha's note names the exact volume/page of the full Yalkut Yosef, Chazon Ovadia,
   Halichot Olam, Shemirat Shabbat Kehilchata, etc., usually with the reason — the "why" that the app's short answers
   lacked. 66 of these citations now open the exact place in the app's Shulchan Arukh, Rambam or Talmud (§G).

**What was built (§N):** the whole book as a library work (752 halachot + the 283-food blessing table + the
introduction), its 958 footnotes as a separate anchored layer "מקורות וטעמים", and **976 question records** in the
existing Halacha Engine layer (751 of 752 halachot covered; one preface skipped), each with the book's exact words,
a derived short answer (except high-stakes), an explanation, conditions, a currentness flag, and — where Yalkut Yosef
answers the same matter — the Yalkut entry side by side. 1,215 tests pass (1,190 before + 25 new); `vite build` passes.

---

## B. Exact structure (verified, not assumed)

| Pages | Content | In the app |
|---|---|---|
| 1 | שער: עונג שבת · הלכות שבת · ישראל שריקי · אלול תשע״ג | — |
| 2 | Imprint: "כל הזכויות שמורות · מהדורה ראשונה תשע״ג", layout credits, distribution phone numbers | recorded in provenance only |
| 3 | שער ההסכמות: 8 approbations listed | the list is in provenance |
| 4–11 | The 8 approbation letters (מרן הרב עובדיה יוסף, הרב יצחק יוסף, הרב שלמה משה עמאר, הרב אליהו בקשי דורון, הרב יעקב ישראל איפרגאן, הרב שלום ארוש, הרב יעקב שכנזי, הרב אלחנן שלום אלגרוד) | **image only — no text layer**; not imported |
| 12–18 | פתח דבר (46 paragraphs, incl. "הבהרה", "מזמור לתודה", signed "אור לאלול התשע״ג") | node 27 "פתח דבר" |
| 19–36 | תוכן עניינים (920 items, 905 numbered) | not shown (the app builds its own); used to verify every heading |
| 37 | Part title "הלכות שבת, פרקים א׳–כ״ד" | — |
| 38–271 | Chapters א׳–כ״ד | nodes 1–24 |
| 272 | blank | — |
| 273 | Part title "דיני ברכות, פרקים כ״ה–כ״ו" | — |
| 274–276 | Chapter כ״ה דיני ברכות | node 25 |
| 277–295 | Chapter כ״ו לוח ברכות: an opening note + 283 foods in 21 letter groups (א׳–ת׳) | node 26 |
| 296–312 | מפתח עניינים מפורט (944 entries, two columns) | search vocabulary, each entry linked to its halacha |
| 313–318 | Dedications (להצלחת, לרפואת, לעילוי נשמת — names of private persons) | not imported (§O) |
| 319 | blank | — |

**Hierarchy.** Chapter → section (60 sections and sub-sections: e.g. chapter י׳ has "סוגי המוקצה ודינם" with five
numbered sub-sections "1. כלי שמלאכתו לאיסור" … "5. בסיס לדבר האסור", then "דיני ביטול כלי משימושו") → numbered
halacha (א׳, ב׳ …; the numbering restarts at each section and continues through sub-sections) → optional sub-headings
inside a halacha (39, e.g. "ג'חנון" inside הטמנה ה׳, "סעודת מצוה"/"סעודת פורים" inside יום השישי י׳) → paragraphs →
footnote markers. Footnotes are numbered **1–958 continuously through the whole book**; every one is referenced exactly
once, in order (checked).

| פרק | כותרת | עמודים | מדורים | הלכות | הערות (מקורות וטעמים) | רשומות שאלה |
|---|---|---|---|---|---|---|
| א' | דיני יום השישי | 38–45 | 1 | 22 | 31 | 35 |
| ב' | דיני הטמנה | 46–52 | 1 | 18 | 25 | 27 |
| ג' | דיני קבלת שבת | 53–63 | 3 | 36 | 44 | 51 |
| ד' | דיני בורר | 64–76 | 1 | 38 | 54 | 49 |
| ה' | דיני סוחט | 77–87 | 3 | 34 | 46 | 39 |
| ו' | דיני קידוש היין | 88–99 | 4 | 37 | 47 | 51 |
| ז' | דיני נטילת ידיים ובציעת הלחם | 100–114 | 6 | 48 | 61 | 65 |
| ח' | דיני הדחת כלים | 115–118 | 1 | 13 | 16 | 15 |
| ט' | דיני בישול | 119–130 | 1 | 26 | 40 | 51 |
| י' | דיני איסור מוקצה | 131–148 | 8 | 49 | 60 | 57 |
| י"א | דיני השמעת קול | 149–159 | 2 | 26 | 35 | 37 |
| י"ב | דיני משחקי ילדים | 160–168 | 1 | 40 | 46 | 43 |
| י"ג | דיני רחיצה | 169–180 | 4 | 39 | 56 | 54 |
| י"ד | דיני ניקיון הבית | 181–191 | 2 | 35 | 47 | 42 |
| ט"ו | דיני עשיית אוהל | 192–203 | 2 | 48 | 54 | 56 |
| ט"ז | דיני קורע ותופר | 204–212 | 3 | 29 | 32 | 35 |
| י"ז | דיני בעלי חיים | 213–216 | 1 | 13 | 19 | 18 |
| י"ח | דיני זורע | 217–221 | 3 | 16 | 16 | 19 |
| י"ט | דיני כותב ומוחק | 222–232 | 2 | 44 | 51 | 50 |
| כ' | דיני חולה | 233–243 | 3 | 47 | 54 | 51 |
| כ"א | דיני יולדת | 244–249 | 1 | 17 | 25 | 24 |
| כ"ב | דיני הנאה מחילול שבת | 250–257 | 2 | 20 | 31 | 34 |
| כ"ג | דיני אמירה לגוי בשבת | 258–264 | 2 | 24 | 28 | 28 |
| כ"ד | דיני יציאת השבת והבדלה | 265–271 | 2 | 26 | 31 | 35 |
| כ"ה | דיני ברכות | 274–276 | 1 | 7 | 9 | 10 |
| כ"ו | לוח ברכות | 277–295 | 21 | 283 ערכים | 0 | — |

(Chapter titles are the book's first section title; e.g. chapter י״א "דיני השמעת קול" also holds the section "דיני שימוש
במוצרי חשמל", and chapter כ׳ has the sections "חולה שאין בו סכנה" and "חולה שיש בו סכנה".)

**Printed irregularities (kept as printed, recorded in `sources/ong-shabbat/provenance.json`):**
- p. 63: halachot כ״ד–כ״ז (נר חנוכה ביום שישי) are numbered inline in the text, without title lines.
- p. 238: heading "כ״ב תחבושת על דם" is printed without the period after its number.
- Some headings print a letter without its geresh ("ד", "י", "א"–"ה" in chapter י״א) — the value is unambiguous.
- p. 187: a blank line inside a sentence ("סמרטוט / או מגבון") — kept as a paragraph break, as printed.
- The table of contents (p. 33) lists "יולדת – עמ׳ 244" under chapter כ׳ without a "פרק כ״א" line; the body (p. 244) has
  "פרק כ״א · דיני יולדת".
- The subject index has 7 references that point to the wrong halacha or page (e.g. "גלגליות – 161 \ ח׳" is ז׳; "נקע –
  238 \ כ״ב" is כ״ג; "סעודה שלישית – לא אכל קודם השקיעה – 10 \ ג׳"): each is resolved to the halacha its words name and
  listed in `indexErrata`; the printed index is not altered.
- The book states one ruling twice: taking the tea bag out of the cup (ד׳ כ״ה and ט׳ ח׳); it has one question record.
- Two tea rulings a reader may want side by side: ט׳ ב׳ (tea *leaves* are forbidden in a כלי שני) and ט׳ ח׳ (a tea *bag*
  in a כלי שני: "מעיקר הדין מותר, וטוב להחמיר") — both kept exactly as written.

**How the text was extracted.** The PDF stores each line's glyphs out of logical order (line-final punctuation first,
digit runs reversed, niqqud after the following letter, spurious spaces inside letters). `extract.py` rebuilds every
line from glyph positions (right to left), restores LTR digit runs, attaches the 95 niqqud marks to their letters,
keeps superscript footnote numbers as markers, and splits the two index columns. `structure.py` classifies lines by
font and size (body 12pt Caligraph, bracketed asides 10pt, headings 16pt Medium, sections 24pt, notes 10pt Lotus under
"מקורות וטעמים"), detects paragraph breaks from baselines (a line with a raised note number gets ~3pt extra leading —
measured and allowed for), and anchors notes by marker. Pages 47, 63, 121 and 187 were rendered and compared by eye.
Only normalisation: lines joined with one space, justification spaces collapsed, 26 stray U+0007 characters removed;
footnote markers moved from the words into offsets. **No word was changed.** The run is reproducible: running the
repository scripts on the PDF gives the recorded SHA-256 of the lines (`b8b35bd6…`) and of the structure (`1d779f1a…`).

---

## C. Corpus counts

| Measure | Count |
|---|---|
| Pages | 319 (text pages imported: 12–18, 38–271, 274–295) |
| Chapters | 26 (א׳–כ״ד Shabbat, כ״ה blessings, כ״ו blessing table) |
| Sections and sub-sections | 60 |
| Numbered halachot | 752 (748 with a title line; 4 numbered inline) |
| Sub-headings inside halachot | 39 |
| Footnotes (מקורות וטעמים) | 958, numbered 1–958; 827 name the edition year of the work they cite |
| Blessing-table entries | 283 (37 printed in bold; 45 carry their own source in brackets) |
| Subject-index entries | 944 (716 distinct halachot reached) |
| Table-of-contents items | 920 (905 numbered) — each found under the same number in its chapter |
| Introduction paragraphs | 46 |
| Words | halachot 34,899; notes 21,290 |
| Characters | halachot 185,276; notes 109,004 |
| Library units stored | 1,079 (752 halachot + 284 table rows + 43 introduction paragraphs) + 958 notes |

---

## D. Topic taxonomy (from the book's own sections and headings)

- **א׳ יום השישי** — shopping for Shabbat; ovens and pots (meat/dairy/fish); separating challah; tasting the food and its
  blessing; eating on Friday (סעודת מצוה, סעודת פורים); work on Friday afternoon (סופר סת״ם, washing machine,
  sprinklers); haircut; mikveh for men; שניים מקרא (also on festivals); tefillin forgotten; setting the table.
- **ב׳ הטמנה** — blankets on pots before and on Shabbat; eggs, kokie bags and ג'חנון in the chamin; crock-pot; electric
  oven (return conditions, ovens whose element responds to the door); gas and electric hobs; plata; urn on a Shabbat
  clock; thermos; baby bottle; "קל חם"; aluminium foil.
- **ג׳ קבלת שבת, הדלקת נרות, נר חנוכה ביום שישי** — תוספת שבת; מנחה after accepting Shabbat; asking others after
  accepting early; candle time (20 min / 10 min), who lights, a blind woman, electric light as נר שבת (filament/starter),
  number of candles, blessing before lighting (Sephardic), guests, hotels, the Kotel, immersion night; Chanukah on Friday.
- **ד׳ בורר** — the three conditions (אוכל מתוך פסולת, ביד, לאלתר); mixtures, nuts, fruit salad, clearing the table,
  garbage, fridge storage, rotten fruit, grapes, washing leafy vegetables, lemon pips, lemon in a net, straining fruit,
  dates and olives, melon seeds, a fly in a cup, tins of cucumbers/corn/tuna, olive holders, cheese nets, kettle strainer,
  mint in a strainer, tea bags, soup, bones (plate/fish), chicken skin, slotted ladle, rice in a salt cellar, cream,
  skin on milk, separating an egg, icing sugar, water filters, cutlery, sink strainer.
- **ה׳ סוחט, הכנת סלט, לישה וטוחן** — squeezing fruit and lemons (never with a squeezer), lemonade, draining fried food,
  wet wipes, wetting toilet paper; peelers, graters, garlic crusher, egg slicer, onion chopper, chopping fine, seasoning,
  mayonnaise, egg/cabbage/avocado/tahini/eggplant/liver/hilbe salads, charoset; biscuit crumbs, mixing, chocolate balls,
  jelly, mashing banana for a baby, crumbs for birds.
- **ו׳ קידוש** — obligation, joy, when to make it, early kiddush, red wine, disposable cup, a chipped cup, standing or
  sitting, holding the cup (gloves, a cast), water in the wine, covering the challot, intention, swallowing words, "ברוך
  הוא וברוך שמו", women, children, a blind person, a Shabbat-violating host or kiddush-maker, forgotten kiddush; tasting
  the wine; drinking/eating before kiddush (a woman, a weak or sick person, a child); no wine; kiddush במקום סעודה
  (mezonot, fruit, beer), delay, kiddush for others.
- **ז׳ נטילה, סעודה, זמירות, סעודה שלישית, מים אחרונים** — disposable cup, electric hand-dryer, sensor toilets; talking
  between washing and המוציא; challot (sweet challot, order of cutting); meat on a dairy table/cloth; meal times and
  quantities (כביצה, 7.5 min); fish then meat; weighing food; diet; תענית הראב״ד; Tu Bishvat; cake, wafers, pickles,
  compote, gum, ice cream in the meal; zemirot (a woman singing); סעודה שלישית (time, after mincha, a woman, רצה);
  מים אחרונים.
- **ח׳ הדחת כלים** — sponges, steel wool, gloves, dish soap, the dishwasher (on a clock; loading it), soaking, sink
  plug, washing for Shabbat / after סעודה שלישית, baby bottles and teats, towels.
- **ט׳ בישול** — כלי ראשון/שני/שלישי, spices, hard-boiled eggs, pouring on drops, **hot drinks** (black coffee, coffee
  with cardamom, instant coffee plain/flavoured/granulated, cocoa, Materna/Similac, tea, tea leaves, mint), lemon in tea,
  cold milk in hot coffee, instant noodles and soup nuts, "מנה חמה", baby bottle, salt into a pot, adding water, moving
  a pot, opening the lid, **reheating on the plata** (dry, mostly dry, fish, chamin, schnitzel, liquid), soup on a plata
  that will turn on, returning a pot, a plata that went off, dairy on the plata.
- **י׳ מוקצה** — touching, sitting on a car, moving by hand / from the side / by the body, a camera on the balcony,
  clearing shells; כלי שמלאכתו לאיסור (definition, moving it, tefillin, a penknife, keys, cigarettes, a bus card, a
  ladder, an oven); כלי שמלאכתו להיתר (vases, mezuzah, raw meat, raw eggs, a hat, disposable cups, magnets, a drain
  cover, a fan, exercise); מחמת חיסרון כיס (passports, cheques, IDs, cameras, phones); מחמת גופו (money in a pocket,
  a stone as a doorstop, a loose handle, a bin); בסיס; putting muktzeh on another's or a husband's item; carrying a
  passport safely; ביטול כלי משימושו.
- **י״א השמעת קול, מוצרי חשמל** — alarm clocks, soda maker, door bells, knockers; the Shabbat clock (conditions,
  extending, advancing, forgetting), Yom Tov on Friday, the simple fridge, a forgotten fridge bulb, the modern fridge,
  water coolers, lamps/heaters/radiators/fans, inverter AC, the urn's indicator bulb, humidifiers, the Shabbat lift and
  escalators, electric blankets, hearing aids, television, intercom, security cameras (public and building), card and
  fingerprint locks.
- **י״ב משחקי ילדים** — age limits and a crying child; balls, table tennis, bikes, tricycles, scooters, skates, noisy
  toys, springs, trains, Lego/Clicks/Sabres, walkers, dominoes, chess, rummy, snowmen, bead necklaces, swings,
  hammocks, gogoim, balloons, air mattresses, pumps, skipping and tag, paper folding, marbles, five stones, a broken
  electric toy, puzzles, plasticine, cutting games, stickers, whistles and rattles, whiteboards, Rubik's cube, soap
  bubbles, Monopoly, dice, card games, Kapla, the 15-puzzle, educational comics, a broken doll, tidying toys.
- **י״ג רחיצה, שיניים, קוסמטיקה, שיער** — hot water (boiler / solar heater), hoses, washing, a baby's bath, sauna, a
  woman's immersion on Friday night, men's mikveh; toothpaste, toothpicks, floss, mouth spray, denture powder; make-up,
  nails, skin, deodorant, perfume, speed-stick, insect repellent, creams, soap, baby cream, massage; combing, braids,
  hair clips, gel, dandruff, lice.
- **י״ד ניקיון הבית, בגדים** — carpets, disinfectants, bleach, toilet brushes, ants, the "סילוקית" pump, electric
  water pumps, windows, cobwebs, sweeping, spills, floors, beds, laundry baskets; brushing clothes, shoes (synthetic,
  leather, fabric), folding, dust, hats, stains, soaking, hanging washing, drying near a heater, a dryer, buttons,
  safety pins, drawstrings, zips and Velcro, labels, new socks, hanging on a tree.
- **ט״ו אוהל, בונה ומתקן** — cot sheets, pram hoods, curtains, partitions, a tallit over children, umbrellas and parasols,
  folding furniture, sukkah covers, awnings, drawers; Sefer Torah, pram conversions, wheels, trays, teats, bottle
  sterilising, buckles, sewn pockets, cups, contact lenses, glasses, lecterns, ice cubes and ice cream, milk bags, cans,
  drink cans, bent forks, knives, hooks, a squeaking door, shutters, a wobbly table, AC drip, a blocked sink, concrete
  curing, mechanical and automatic watches, binoculars, folding a tallit, staples, tissues, napkins, leaflets.
- **ט״ז קורע ותופר, קושר ומתיר, צובע** — nappies, plasters, sticky bookmarks, dog-ears, coffee jars, food wrappers,
  plastic tablecloths, foil, toilet paper, "איגלו"; knots (tzitzit, shoelaces, ties, headscarves, roast chicken, cream
  cups, cable ties, champagne/wine/drink bottles, bin bags); dyeing (paprika, toilet blocks, photochromic glasses, blood
  on toilet paper).
- **י״ז בעלי חיים** — feeding animals and a street dog, aquariums, a dead fish, parrots, puppies and chicks, walking
  the dog, a guide dog, fishing, worms, mousetraps, insect sprays and zappers, ants.
- **י״ח זורע, קוצר, חורש** — washing hands over grass, urinating on grass/soil, a tap that waters the garden, flowers in
  water, sprouting an avocado; smelling growing fruit, cutting herbs, walking on grass, pushing a pram, climbing trees;
  pushing a pram on soil, spitting.
- **י״ט כותב ומוחק, קריאה ודיבור** — writing in sand or on a misty window, marks in a book, embossed soles, letters on
  page edges or ark doors, a cake with letters, the "כוס הפלא", washing letters off hands, tearing through letters,
  combination locks; weekday talk, accounts, what may be said, notice boards, rosters, guest lists, invitations, letters,
  phone books, bus timetables, street signs, contracts and bills, traffic tickets, music, cookbooks, diet sheets,
  catalogues, albums, newspapers, proof-reading, maths, lost property, shop windows, gifts, waiting at the bus stop,
  running, weighing oneself.
- **כ׳ חולה** — שאין בו סכנה (medicines, painkillers, antibiotics, Acamol/aspirin, cutting/crushing pills, sleeping
  pills, vitamins, insulin, fertility injections, sore throat, constipation, diarrhoea, baby teething gel,
  thermometers, blood-pressure gauges, dry eyes, drops, colds, iodine, bandages, sprains, pus, splinters, oil, back
  pain, massage, talc, hot-water bottles, humidifiers, light that disturbs sleep, meat and milk, kiddush for the sick);
  שיש בו סכנה (hurry to break Shabbat, internal injury, high fever, a baby's fever, bites and stings, dislocation, X-ray,
  eye infection, toothache, how to call, driving to a doctor, accompanying the doctor).
- **כ״א יולדת** — from when Shabbat is broken for her, the ninth month, candles, contractions, car or ambulance, who
  accompanies her, children at home, GPS, locks/alarm/remote/car light, stopping, signalling, headlights, the engine,
  contractions that stopped, going home, epidural, signing, calling the nurse, excess milk, an angry nursing mother, a
  premature baby.
- **כ״ב הנאה מחילול שבת** — laundry done on Shabbat, cooking at dusk, deliberate/unintentional cooking, restaurants,
  eggs in the chamin, the pot itself, eating at non-observant parents, selling, an army vehicle; light switched on
  (intentionally / not / for a Jew / stairwell), AC or fan switched on, rooms whose light or AC starts automatically, a
  night-light, an electronic-eye door, a neighbour's radio, power cuts, a gas leak.
- **כ״ג אמירה לגוי** — the rule, dusk, hints and stories, notes, a short circuit, a plata left unplugged, a stairwell
  light, benefit, soup on the plata, stringencies, work for after Shabbat, ordering a taxi, the stock market, relatives
  abroad, a dishwasher; in distress (car/shop alarms, flickering fluorescent tubes, a locked door, a boiler, AC or fan,
  a wedding meal in the dark, a garage); for a mitzvah (power cut in the synagogue or yeshiva).
- **כ״ד יציאת השבת, הבדלה, סעודה רביעית** — end of Shabbat and רבנו תם, work before havdalah, dressing children, eating,
  havdalah by phone/radio, a disposable cup, how much to drink, a woman, sitting, order, water, the candle, an electric
  bulb, glasses, a blind person, switching off the light, one who missed the gefen, havdalah in shul, no wine, missed
  havdalah, Shabbat clothes, Tisha b'Av on Motzaei Shabbat; the fourth meal (time, bread, hot drinks, a hot bath, women),
  Shabbat ending mid-meal, וידוי on Motzaei Shabbat.
- **כ״ה ברכות** — מעין שלוש on mezonot and on drinks, קביעת סעודה on mezonot (sweet rolls, which cakes, noodles and
  couscous), eating without reaching the amount, how amounts are measured.
- **כ״ו לוח ברכות** — 283 foods, first and last blessing, with amounts and times where they matter (27 g in 7.5 min,
  81 ml), and 45 entries with their own source.

---

## E. Q&A potential — built vs possible

| | Count |
|---|---|
| Halachot in chapters א׳–כ״ה | 752 |
| Covered by at least one question record | **751** (1 skipped: י׳ א׳, the preface defining מוקצה and its reasons — no practical ruling) |
| Question records built | **976** (151 halachot hold several distinct rulings and have 2–7 records, e.g. בורר א׳ — the three conditions — has 7) |
| Published "from the book" (short answer beside the book's words) | **697** |
| Published with the technology/reality note | **196** |
| Source-only, rabbi route (high-stakes) | **83** |
| Needs review (failed the gate) | 0 |
| Records with conditions / explanation / Yalkut parallel | 500 / 531 / 89 |
| Aliases per record (average) | 3.7 natural variants + 4.6 keywords, plus the book's own index terms (933 records) |
| Rule type | din 906 · chumra 56 · minhag 10 · machloket 4 |
| Categories | shabbat 819 · health 78 · blessings 34 · tech 29 · kashrut 12 · holidays 4 |

**Not built, possible:** the **blessing table** (283 foods) could become 283 exact "מה מברכים על X?" records (first and
last blessing, amounts) — very high value and mechanically exact, but it overlaps the existing Yalkut blessing entries
(e.g. banana, rice) and needs a decision on duplicates (§O). The introduction is not practical halacha.

**Highest value** (everyday, device-era, not in the קיצור by name): בורר in the kitchen (ד׳), hot drinks and the plata
(ט׳), children's games (י״ב), cosmetics and hair (י״ג), clothes and cleaning (י״ד), building/fixing household items
(ט״ו), electrical devices (י״א), benefit from a light or AC switched on (כ״ב), asking a non-Jew (כ״ג), havdalah (כ״ד).
**Lower value / rarer:** fishing and animal traps (י״ז), sowing and ploughing (י״ח), proof-reading and maths (י״ט),
תענית הראב״ד (ז׳), כתב סת״ם work on Friday (א׳).

---

## F. Search value — headings and index as vocabulary

- Every record's question is written the way people ask; its variants add objects, actions and situations ("מגבון לח",
  "טישו רטוב", "הילד רוצה לשחק בלגו בשבת"); its keywords add the melacha (בורר, מבשל…).
- **The book's own index** gives 944 terms that a reader would look up ("אקמול", "אינטרקום", "אזיקונים", "קנקומט",
  "סילוקית", "איגלו", "גוגואים", "ספיד סטיק"). Each is linked to its halacha (7 printed misreferences corrected in the
  link only) and added to that halacha's records as aliases and search keywords.
- **Ranking in the existing engine** (no second engine): a book halacha is weighted ×1.18 when the question is asked
  about Shabbat ("…בשבת"), ×0.8 when Shabbat is not named (it stands beside the general answers), and ×0.75 when it is a
  particular case the user did not ask about — its question names someone the user did not (גוי, ילד, חולה, יולדת…), a
  rare word the user did not use, or it lacks the user's most specific word. A guided flow (e.g. "אפשר לחמם מרק?") keeps
  asking what changes the ruling unless the user asked exactly the book's question.

**The owner's examples** (automated in `tests/ongShabbat.test.mjs`; "first book result" = first עונג שבת record among the
answers the engine judges to be about the question):

| Query | Lands on | Also shown |
|---|---|---|
| מותר מגבונים? | ה׳ ו׳ מגבונים לחים (עמ׳ 79) | Yalkut: hal-shabbat-baby-wipes (first) |
| נפל זבוב לכוס | ד׳ י״ח נפל זבוב לכוס (עמ׳ 70) | — |
| המקרר מדליק אור | י״א (מוצרי חשמל) ד׳ מקרר פשוט (עמ׳ 153) | ה׳ שכח לכבות את נורת המקרר, ו׳ מקרר חדיש |
| הפלטה נכבתה | ט׳ כ״ה פלטה שכבתה (עמ׳ 129) | the "חימום אוכל" guided flow is offered first |
| ילד רוצה לשחק בלגו | י״ב י׳ לגו, קליקס וסברס (עמ׳ 162) | Yalkut: hal-basic2-lego-kids |
| אפשר לקחת אקמול? | כ׳ ה׳ אקמול, אספירין (עמ׳ 234) — **book's words + rabbi, no derived answer** | Yalkut: qa-medicine-shabbat |
| הדלת נפתחת עם חיישן | כ״ב י״ז דלת הנפתחת על ידי עין אלקטרונית (עמ׳ 255) | — |
| מותר לומר לגוי להדליק מזגן? | כ״ג כ׳ הדלקת מאוורר ומזגן על ידי גוי (עמ׳ 263) | Yalkut: hal-shabbat-nochri-air-conditioner (first) |
| איך מחממים מרק? | ט׳ כ״א לחמם תבשיל שרובו רוטב על הפלטה (עמ׳ 128) | Yalkut: baby-bottle warming |

Where the book is silent (robot vacuum, charging an electric car, a smartwatch) no book record is judged to be about the
question (tested): the engine says so rather than stretching a neighbouring halacha.

---

## G. Source network — what the notes cite, and what can be linked

Counts are notes (of 958) that name the work at least once.

| Work cited | Notes | In the app? | Linkability | Implemented |
|---|---|---|---|---|
| ילקוט יוסף — the full series (שבת, איסור והיתר, מועדים, ברכות…; editions תשנ״ב–תשע״ג, cited by volume/page) | 388 | No (only the קיצור, תשס״ז) — in the acquisition queue as PERMISSION_REQUIRED | MANUAL_REVIEW (a קיצור section on the same matter can often be found; no page mapping) | Yalkut sections offered for study on each question page (search, not a link) |
| חזון עובדיה | 227 | No (PERMISSION_REQUIRED) | TEXT_ONLY | — |
| שמירת שבת כהלכתה | 85 | No | TEXT_ONLY | — |
| שולחן ערוך (אורח חיים) | 65 | Yes (bundled pack) | EXACT_LINKABLE where siman **and** se'if are named; LIKELY where "שם" or siman only | **57 exact links** |
| קיצור שולחן ערוך ילקוט יוסף (cited edition תשס״ו, by page) | 61 | Yes, edition תשס״ז (by siman/se'if) | LIKELY_LINKABLE (different edition, page-based citation) | — |
| הליכות עולם | 51 | No (PERMISSION_REQUIRED) | TEXT_ONLY | — |
| Oral rulings ("הורה לי הרה״ג…", "כך הורה", "כן פסק") | 33 | — | TEXT_ONLY | — |
| משנה ברורה | 18 | No | TEXT_ONLY (LIKELY via Sefaria later) | — |
| מנוחת אהבה | 17 | No | TEXT_ONLY | — |
| מנוחה שלמה | 16 | No | TEXT_ONLY | — |
| אור לציון | 15 | No | TEXT_ONLY | — |
| רמב״ם | 13 | Yes (Mishneh Torah packs) | EXACT where "הלכות שבת פרק X הלכה Y" | **5 exact links** |
| הרב יצחק יוסף / נכד הגר״ע, בשיעור | 13 | — | TEXT_ONLY | — |
| כף החיים (סופר) | 12 | Remote (Sefaria, live) | LIKELY_LINKABLE (siman/ot; cannot be verified offline) | — |
| השבת והלכותיה · ארחות שבת · מקרא קודש (הרב בייפוס) | 12 each | No | TEXT_ONLY | — |
| רמ״א | 11 | Inside the Shulchan Arukh pack (הגה) | via the SA link when siman/se'if given | (counted above) |
| יחוה דעת | 9 | No (PERMISSION_REQUIRED) | TEXT_ONLY | — |
| בן איש חי | 8 | Yes (pack) | LIKELY_LINKABLE (שנה/פרשה/אות → paragraph mapping not verified) | — |
| ילקוט יוסף — אוצר דינים לאשה ולבת | 7 | No | TEXT_ONLY | — |
| הזוהר / שער הכוונות / האר״י | 5 | Zohar yes; others no | MANUAL_REVIEW (cited by parasha only) | — |
| יביע אומר · מגן אברהם · שולחן שלמה · שיבת ציון · אשרי האיש · תלמוד בבלי | 4 each | Talmud yes (reader); others no | Talmud EXACT (tractate/daf/amud) | **4 exact links** |

Every implemented link was checked to exist in the bundled edition (siman ≤ 697 and se'if ≤ the siman's count; perek and
halacha in the Rambam pack; amud inside the tractate), and three were read against the target text (e.g. note 158 →
שו״ע או״ח ש״כ, ו: "מותר לסחוט לימונים"). In chapter א׳ (ovens, meat, milk and fish) a siman is linked only if the note
says "אורח חיים", since those notes may mean Yoreh De'ah. Links are listed by note in `src/data/ongShabbatLinks.mjs`
and shown under "מקורות וטעמים" on each question page.

---

## H. Currentness audit (a flag, not a ruling)

| Class | Records | Meaning in the app |
|---|---|---|
| STABLE_CLASSICAL_RULE | 504 | Short answer beside the book's words |
| LIKELY_CURRENT | 193 | Same |
| TECHNOLOGY_REVIEW_NEEDED | 164 | Same, plus: "הספר נכתב בשנת תשע״ג, וייתכן שהטכנולוגיה או המציאות השתנו מאז. מומלץ לברר עם רב לגבי מכשירים בני זמננו." |
| REALITY_DEPENDENT | 32 | Same note (products, manufacture, public facilities) |
| HIGH_STAKES_REVIEW | 83 | No derived answer; the book's words and a rabbi (§I) |

| פרק | STABLE | LIKELY | TECH | REALITY | HIGH_STAKES |
|---|---|---|---|---|---|
| א' דיני יום השישי | 30 | 2 | 3 | 0 | 0 |
| ב' דיני הטמנה | 7 | 6 | 13 | 1 | 0 |
| ג' דיני קבלת שבת | 37 | 2 | 12 | 0 | 0 |
| ד' דיני בורר | 35 | 11 | 3 | 0 | 0 |
| ה' דיני סוחט | 29 | 8 | 0 | 2 | 0 |
| ו' דיני קידוש היין | 44 | 2 | 0 | 3 | 2 |
| ז' דיני נטילת ידיים ובציעת הלחם | 55 | 6 | 4 | 0 | 0 |
| ח' דיני הדחת כלים | 8 | 2 | 2 | 3 | 0 |
| ט' דיני בישול | 26 | 4 | 12 | 9 | 0 |
| י' דיני איסור מוקצה | 29 | 14 | 13 | 1 | 0 |
| י"א דיני השמעת קול | 0 | 0 | 36 | 0 | 1 |
| י"ב דיני משחקי ילדים | 11 | 25 | 7 | 0 | 0 |
| י"ג דיני רחיצה | 25 | 21 | 5 | 1 | 2 |
| י"ד דיני ניקיון הבית | 28 | 8 | 5 | 1 | 0 |
| ט"ו דיני עשיית אוהל | 17 | 32 | 6 | 1 | 0 |
| ט"ז דיני קורע ותופר | 16 | 18 | 0 | 0 | 1 |
| י"ז דיני בעלי חיים | 9 | 5 | 1 | 2 | 1 |
| י"ח דיני זורע | 13 | 4 | 2 | 0 | 0 |
| י"ט דיני כותב ומוחק | 30 | 13 | 3 | 4 | 0 |
| כ' דיני חולה | 0 | 0 | 0 | 0 | 51 |
| כ"א דיני יולדת | 0 | 0 | 0 | 0 | 24 |
| כ"ב דיני הנאה מחילול שבת | 9 | 4 | 19 | 1 | 1 |
| כ"ג דיני אמירה לגוי בשבת | 10 | 3 | 13 | 2 | 0 |
| כ"ד דיני יציאת השבת והבדלה | 27 | 2 | 5 | 1 | 0 |
| כ"ה דיני ברכות | 9 | 1 | 0 | 0 | 0 |

Where the 2013 facts matter most:
- **Refrigerators** (י״א ד׳–ו׳): the book itself distinguishes "old" fridges (motor fully off) from "modern" ones
  (fans, indicator bulbs) and says each owner should check with an expert. Models have changed since; kept as TECH.
- **LED indicator bulbs** (כ״ב ט׳–ט״ו, ג׳ י׳, כ״ד י״ד): several leniencies rest on "a lamp without a filament or starter
  (כגון מנורת לד)"; the book adds that most ACs in Israel have LEDs. Worth a rabbinic check against today's devices.
- **Platas and urns** (ב׳, ט׳): the rulings assume a plata without heat adjustment; adjustable, thermostatic and timer
  platas exist today. Records that depend on the device are TECH.
- **Electric ovens** (ב׳ ז׳): ovens whose element responds to the door — the book tells everyone to check their oven.
- **Security cameras, electronic-eye doors, card/fingerprint locks, intercoms, lifts, hearing aids, GPS** (י״א, כ״ב,
  כ״א): TECH.
- **Products** (REALITY): instant-coffee and cocoa brands (the author phoned the makers' rabbis, notes 333–334), wet
  wipes, deodorants (gel speed-stick per an oral ruling), pasteurised wine (ו׳), bus timetables, taxis, the "סילוקית"
  pump (the author phoned the maker).

---

## I. High-stakes areas

- **Chapter כ׳ חולה (47 halachot, 51 records)** and **כ״א יולדת (17, 24 records)**: every record is HIGH_STAKES_REVIEW.
- Elsewhere, 8 records were marked high-stakes because the case is medical or dangerous: ו׳ כ״ט (a pill before
  kiddush), ו׳ ל׳ (a weak or sick person before kiddush), י״א (מוצרי חשמל) י״ג (a humidifier for a patient), י״ג
  (מניקור וקוסמטיקה) י״ב-b (cracked skin — medicine on Shabbat), י״ג (מניקור וקוסמטיקה) ט״ו-b (massage for someone
  bedridden), ט״ז (צובע) ד׳ (blood that is hard to stop), י״ז ט׳ (worms in a child), כ״ב כ׳ (a gas leak).
- **What the app shows:** the book's exact words (with page and chapter), a fixed note — "בשאלות של חולה, יולדת,
  תרופות ותינוקות אין כאן הכרעה למקרה אישי: לשון הספר מובאת כלשונה, ולהכרעה פונים לרב." — and the rabbi-question
  draft. No derived answer, no personalised adjudication. The conversation module and the grounded-answer API return
  "refer-to-rabbi" with the book's citation and excerpt.
- **Danger:** where the halacha itself says to act at once, its own words are shown as "במצב של סכנה — כלשון הספר":
  כ׳ ל״ה — "ואסור להתמהמה ולהתרשל בחילול שבת לחולה שיש בו סכנה, והזריז לחלל שבת במקום של פיקוח נפש, הרי זה משובח."
  Other danger halachot (a baby's fever כ׳ ל״ח, bites and stings כ׳ ל״ט, the first three days after birth כ״א ב׳) say
  Shabbat is broken for the person; they do not say "act at once" in so many words, so nothing was added (§O).

---

## J. Data model

**Library pack** `public/library/packs/author-permission-ong-shabbat/` (gzip; checksum-verified like every pack):
- `Oneg_Shabbat.json.gz` — nodes 1–26 (chapters) and 27 (פתח דבר). A halacha unit:
  `{ id: "Oneg_Shabbat.4.18", n: 18, label: "י\"ח", title: "נפל זבוב לכוס", head?: "section · sub-section", text,
  sh?: [sub-heading paragraph indexes], em?: [bold paragraph indexes], fn?: [[note, offset], …], p: [70] }`.
  `text` holds the book's words only (paragraphs separated by "\n"); footnote numbers are offsets, not characters.
  The blessing table: one unit per food with its letter as `head`.
- `Oneg_Shabbat_Notes.json.gz` — the layer "מקורות וטעמים": node per chapter, a unit per note:
  `{ id, n, fn: 126, v: 18, vl: "י\"ח", text, p }` (`v` = the halacha it is anchored to).
- `Oneg_Shabbat_Notes.anchors.json.gz` — 958 anchor records (`anchorScheme: "footnote-marker"`).
- Registry: `src/data/library/corpus/ongShabbat.mjs` (generated), work `Oneg_Shabbat` (category `halacha`, group
  `sephardic-psak`, `tabNames: { source: "לשון הספר", commentary: "מקורות וטעמים" }`, attribution = the credit line) and
  the layer-only work `Oneg_Shabbat_Notes` (relation `commentary` → `Oneg_Shabbat`; read beside the book, not listed).
- Provenance: `sources/ong-shabbat/provenance.json` — rights, PDF SHA-256, extraction method and hashes, page map,
  chapter table, anomalies, index errata, redactions, per-unit and per-note SHA-256.

**Question records** `src/data/ongShabbatQa.mjs` (generated by `scripts/halacha/ong-shabbat/convert.mjs`):
`{ id, unit, chapter, n, chapterLabel, label, title, section, pages, question, variants, keywords, indexTerms,
shortAnswer | null, conditions, explanation, excerpt, dangerExcerpt?, ruleType, currentness, currentnessNote,
publication, contexts, category, topic, notes, unitHash, answerStatus, yalkutParallels? }`.
In `practicalHalachaQa.mjs` each becomes an ordinary engine entry: `sources[0] = { work: "עונג שבת", localSourceId:
"ong-shabbat-4-18", ref: "Oneg_Shabbat.4.18", route: "books/r/Oneg_Shabbat/4/18", sourceType: "local-ong-shabbat",
citation: "פרק ד׳, הלכה י״ח (נפל זבוב לכוס) · עמ׳ 70", excerpt, notes }`, plus `sourceBook, bookPlace, explanation,
currentness, publication, techNote, highStakes, dangerExcerpt, yalkutParallels, unitHash, reviewBasis:
"mechanical-extraction-check", rabbinicReview: "pending"`. A high-stakes entry's `shortAnswer` is only the routing
sentence ("לשון הספר מובאת כאן כלשונה. במקרה אישי של חולה, יולדת או תרופה — פונים לרב.") and is never matched as content.

**The gate** `src/services/ongShabbatGate.mjs` (used by the drafting verifier, the converter and the tests): excerpt
verbatim; no אסור/חייב/מצוה unless the book's words use it; "מותר" never becomes "מצוה"; a soft level
(טוב/ראוי/נכון/יש להחמיר/המחמיר/נוהגים/לכתחילה) is kept; a condition clause (אם/רק/אלא/בתנאי/ובלבד/דווקא/כל זמן/
במקום צורך/בדיעבד/לכתחילה) is not dropped; an excerpt naming a modern device is never published as a stable rule;
chapters כ׳–כ״א are high-stakes; the explanation may not use a strong word that neither the halacha nor its notes use.

---

## K. Integration with the existing engine (no parallel engine)

- **One layer.** The records join `PRACTICAL_HALACHA_QA`; `publishedPracticalQuestions()`, search, the relevance gate,
  related halachot, the daily/for-now picks (high-stakes excluded as `personal`), topics and categories, favourites,
  collections, the rabbi-question draft and the knowledge graph all see them with no special path.
- **Search** (`halachaSearch.mjs`): the book weighting of §F; a high-stakes routing sentence is never used as
  matching content; a small fix found on the way — "מרק" was being dropped as "מ+רק".
- **Intent** (`halachaIntent.mjs`): a guided flow is decided by the general answers; a book halacha replaces it only for
  its exact question.
- **Grounded answer** (`halachaAgent.mjs`): a high-stakes book halacha returns `refer-to-rabbi` with its citation,
  excerpt and (where present) the book's danger words; a model's quote from the book is accepted only if verbatim in
  the retrieved excerpts.
- **Conversation** (`ai/halachaConversation.mjs`): high-stakes first → rabbi route with the book's words; a Shabbat
  halacha of the book is never the answer to a "מה מברכים על…" question unless it is a blessing halacha.
- **Graph** (`halachaGraph.mjs`): a `book:ong-shabbat` node; sections labelled by their own book; `answeredAlsoIn`
  edges to the Yalkut parallels.
- **Question page** (`HalachaLibrary.jsx` → lazy `OngShabbatParts.jsx`): "תשובה קצרה" (or the high-stakes note and
  danger words), the technology note, "לשון הספר" with chapter/halacha/page and a button to the halacha in the book,
  "הסבר" (marked as not a quote), "מקורות וטעמים" (from the pack, offline, with exact links), "באותו עניין בילקוט
  יוסף" side by side (both texts; no claim of agreement or dispute), Yalkut sections for study, the credit line. A Yalkut
  entry's page shows the book's halacha side by side in the same way.
- **Library reader** (`LibraryPage.jsx`): titled halachot with the printed page, paragraphs and sub-headings, raised
  footnote numbers, the tabs "לשון הספר | מקורות וטעמים", notes grouped under "הלכה י״ח", the credit line without a
  licence link. The About page lists the book under "ספרים באישור מחבריהם".
- **Offline:** the question layer is in the bundle; the book and notes are packs (bundled in the native app; cached on
  the web); the notes on a question page load from the pack.

---

## L. Sample halachot (37, across the requested areas)

Each: place (chapter, section, halacha, page), the book's exact words, the note(s) on it, the canonical question and
its aliases, conditions, the short answer and its safety check, currentness, category, and what review it needs.

### בורר

**1. נפל זבוב לכוס** — פרק ד׳, דיני בורר, הלכה י״ח, עמ׳ 70 · `ong-4-18`
- לשון הספר: "כוס משקה שנפל בתוכו צרעה או זבוב, מותר להסירו בשבת בידו או על ידי כפית, כי אין ברירה בלח, וטוב להחמיר להוציאו עם מעט משקה. והמיקל להוציאו גם בלי משקה יש לו על מי לסמוך."
- מקורות וטעמים: הערה 126: חזון עובדיה שבת כרך ד' עמוד רל"ב הלכה כ"ג. מהדורת תשע"ב. המהריט"ץ סובר שאין ברירה בלח, אך הט"ז [סימן שי"ט סעיף קטן י"ג, וסימן תק"ו סעיף קטן ג'] חולק ואוסר ברירה בלח, ומצר…
- שאלה קנונית: נפל זבוב לכוס בשבת, מותר להוציא אותו?
- ניסוחים נוספים: זבוב נפל לכוס · צרעה נפלה למשקה · להוציא חרק מהשתייה בכפית · ממפתח הספר: זבוב נפל לכוס
- תנאים: —
- תשובה קצרה: מותר להסיר את הזבוב ביד או בכפית. טוב להחמיר ולהוציאו עם מעט משקה, והמיקל להוציאו בלי משקה יש לו על מי לסמוך.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין בורר קלאסי
- קטגוריה: shabbat / בורר · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**2. ברירת עצמות מתוך דגים** — פרק ד׳, דיני בורר, הלכה כ״ח, עמ׳ 73 · `ong-4-28`
- לשון הספר: "האוכל דגים שיש בהם עצמות, רשאי להוציא את העצמות תוך כדי אכילתו. כלומר, יתחיל לאכול את הדג, וכשיגיע לעצמות שמפריעות לו, יוציא אותן בידו או במזלג וימשיך לאכול. אבל העצמות שנפרדו מהדגים או מהבשר, לא יבררם לסלקם, אלא יניחם בצלחת. ולצורך ילד קטן מותר להוציא תחילה את העצמות, ואחר כך להאכיל אותו בדג או בבשר, כפי שרגילים תמיד."
- מקורות וטעמים: הערה 140: ילקוט יוסף שבת כרך ג' עמודים ש' הלכה ל"ז ועמוד ש"א הלכה ל"ח. מהדורת תשנ"ג. לברור את העצמות דרך אכילה, מותר. אבל העצמות שנפרדו מהדג, אסור לברורם כיון שזו מלאכת בורר ולא דר…
- שאלה קנונית: מותר להוציא עצמות מהדג בשבת?
- ניסוחים נוספים: עצמות דגים · להוציא עצמות מדג לילד קטן · לנקות דג מעצמות לפני שאוכלים · ממפתח הספר: עצמות דגים
- תנאים: —
- תשובה קצרה: רשאי להוציא את העצמות תוך כדי אכילה, כשמגיע אליהן, ביד או במזלג. עצמות שכבר נפרדו לא יברור לסלקן אלא יניחן בצלחת. לצורך ילד קטן מותר להוציא תחילה את העצמות ואחר כך להאכילו.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין בורר קלאסי
- קטגוריה: shabbat / בורר · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**3. הוצאת שקית התה מהכוס** — פרק ד׳, דיני בורר, הלכה כ״ה, עמ׳ 72 · `ong-4-25-a`
- לשון הספר: "מותר להוציא בשבת את שקית התה שהונחה בכוס מים חמים."
- מקורות וטעמים: הערה 135: ילקוט יוסף שבת כרך ג' עמוד רפ"ו הלכה כ"ז. מהדורת תשנ"ג. לפי סברת המהריט"ץ שבדבר גוש הצף על פני דבר לח וניכר בפני עצמו, לא שייך דין בורר, שבקלות יכול להוציאו.
- שאלה קנונית: מותר להוציא את שקית התה מהכוס בשבת?
- ניסוחים נוספים: שקית תה- הוצאתה מהכוס · תיון- הוצאתו מהכוס · להוציא את התיון מהתה · ממפתח הספר: שקית תה- הוצאתה מהכוס · תיון- הוצאתו מהכוס
- תנאים: —
- תשובה קצרה: מותר להוציא בשבת את שקית התה שהונחה בכוס מים חמים.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין בורר קלאסי
- קטגוריה: shabbat / בורר · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)


### סוחט

**4. מגבונים לחים** — פרק ה׳, דיני סוחט, הלכה ו׳, עמ׳ 79 · `ong-5-6`
- לשון הספר: "מותר לקנח בנחת בכל סוגי המגבונים בין לקטן ובין למבוגר. והמחמיר לקנח במגבוני נייר תבוא עליו ברכה."
- מקורות וטעמים: הערה 162: חזון עובדיה שבת כרך ד' עמוד קמ"ח הלכה כ'. מהדורת תשע"ב. ולעניין ההיתר גם לגדולים עיין בתשובה של מרן רבינו עובדיה יוסף שליט"א, שכתב בכתב יד קודשו שבנחת יש להתיר גם לגדולים…
- שאלה קנונית: מותר להשתמש במגבונים לחים בשבת?
- ניסוחים נוספים: מגבונים לתינוק בשבת · לנקות תינוק במגבון לח בשבת · מגבון לח למבוגר בשבת · טישו רטוב בשבת · ממפתח הספר: מגבונים לחים
- תנאים: הקינוח בנחת
- תשובה קצרה: מותר לקנח בנחת בכל סוגי המגבונים, לקטן ולמבוגר. המחמיר לקנח במגבוני נייר תבוא עליו ברכה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: REALITY_DEPENDENT — מגבונים לחים הם מוצר מודרני שהרכבו ואריזתו עשויים להשתנות
- קטגוריה: shabbat / סוחט · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### בישול

**5. הכנת שתיה חמה בשבת** — פרק ט׳, דיני בישול, הלכה ח׳, עמ׳ 121–123 · `ong-9-8-c`
- לשון הספר: "מותר להכינו בשבת על ידי עירוי של מים רותחים מהמיחם לתוך הכוס שבו נמצא הקפה נמס, מכיון שאבקת הקפה נמס מבושלת, ואין בישול לאחר בישול."
- מקורות וטעמים: הערה 333: חזון עובדיה שבת כרך ד' עמוד שי"ג הלכה ד'. מהדורת תשע"ב. שוחחתי עם הרב של חברת עלית ועם הרב של חברת אסם והסבירו לי את התהליך של הקפה וסוגי הקפה נמס ומוצרי הגלם. ולגבי הקפה…
- שאלה קנונית: מותר לשפוך מים רותחים מהמיחם על נס קפה בשבת?
- ניסוחים נוספים: קפה נמס בשבת · נס קפה רגיל בשבת · להכין נס קפה ישר מהמיחם · קפה נמס · ממפתח הספר: מטרנה · מי נענע · נס קפה · סימילאק · קפה נמס · קפה שחור · שוקו · שתיה חמה- הכנתה · תה
- תנאים: —
- תשובה קצרה: מותר להכין קפה נמס רגיל בשבת על ידי עירוי מים רותחים מהמיחם לתוך הכוס שבה הקפה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו) · אזהרה: בהלכה יש דרגת "טוב/המחמיר" מחוץ לקטע המצוטט (נבדק: שייכת לרשומה אחרת של אותה הלכה או שאינה דרגת פסק)
- עדכניות: REALITY_DEPENDENT — תלוי בתהליך הייצור של הקפה הנמס כפי שבירר המחבר
- קטגוריה: shabbat / בישול · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**6. מהו כלי שני** — פרק ט׳, דיני בישול, הלכה ב׳, עמ׳ 119 · `ong-9-2-b`
- לשון הספר: "וכלי זה אינו מבשל אפילו דברים רכים שהם קלי הבישול ואפילו כשהוא חם בחום שהיד סולדת בו, ומותר למזוג מים קרים לתוך כוס מים רותחים, אך ביצה ועלי תה אסור להניחם בכלי שני כיון שהם מתבשלים בו."
- מקורות וטעמים: הערה 326: הליכות עולם כרך ד' עמוד מ"ט הלכה י"א. מהדורת תש"ס.
- שאלה קנונית: מותר לשים ביצה או עלי תה בכוס של מים רותחים שמזגו מהמיחם?
- ניסוחים נוספים: עלי תה בכלי שני · להכניס ביצה לכוס מים חמים בשבת · לשים נענע או עלי תה בכוס מים מהמיחם · ביצה בכלי שני · ממפתח הספר: כלי שני
- תנאים: —
- תשובה קצרה: לא. ביצה ועלי תה אסור להניחם בכלי שני, כי הם מתבשלים בו, אף שכלי שני אינו מבשל שאר דברים.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין בישול קלאסי
- קטגוריה: shabbat / בישול · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**7. חימום בקבוק חלב של התינוק** — פרק ט׳, דיני בישול, הלכה י״ג, עמ׳ 124 · `ong-9-13`
- לשון הספר: "מותר בשבת לשפוך מים חמים מהמיחם על בקבוק חלב של תינוק בצדו החיצון, כדי לחמם את החלב, וכל שכן שמותר לשים את הבקבוק בתוך מים רותחים הנמצאים בכלי שני [כגון: קערה, סיר] ואין בזה משום הטמנה."
- מקורות וטעמים: הערה 344: ילקוט יוסף שבת כרך ג' עמוד קס"ח הלכה ל'. מהדורת תשנ"ג. ואף שעירוי מכלי ראשון מבשל כדי קליפה, כאן הקליפה היא בקבוק הפלסטיק.
- שאלה קנונית: איך מחממים בקבוק חלב לתינוק בשבת?
- ניסוחים נוספים: לשפוך מים חמים על בקבוק של תינוק · לשים בקבוק תינוק בקערה עם מים חמים · בקבוק חלב של תינוק – חימומו · לחמם תמ"ל בשבת · ממפתח הספר: בקבוק חלב של תינוק- חימומו
- תנאים: —
- תשובה קצרה: מותר לשפוך מים חמים מהמיחם על הצד החיצוני של בקבוק החלב כדי לחמם אותו, וכל שכן שמותר לשים את הבקבוק בתוך מים רותחים שבכלי שני, כמו קערה או סיר, ואין בזה משום הטמנה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: LIKELY_CURRENT — דין עכשווי של בקבוק פלסטיק; אינו תלוי במכשיר
- קטגוריה: shabbat / חימום אוכל בשבת · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)


### פלטה

**8. לחמם תבשיל שרובו רוטב על הפלטה** — פרק ט׳, דיני בישול, הלכה כ״א, עמ׳ 128 · `ong-9-21-a`
- לשון הספר: "תבשיל מבושל שרובו רוטב, [כגון: מרק וכדומה], אסור לחממו על גבי הפלטה בשבת. אך אם הפלטה כבויה ועתידה להידלק לאחר זמן על ידי השעון שבת [שכוון לפני שבת], יכול להניח בשבת את התבשיל הנוזלי על גבי הפלטה כשהיא כבויה."
- מקורות וטעמים: הערה 358: חזון עובדיה שבת כרך ד' עמוד שמ"ח הלכה י"ג. מהדורת תשע"ב. כיון שיש איסור בישול אחר בישול בדבר נוזלי. ולשים על גבי פלטה כבויה מותר כי אינה מלאכה אלא גרמא.
- שאלה קנונית: מותר לחמם מרק על הפלטה בשבת?
- ניסוחים נוספים: מרק – חימומו על הפלטה בשבת · לשים סיר מרק על הפלטה · תבשיל שרובו רוטב על הפלטה · לשים מרק על פלטה כבויה שתידלק בשעון שבת · איך מחממים מרק בשבת? · ממפתח הספר: מרק- חימומו על הפלטה בשבת
- תנאים: רק כשהפלטה כבויה ועתידה להידלק על ידי שעון שבת שכוון לפני שבת
- תשובה קצרה: אסור לחמם על הפלטה בשבת תבשיל מבושל שרובו רוטב, כמו מרק. אבל אם הפלטה כבויה ועתידה להידלק בשעון שבת שכוון לפני שבת, יכול להניח עליה את התבשיל כשהיא כבויה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי בפלטה ובשעון שבת
- קטגוריה: shabbat / פלטה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**9. החזרת התבשיל לפלטה** — פרק ט׳, דיני בישול, הלכה כ״ד, עמ׳ 129 · `ong-9-24`
- לשון הספר: "הלוקח סיר מעל הפלטה בשבת שיש בו רוב רוטב, [כגון: מרק], מותר להחזירו לפלטה כל עוד התבשיל חם בחום שהיד סולדת בו [יד סולדת: נמנע מלאוכלם או לשתותם מרוב חומם], אפילו שהניחו על גבי הקרקע או השיש. אולם תבשיל יבש או רובו יבש, מותר להחזירו, אפילו שהצטנן."
- מקורות וטעמים: הערה 362: ילקוט יוסף שבת כרך א' עמוד ק"ג הלכה ט'. מהדורת תשנ"ב. כיון שאין לחוש למחזי כמבשל מאחר ואין דרך לבשל בפלטה. ובתבשיל יבש מותר להחזירו לפלטה כיון שאין בישול לאחר בישול ביבש.
- שאלה קנונית: הורדתי סיר מרק מהפלטה בשבת – מותר להחזיר אותו?
- ניסוחים נוספים: להחזיר סיר לפלטה בשבת · הנחתי את הסיר על השיש – אפשר להחזיר? · חזרה של תבשיל יבש לפלטה · החזרת התבשיל לפלטה
- תנאים: תבשיל שרובו רוטב – רק כל עוד היד סולדת בו
- תשובה קצרה: סיר שרובו רוטב, כמו מרק, מותר להחזיר לפלטה כל עוד התבשיל חם בחום שהיד סולדת בו, אפילו אם הניחו על הרצפה או על השיש. תבשיל יבש או שרובו יבש מותר להחזיר אפילו אם הצטנן.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — ההיתר להניח או להחזיר על הפלטה בשבת נשען על כך שפלטת שבת אינה דרך בישול; בפלטות חדישות עם ויסות, טיימר או מתגים יש לברר
- קטגוריה: shabbat / פלטה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**10. פלטה שכבתה** — פרק ט׳, דיני בישול, הלכה כ״ה, עמ׳ 129–130 · `ong-9-25`
- לשון הספר: "פלטה שהונח עליה סיר של מרק מבושל וכבתה, ועדיין המרק חם בחום שהיד סולדת בו [יד סולדת: נמנע מלאוכלם או לשתותם מרוב חומם], מותר להעביר את הסיר לפלטה חשמלית אחרת, ואם התבשיל המבושל שבסיר יבש [כגון: אורז, תפוחי אדמה וכדומה], אפילו הצטנן לגמרי, מותר להעביר את הסיר לפלטה חשמלית אחרת."
- מקורות וטעמים: הערה 363: חזון עובדיה שבת כרך ד' עמוד שצ"ד הלכה כ"ד. מהדורת תשע"ב. כיון שכל עוד היד סולדת בו אין בישול לאחר בישול.
- שאלה קנונית: הפלטה כבתה בשבת – מותר להעביר את הסיר לפלטה אחרת?
- ניסוחים נוספים: פלטה שכבתה · הפלטה התקלקלה בשבת · להעביר מרק לפלטה אחרת · פלטה נכבתה באמצע השבת · ממפתח הספר: פלטה שכבתה
- תנאים: מרק – רק כשעדיין היד סולדת בו
- תשובה קצרה: אם המרק עדיין חם בחום שהיד סולדת בו, מותר להעביר את הסיר לפלטה חשמלית אחרת. ואם התבשיל יבש, כמו אורז ותפוחי אדמה, מותר להעבירו אפילו אם הצטנן לגמרי.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — ההיתר להניח או להחזיר על הפלטה בשבת נשען על כך שפלטת שבת אינה דרך בישול; בפלטות חדישות עם ויסות, טיימר או מתגים יש לברר
- קטגוריה: shabbat / פלטה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### מוקצה

**11. טלטול מוקצה מחמת חיסרון כיס** — פרק י׳, דיני איסור מוקצה, הלכה כ״ט, עמ׳ 140 · `ong-10-29`
- לשון הספר: "מוקצה מחמת חיסרון כיס אסור לטלטלו בשבת אפילו לצורך גופו או מקומו. לצורך גופו: היינו שרוצה להשתמש בכלי עצמו לדבר המותר [לדוגמא: שהמפה שעל השולחן זזה מחמת הרוח ורוצה להניח עליה מצלמה בכדי שלא תזוז, אסור להניחה על המפה]. ולצורך מקומו: היינו אפילו אם צריך את המקום שהמוקצה מונח עליו [לדוגמא: שהמגהץ מונח על הריצפה, והוא רוצה את המקום שעליו מונח עליו המגהץ מחמת שהוא מפריע לילדים לשחק בריצפה, אסור להרים אותו מהריצפה ולהעבירו למקום אחר בידו, אלא בגופו, כגון: לדחפו ברגלו]. וכל שכן שאסור לטלטלו מהשמש לצל [כגון שהמצלמה נמצאת במרפסת וחושש שתיהרס, אסור לו לטלטלה לביתו]."
- מקורות וטעמים: הערה 398: חזון עובדיה שבת כרך ג' עמוד פ"ט הלכה א' ובהערה א'. מהדורת תשע"א.
- שאלה קנונית: המגהץ מונח על הרצפה ומפריע לילדים, מותר להרים אותו בשבת?
- ניסוחים נוספים: להזיז מצלמה או פלאפון שמפריעים · מוקצה מחמת חיסרון כיס לצורך מקומו · להניח מצלמה על המפה שלא תעוף · להכניס מצלמה מהמרפסת בשבת · ממפתח הספר: דרכון- טלטולו · מצלמה- טלטולה · פלאפון- טלטולו · צ'קים- טלטולם · תעודת זהות- טלטולה
- תנאים: —
- תשובה קצרה: מוקצה מחמת חיסרון כיס אסור לטלטלו אפילו לצורך גופו או מקומו, וכל שכן מהשמש לצל; אם הוא מפריע על הרצפה, לא ירימנו בידו אלא יזיזנו בגופו, כגון ברגלו.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — הדוגמאות הן מגהץ ומצלמה
- קטגוריה: shabbat / מוקצה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**12. פתרונות לטלטל מוקצה** — פרק י׳, דיני איסור מוקצה, הלכה מ״ה, עמ׳ 146–147 · `ong-10-45-a`
- לשון הספר: "ולכן הרוצה לטלטל בשבת או בחג דרכון או כסף במקום שחושש שיגנבו לו אותם, יכול להכניסם ביחד וליתנם בשקית ובתוך השקית ישים עלון של דברי תורה או תיקון הכללי וגם סוכריות לכבוד שבת או החג, וטוב להכניס את השקית בתוך הכיס הפנימי של החליפה או בכיס האחורי של המכנסיים [ולא בכיס של החולצה] ואז הכיס לא הופך להיות בסיס אפילו אם הניח את השקית בכיס לפני שבת בכוונה, ומידי פעם יוציא סוכריה ויאכלנה או יקרא את התיקון הכללי, [וטוב לשים את הסוכריות בשקית נפרדת וליתנם בתוך השקית בכדי שיוציא בקלות סוכריה ולא יצטרך בכל פעם לגעת במוקצה]."
- מקורות וטעמים: הערה 417: ילקוט יוסף שבת כרך ב' עמוד שמ"ו הלכה י"ב. מהדורת תשנ"ב. טעם ההיתר: זהו בסיס לדבר האסור והמותר, והמותר חשוב יותר שזה העלון או הסוכריות [שזהו צורך שבת], כמו שכתב מרן בשולחן…
- שאלה קנונית: איך אפשר לטלטל דרכון או כסף בשבת כשחוששים שייגנבו?
- ניסוחים נוספים: פתרון לטלטול דרכון בשבת · לשים כסף בשקית עם סוכריות · לקחת דרכון בחג במלון · שקית עם עלון תורה וכסף · ממפתח הספר: דרכון- פתרונות לטלטלו · כסף- פתרונות לטלטלו
- תנאים: הפתרון נוגע רק לאיסור מוקצה, ולא לאיסור הוצאה מרשות לרשות · לא בכיס החולצה · טוב לשים את הסוכריות בשקית נפרדת בתוך השקית
- תשובה קצרה: יכול לשים אותם בשקית יחד עם עלון דברי תורה או תיקון הכללי וסוכריות לכבוד שבת, וטוב לשים את השקית בכיס הפנימי של החליפה או בכיס האחורי של המכנסיים; ומדי פעם יאכל סוכריה או יקרא בתיקון.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: LIKELY_CURRENT — פתרון מעשי; אינו תלוי במכשיר
- קטגוריה: shabbat / מוקצה · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**13. נגיעה במוקצה** — פרק י׳, דיני איסור מוקצה, הלכה ב׳, עמ׳ 131 · `ong-10-2`
- לשון הספר: "איסור מוקצה הוא בטלטולו ולא בנגיעה בו, ולכן מותר לנגוע במוקצה אם אינו מזיזו על ידי נגיעתו, כגון: לשבת על אבנים גדולות, וכן על מכונית בשבת שידוע לו בבירור שהאזעקה אינה פועלת ברכב זה, ואפילו אם מזיז את המוקצה קצת על ידי ישיבתו, מותר כיון שזה טלטול כלאחר יד [שמטלטלו בשינוי]. וכן מותר לטלטלו על ידי ניפוח בפיו."
- מקורות וטעמים: הערה 366: ילקוט יוסף שבת כרך ב' עמוד שט"ו הלכה ד', עמוד שי"ז הלכה ה, עמוד שכ"ב. הלכה ו'. מהדורת תשנ"ב.
- שאלה קנונית: מותר לשבת על אבן גדולה או על מכונית בשבת?
- ניסוחים נוספים: מותר לגעת במוקצה בשבת? · לשבת על האוטו בשבת · נגיעה בחפץ מוקצה בלי להזיז אותו · מותר להזיז מוקצה בנשיפה? · ממפתח הספר: מוקצה- נגיעה בו · מכונית- ישיבה עליה
- תנאים: על מכונית: רק כשידוע לו בבירור שהאזעקה אינה פועלת ברכב זה
- תשובה קצרה: מותר לגעת במוקצה כשאינו מזיזו, כגון לשבת על אבנים גדולות, ועל מכונית רק כשידוע בבירור שהאזעקה אינה פועלת בה. ואפילו אם הוא זז מעט בישיבתו מותר, וכן מותר להזיזו בנשיפה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — הישיבה על מכונית תלויה במערכת האזעקה של הרכב
- קטגוריה: shabbat / מוקצה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### חשמל

**14. מקרר פשוט** — פרק י״א, דיני שימוש במוצרי חשמל, הלכה ד׳, עמ׳ 153 · `ong-11-9`
- לשון הספר: "מותר לפתוח את דלת המקרר החשמלי בשבת לאחר שהוציאו או ניתקו את המנורה לפני שבת. מכל מקום ראוי ונכון שלא לפתחו אלא בשעה שהמנוע פועל."
- מקורות וטעמים: הערה 437: הליכות עולם כרך ד' עמוד ע"א הלכה כ"ד. מהדורת תש"ס.
- שאלה קנונית: מותר לפתוח מקרר פשוט בשבת אחרי שהוציאו את הנורה?
- ניסוחים נוספים: לפתוח מקרר ישן בשבת · נורת המקרר בשבת · לפתוח מקרר רק כשהמנוע עובד · מקרר פשוט · המקרר מדליק אור כשפותחים את הדלת · ממפתח הספר: מקרר פשוט
- תנאים: רק אחרי שהוציאו או ניתקו את המנורה לפני שבת · ראוי ונכון לפתוח רק כשהמנוע פועל
- תשובה קצרה: מותר לפתוח את דלת המקרר החשמלי בשבת אחרי שהוציאו או ניתקו את המנורה לפני שבת, ומכל מקום ראוי ונכון לפתוח רק בשעה שהמנוע פועל.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — מקררים ישנים; מקררים חדישים שונים (ראה סעיף מקרר חדיש)
- קטגוריה: tech / מקרר ומכשירי מטבח · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**15. מקרר חדיש** — פרק י״א, דיני שימוש במוצרי חשמל, הלכה ו׳, עמ׳ 154 · `ong-11-11-a`
- לשון הספר: "אף שנאמר בסעיפים הקודמים שמותר לפתוח את המקרר או להוציא את התקע מהחשמל, זהו דווקא במקררים הישנים שבהם המנוע מושבת לגמרי, אבל המקררים החדישים אסור לפתחם וכן אין להוציא את השקע מהתקע, מפני שהמנוע פועל כל הזמן ללא הפסקה, ובחלק מהם יש מאוורר או נורות בקרה הפועלים תמיד גם בעת שהמנוע כבוי. על כן צריך לנטרל את פעולת המאוורר לפני שבת או לחבר את המקרר לפני שבת לשעון שבת שיפסיק את זרם החשמל לפרקי זמן מסוימים, ויפתחנו בשעה שהזרם מנותק."
- מקורות וטעמים: הערה 439: השבת והלכותיה עמוד 312 הלכה ז'. שמירת שבת כהלכתה חלק א' פרק י' עמוד ק"ל הלכה י"ד. מהדורת תש"ע. ואם שכח לנטרל את פעולת המאוורר עיין שולחן ערוך סימן ש"ז סעיף ה' שמתיר במקום…
- שאלה קנונית: מקרר חדיש – מותר לפתוח אותו בשבת?
- ניסוחים נוספים: מקרר עם מאוורר בשבת · מקרר דיגיטלי בשבת · מקרר נו פרוסט בשבת · לחבר מקרר לשעון שבת · מקרר חדיש · ממפתח הספר: מקרר חדיש
- תנאים: רק אחרי נטרול המאוורר לפני שבת, או בזמן שהזרם מנותק בשעון שבת
- תשובה קצרה: במקררים החדישים שהמנוע או המאוורר או נורות הבקרה פועלים כל הזמן, אסור לפתוח ואין להוציא את התקע. צריך לנטרל את המאוורר לפני שבת, או לחבר את המקרר לשעון שבת שינתק את הזרם לפרקי זמן, ולפתוח כשהזרם מנותק.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי מאוד בדגם המקרר; המכשירים השתנו מאז
- קטגוריה: tech / מקרר ומכשירי מטבח · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**16. דלת הנפתחת על ידי עין אלקטרונית** — פרק כ״ב, דיני הנאה מחילול שבת, הלכה י״ז, עמ׳ 255 · `ong-22-17-a`
- לשון הספר: "מי שהתקרב בשבת לדלת הנפתחת על ידי עין אלקטרונית או על ידי דריכה על משטח שלפניה, ועשה כן מחוסר ידיעה שהדבר גורם לפתיחת הדלת, ואם יכנס לבניין יגרום לסגירת הדלת, יעמיד שם חפץ גדול כמו כיסא וכדומה, ואז יוכל להיכנס לבניין. ואם אין שם איזה חפץ להעמידו במקומו, המיקל להיכנס לבניין יש לו על מי לסמוך."
- מקורות וטעמים: הערה 882: ילקוט יוסף שבת כרך ג' עמוד ס"א הלכה כ"ט. מהדורת תשנ"ג.
- שאלה קנונית: התקרבתי בשבת לדלת עם עין אלקטרונית והיא נפתחה – מותר להיכנס?
- ניסוחים נוספים: דלת הנפתחת על ידי עין אלקטרונית · דלת אוטומטית בשבת · דלת שנפתחת בדריכה על משטח · דלת עם חיישן בכניסה לבניין · ממפתח הספר: דלת הנפתחת על ידי עין אלקטרונית
- תנאים: רק כשלא ידע שהתקרבותו פותחת את הדלת · לכתחילה יעמיד חפץ גדול כדי שהדלת לא תיסגר בכניסתו
- תשובה קצרה: אם התקרב בלי לדעת שזה פותח את הדלת, וכניסתו תגרום לסגירתה – יעמיד שם חפץ גדול כמו כיסא, ואז ייכנס. אם אין שם חפץ – המיקל להיכנס יש לו על מי לסמוך.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי בטכנולוגיית החיישנים
- קטגוריה: tech / מעליות ודלתות · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**17. ליהנות ממזגן או ממאוורר שהפעילו אותו בשבת** — פרק כ״ב, דיני הנאה מחילול שבת, הלכה י׳, עמ׳ 252–253 · `ong-22-10-b`
- לשון הספר: "ולכן כל אדם יבדוק את המכשיר החשמלי שברשותו ואם מותקנת בו מנורה שאין בה חוט להט או סטרטר [כגון: מנורת לד], והדליקו את המכשיר בלי כוונה, מותר ליהנות מהמכשיר בשבת."
- מקורות וטעמים: הערה 872: ילקוט יוסף שבת כרך ג' עמוד כ"ב הלכה ע"א. מהדורת כיס תשע"ג.
- שאלה קנונית: המזגן שהודלק בטעות בשבת יש בו נורת לד – מותר ליהנות ממנו?
- ניסוחים נוספים: נורת לד במזגן · איך יודעים אם במזגן יש נורת לד · מאוורר עם נורת לד שהודלק בשבת · מוצר חשמל עם נורת לד · ממפתח הספר: מאוורר שהפעילו אותו בשבת בכוונה · מאוורר שהפעילו אותו בשבת בלי כוונה · מזגן שהפעילו אותו בשבת בכוונה · מזגן שהפעילו אותו בשבת בלי כוונה
- תנאים: רק כשהמנורה במכשיר היא בלי חוט להט או סטרטר · רק כשהודלק בלי כוונה
- תשובה קצרה: כל אדם יבדוק את המכשיר שלו: אם מותקנת בו מנורה בלי חוט להט או סטרטר, כמו מנורת לד, והדליקו אותו בלי כוונה – מותר ליהנות ממנו בשבת.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי בנורות שבמכשיר
- קטגוריה: shabbat / הנאה ממלאכת שבת · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### משחקי ילדים

**18. לגו, קליקס וסברס** — פרק י״ב, דיני משחקי ילדים, הלכה י׳, עמ׳ 162 · `ong-12-10`
- לשון הספר: "מותר לילדים לשחק בשבת בלגו, קליקס, סברס ואין לחוש בזה לאיסור בונה בשבת. וכן מותר לאפשר להם לחזור ולפרק אותם בשבת, מפני שאין בנין וסתירה בכלים, והם לא מחוברים על ידי ברגים, ועומדים להתפרק בכל שעה."
- מקורות וטעמים: הערה 471: חזון עובדיה שבת כרך ה' עמוד רצ"ב הלכה ח'. מהדורת תשע"ב. לגבי הקליקס הרה"ג דניאל גודיס שליט"א ראש כולל יחוה דעת אמר לי שדינו כמשחק הלגו כי הוא עתיד להתפרק באותו יום.
- שאלה קנונית: מותר לילדים לבנות בלגו בשבת ולפרק אחר כך?
- ניסוחים נוספים: קליקס בשבת · סברס בשבת · לפרק לגו בשבת · משחקי הרכבה בשבת · הילד רוצה לשחק בלגו בשבת · ממפתח הספר: לגו · משחק סברס · קליקס
- תנאים: —
- תשובה קצרה: מותר לילדים לשחק בשבת בלגו, קליקס וסברס, ואין לחוש לאיסור בונה; וכן מותר לאפשר להם לפרק אותם בשבת.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: LIKELY_CURRENT — משחקים בני זמננו
- קטגוריה: shabbat / משחקי ילדים · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**19. עד איזה גיל מותר לשחק בשבת** — פרק י״ב, דיני משחקי ילדים, הלכה א׳, עמ׳ 160 · `ong-12-1`
- לשון הספר: "הנידון של משחקים בשבת הוא רק לילדים מתחת לגיל בר מצוה בלבד, וכן לבנות מתחת לגיל בת מצווה אבל לגדולים אסור לשחק בהם בשבת. לפיכך כל ההיתרים שנכתוב בפרק זה, הכוונה לילד קטן מתחת לגיל 13 וילדה מתחת לגיל 12, אלא אם כן נכתב במפורש אחרת.
ויש מקרים מיוחדים שמותר למבוגר לשחק עם קטן, והוא שמדובר בילד קטן שגילו 3 וכדומה שבוכה, במקרה כזה יכול האבא לשחק עמו מעט בכדי שלא יבכה."
- מקורות וטעמים: הערה 460: ילקוט יוסף שבת כרך ב' עמוד תרל"ו הלכה א'. מהדורת תשנ"ב. | הערה 461: כך הורה הרה"ג יצחק יוסף שליט"א במוצאי שבת פרשת בלק ט"ו תמוז התשע"ג בשיעור השבועי בלוויין מביתו של מרן שליט"א. וטעמו משום שיש הרבה פוסקים שסוברים שבזמנינו שהמשחקים מיוצרים…
- שאלה קנונית: עד איזה גיל מותר לילדים לשחק במשחקים בשבת?
- ניסוחים נוספים: מבוגר יכול לשחק עם הילדים בשבת? · הילד בוכה שאבא ישחק איתו · משחקים לגדולים בשבת · בר מצווה ומשחקים בשבת · ממפתח הספר: משחקים- ילד בוכה שרוצה שאביו ישחק עמו
- תנאים: אלא אם כן נכתב במפורש אחרת
- תשובה קצרה: ההיתרים לשחק במשחקים בשבת הם לילד מתחת לגיל 13 ולילדה מתחת לגיל 12, ולגדולים אסור לשחק בהם. אבל ילד קטן כבן 3 שבוכה, יכול האבא לשחק עמו מעט כדי שלא יבכה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: LIKELY_CURRENT — משחקי ילדים בני זמננו
- קטגוריה: shabbat / משחקי ילדים · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**20. לשחק במכשיר חשמלי מקולקל** — פרק י״ב, דיני משחקי ילדים, הלכה כ״ד, עמ׳ 165 · `ong-12-24`
- לשון הספר: "מכשיר חשמלי שהתקלקל והילדים רגילים לשחק בו כגון טלפון וכיוצא בזה, מותר לילדים לשחק בו בשבת, שמכיון שרגילים בכך אין לו דין מוקצה."
- מקורות וטעמים: הערה 489: דרור יקרא עמוד שמ"א בשם הרב אלישיב זצ"ל.
- שאלה קנונית: מותר לילד לשחק בשבת בטלפון ישן ומקולקל?
- ניסוחים נוספים: מכשיר חשמלי מקולקל כצעצוע · פלאפון שלא עובד לילד · שלט ישן לשחק בו · ממפתח הספר: משחק- מכשיר חשמלי מקולקל
- תנאים: רק כשהילדים רגילים לשחק בו
- תשובה קצרה: מכשיר חשמלי שהתקלקל, כגון טלפון, שהילדים רגילים לשחק בו, מותר להם לשחק בו בשבת.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — מכשיר חשמלי; מכשירים מודרניים עשויים להידלק או להגיב
- קטגוריה: shabbat / משחקי ילדים · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### רחיצה

**21. רחיצה** — פרק י״ג, דיני רחיצה, הלכה ג׳, עמ׳ 169–170 · `ong-13-3-a`
- לשון הספר: "אסור לרחוץ כל גופו במים חמים אפילו במים שהוחמו על ידי השמש, ואפילו במים פושרים אסור."
- מקורות וטעמים: הערה 508: קיצור ילקוט יוסף חלק א' עמוד תש"ה הלכה ה'. מהדורת תשס"ו.
- שאלה קנונית: מותר להתקלח במים חמים בשבת?
- ניסוחים נוספים: מקלחת חמה בשבת · לרחוץ את כל הגוף במים פושרים בשבת · להתקלח במים שהתחממו בשמש בשבת · רחיצת כל הגוף בשבת · ממפתח הספר: מקלחת בשבת · רחיצה
- תנאים: —
- תשובה קצרה: אסור לרחוץ את כל הגוף במים חמים בשבת, אפילו במים שהוחמו בשמש, ואפילו במים פושרים.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו) · אזהרה: בהלכה יש דרגת "טוב/המחמיר" מחוץ לקטע המצוטט (נבדק: שייכת לרשומה אחרת של אותה הלכה או שאינה דרגת פסק)
- עדכניות: STABLE_CLASSICAL_RULE — דין רחיצה קלאסי
- קטגוריה: shabbat / רחצה · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**22. פתיחת ברז המים** — פרק י״ג, דיני רחיצה, הלכה א׳, עמ׳ 169 · `ong-13-1-a`
- לשון הספר: "אסור לפתוח בשבת את ברז המים החמים שהוחמו על ידי בוילר חשמלי לפני שבת, מכל מקום כל האיסור דווקא כשהמים שבבוילר חמים מאוד שהיד סולדת מהם [יד סולדת: נמנע מלאוכלם או לשתותם מרוב חומם], אבל אם אינם חמים כל כך, מותר לפתוח את ברז המים החמים."
- מקורות וטעמים: הערה 506: ילקוט יוסף שבת כרך ג' עמוד קס"א הלכה כ"ה ועמוד קס"ה הלכה כ"ו. מהדורת תשנ"ג. ויכול לפתוח את ברזי המים החמים והקרים ביחד, שיש להחשיב את המים החמים שעוברים מהדוד שמש לצינור …
- שאלה קנונית: מותר לפתוח בשבת את ברז המים החמים כשהמים חוממו בבוילר חשמלי לפני שבת?
- ניסוחים נוספים: מים חמים מהבוילר בשבת · לפתוח את הברז החם כשהדוד החשמלי הודלק מערב שבת · בוילר חשמלי פתיחת ברז המים · מים פושרים מהבוילר בשבת · ממפתח הספר: בוילר חשמלי- פתיחת ברז המים · דוד שמש- פתיחת ברז המים
- תנאים: האיסור דווקא כשהמים שבבוילר חמים שהיד סולדת בהם
- תשובה קצרה: אסור לפתוח את ברז המים החמים שהוחמו בבוילר חשמלי לפני שבת כשהמים חמים מאוד שהיד סולדת בהם. אם אינם חמים כל כך, מותר לפתוח את הברז החם.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי באופן פעולת הבוילר החשמלי ובחום המים שבו
- קטגוריה: shabbat / רחצה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### ניקיון

**23. ניקוי שטיחים** — פרק י״ד, דיני ניקיון הבית, הלכה א׳, עמ׳ 181 · `ong-14-1`
- לשון הספר: "מעיקר הדין מותר לנקות לצורך השבת עצמה את השטיחים ולהסיר מהם את האבק על ידי מכונה ידנית, אף אם המכונה תולשת ומורטת את הצמר מן השטיחים, ומכל מקום המחמיר תבוא עליו ברכה."
- מקורות וטעמים: הערה 562: ילקוט יוסף אוצר דינים לאשה עמוד שמ"ג הלכה ו'. זהו פסיק רישיה בפסיקת התלוש, ולא ניחא לו בפסיקת התלוש, וכיון שהוא מקלקל הוי איסורו מדרבנן, ואם כן יש להתיר משום שזה פסיק ריש…
- שאלה קנונית: מותר לנקות שטיחים בשבת?
- ניסוחים נוספים: ניקוי שטיח בשבת · מכונה ידנית לשטיחים · להסיר אבק מהשטיח בשבת · שואב ידני לשטיח בשבת · ממפתח הספר: שטיחים- לנקותם בשבת
- תנאים: רק לצורך השבת עצמה · במכונה ידנית
- תשובה קצרה: מעיקר הדין מותר לנקות לצורך השבת עצמה את השטיחים ולהסיר את האבק במכונה ידנית, אף אם היא תולשת צמר מהשטיח. והמחמיר תבוא עליו ברכה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: LIKELY_CURRENT — כלי ניקוי ידני
- קטגוריה: shabbat / ניקיון · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**24. “סילוקית"** — פרק י״ד, דיני ניקיון הבית, הלכה ג׳, עמ׳ 181–182 · `ong-14-3`
- לשון הספר: "ישנה מערכת שנקראת “סילוקית" המחוברת מאחורי אסלת השירותים, ועל ידי פתיחת המים של הניאגרה המשאבה פועלת מיד ומסלקת את המים לביוב של השכונה, אסור להשתמש בה בשבת כיון שהיא פועלת מיד לאחר העברת המים בשירותים. מכל מקום אם אין לו סילוקית אלא יש לו משאבה שנמצאת מחוץ לשירותים בתוך בריכה של ביוב שבתוכה יש מצוף, ועל ידי פתיחת המים המצוף עולה ולאחר מספר פעמים גדול של העברת המים בשירותים, המשאבה מסלקת את המים לביוב של השכונה, מותר להשתמש בה בשבת כיון שהיא לא פועלת מיד לאחר העברת המים בשירותים."
- מקורות וטעמים: הערה 566: דיברתי עם חברת "סילוקית 2000" ואמרו לי שזה עובד על מנוע, וזהו פסיק רישיה בדרבנן שאסור וכשזה עובד עם משאבה, זהו פסיק רישיה לשעבר בדרבנן, שמותר. וכך הורה הרה"ג אופיר מלכא ש…
- שאלה קנונית: מותר להוריד את המים בשבת כשיש משאבת "סילוקית" בשירותים?
- ניסוחים נוספים: סילוקית בשבת · משאבת ביוב בשירותים בשבת · ניאגרה עם משאבה חשמלית · משאבה עם מצוף בבור ביוב · ממפתח הספר: סילוקית
- תנאים: ההיתר רק כשהמשאבה אינה פועלת מיד לאחר הורדת המים
- תשובה קצרה: מערכת "סילוקית" שמשאבתה פועלת מיד אחרי הורדת המים – אסור להשתמש בה בשבת. משאבה בבור ביוב מחוץ לשירותים שפועלת לפי מצוף רק אחרי פעמים רבות – מותר.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי באופן פעולת המשאבה החשמלית
- קטגוריה: shabbat / ניקיון · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**25. שריית בגד במים** — פרק י״ד, דיני בגדים, הלכה ט׳, עמ׳ 187 · `ong-14-20`
- לשון הספר: "אסור להשרות בגד מלוכלך במים בשבת, ולכן מי שבגדיו או בגדי ילדיו התלכלכו בשבת, אסור לו להשרות אותם במים כדי שלא יסריחו וכיוצא בזה."
- מקורות וטעמים: הערה 589: שולחן ערוך סימן ש"ב סעיף ט'. וילקוט יוסף שבת כרך ב' עמוד פ"ד הלכה י"ט. מהדורת תשנ"ב. השרייה במים פועלת בניקוי הבגד וזהו 'שרייתו זהו כיבוסו'.
- שאלה קנונית: מותר להשרות בגד מלוכלך במים בשבת?
- ניסוחים נוספים: לשים בגד מלוכלך בדלי מים · בגדי ילדים שהתלכלכו בשבת · השריה במים שלא יסריח · להשרות כתם עד מוצאי שבת · ממפתח הספר: בגד- שרייתו במים
- תנאים: —
- תשובה קצרה: אסור להשרות בגד מלוכלך במים בשבת, גם כדי שלא יסריח וכדומה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין מהשולחן ערוך
- קטגוריה: shabbat / בגדים · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)


### חולה

**26. אקמול, אספירין** — פרק כ׳, דיני חולה, הלכה ה׳, עמ׳ 234 · `ong-20-5`
- לשון הספר: "מותר לבלוע כדורי הרגעה לשיכוך כאבים כגון אקמול, אספירין וכדומה, כשמצטער הרבה."
- מקורות וטעמים: הערה 788: חזון עובדיה שבת כרך ג' עמוד שנ"ו הלכה א'. מהדורת תשע"א.
- שאלה קנונית: אפשר לקחת אקמול בשבת?
- ניסוחים נוספים: אספירין בשבת · כדור נגד כאבים בשבת · משכך כאבים כשכואב מאוד בשבת · כדורים לשיכוך כאבים בשבת · ממפתח הספר: אספירין · אקמול
- תנאים: כשמצטער הרבה
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ׳ – דיני חולה: שאלה רפואית, מובאת לשון הספר ומפנים לרב
- קטגוריה: health / תרופות · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד

**27. להזדרז לחלל עליו את השבת** — פרק כ׳, דיני חולה, הלכה ל״ה, עמ׳ 241 · `ong-20-35`
- לשון הספר: "חולה שיש בו סכנה, מצוה מן התורה לחלל עליו את השבת, ואסור להתמהמה ולהתרשל בחילול שבת לחולה שיש בו סכנה, והזריז לחלל שבת במקום של פיקוח נפש, הרי זה משובח."
- מקורות וטעמים: הערה 821: חזון עובדיה שבת כרך ג' עמוד רכ"ט הלכה א'. מהדורת תשע"א.
- שאלה קנונית: חולה שיש בו סכנה – מחללים עליו שבת מיד?
- ניסוחים נוספים: פיקוח נפש בשבת · להזדרז לחלל שבת על חולה · חולה מסוכן בשבת · מותר להתמהמה בפיקוח נפש? · הזריז לחלל שבת בפיקוח נפש
- תנאים: —
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ׳ – דיני חולה: שאלה רפואית, מובאת לשון הספר ומפנים לרב
- קטגוריה: health / פיקוח נפש · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד

**28. תינוק שיש לו חום** — פרק כ׳, דיני חולה, הלכה ל״ח, עמ׳ 241 · `ong-20-38`
- לשון הספר: "תינוק שיש לו חום כל שהוא, הוא נחשב בכלל ספק סכנה, ומחללים עליו את השבת."
- מקורות וטעמים: הערה 824: חזון עובדיה שבת כרך ג' עמוד רמ"ז סוף הערה ח'. מהדורת תשע"א.
- שאלה קנונית: לתינוק יש חום בשבת – מחללים עליו שבת?
- ניסוחים נוספים: תינוק עם חום בשבת · חום לתינוק – ספק סכנה · נסיעה לרופא עם תינוק עם חום בשבת · תינוק חם בשבת · ממפתח הספר: תינוק שיש לו חום
- תנאים: —
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ׳ – דיני חולה: שאלה רפואית, מובאת לשון הספר ומפנים לרב
- קטגוריה: health / פיקוח נפש · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד


### יולדת

**29. ממתי מותר לחלל עליה את השבת** — פרק כ״א, דיני יולדת, הלכה ב׳, עמ׳ 244 · `ong-21-2-a`
- לשון הספר: "היולדת כל שלושה ימים הראשונים ללידתה משעת גמר הלידה, היא בחזקת סכנה, ואפילו אם אמרה איני צריכה שיחללו עלי את השבת, מחללים עליה את השבת, ואפילו אם גם הרופא אומר שאינה צריכה, מחללים עליה את השבת. ואסור לה להחמיר בדבר."
- מקורות וטעמים: הערה 836: חזון עובדיה שבת כרך ג' עמוד ש"ל הלכה ח'. מהדורת תשע"א.
- שאלה קנונית: יולדת בשלושת הימים הראשונים אחרי הלידה – מחללים עליה שבת גם כשהיא אומרת שלא צריך?
- ניסוחים נוספים: שלושה ימים ראשונים אחרי לידה בשבת · יולדת שאומרת איני צריכה חילול שבת · הרופא אומר שהיולדת לא צריכה · יולדת רוצה להחמיר ולא לחלל שבת
- תנאים: —
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ״א – דיני יולדת: שאלה של לידה, מובאת לשון הספר ומפנים לרב
- קטגוריה: health / יולדת בשבת · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד

**30. מרגישה צירי לידה** — פרק כ״א, דיני יולדת, הלכה ה׳, עמ׳ 245 · `ong-21-5`
- לשון הספר: "מן הרגע שהאשה מרגישה שעומדת ללדת כגון שמרגישה צירי לידה סדירים או שהיתה ירידת מים, אפילו אם יש לה ספק אם תלד עתה, מותר לטלפן לאמבולנס או למונית כדי לנסוע לבית החולים. ומותר לקרוב משפחה או לאדם אחר לנסוע יחד עם היולדת לבית החולים."
- מקורות וטעמים: הערה 839: חזון עובדיה שבת כרך ג' עמוד ש"כ הלכה ב'. מהדורת תשע"א.
- שאלה קנונית: מתי מותר להזמין אמבולנס או מונית ללידה בשבת?
- ניסוחים נוספים: צירים סדירים בשבת · ירידת מים בשבת · נסיעה לבית חולים בלידה · יש לי ספק אם אני יולדת עכשיו – נוסעים? · מי יכול לנסוע עם היולדת לבית החולים? · ממפתח הספר: צירי לידה
- תנאים: מן הרגע שהאשה מרגישה שעומדת ללדת · אפילו אם יש לה ספק אם תלד עתה
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ״א – דיני יולדת: שאלה של לידה, מובאת לשון הספר ומפנים לרב
- קטגוריה: health / יולדת בשבת · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד

**31. ג'י פי אס** — פרק כ״א, דיני יולדת, הלכה ט׳, עמ׳ 246 · `ong-21-9`
- לשון הספר: "מותר להפעיל את מכשיר הניווט הלוויני [ג'י. פי. אס] כדי להדריך את הנהג המתקשה להגיע למקום הדרוש עבור החולה שיש בו סכנה או היולדת, ובסיום הנסיעה לא ינתק את המכשיר."
- מקורות וטעמים: הערה 845: שמירת שבת כהלכתה חלק א' פרק מ' עמוד תר"נ הלכה ס"ג. מהדורת תש"ע.
- שאלה קנונית: מותר להפעיל GPS או וויז בנסיעה ללידה בשבת?
- ניסוחים נוספים: ג'י פי אס בשבת · ניווט לבית חולים בשבת · וויז בנסיעה עם חולה בשבת · לכבות את הניווט בסוף הנסיעה? · ממפתח הספר: יולדת- ג'י. פי. אס
- תנאים: כדי להדריך את הנהג המתקשה להגיע למקום הדרוש · ובסיום הנסיעה לא ינתק את המכשיר
- תשובה קצרה: — (לא מוצגת)
- בטיחות התשובה: אין תשובה נגזרת (HIGH_STAKES): מוצגת לשון הספר והפניה לרב
- עדכניות: HIGH_STAKES_REVIEW — פרק כ״א – יולדת; מכשיר ניווט: שאלה רפואית ותלוית טכנולוגיה
- קטגוריה: health / יולדת בשבת · סוג: din · פרסום: source-only-rabbi
- נדרשת בדיקה: כן — מקרה רגיש; הצגת המקור בלבד


### אמירה לגוי

**32. הדלקת מאוורר ומזגן על ידי גוי** — פרק כ״ג, דיני אמירה לגוי בשבת, הלכה כ׳, עמ׳ 263 · `ong-23-20`
- לשון הספר: "בימים שהחום כבד מאוד והוא מצטער מהחום, מותר לומר לגוי שידליק בשבת את המאוורר או את המזגן לצורך מי שסובל מהחום, וכל שכן לצורך חולים או קטנים, ואף מותר לבריא ליהנות מהמזגן. ואף אם אין החום גדול כל כך, יש להתיר כשיש שם תינוקות קטנים, ואם אחרי כמה שעות נשתנה מזג האוויר, והמיזוג יכול לגרום חולי ליושבי הבית, יכול לומר לגוי לכבותו. ואף שיש במזגן מנורת בקרה שנדלקת, מותר לומר לגוי שידליק את המזגן."
- מקורות וטעמים: הערה 913: ילקוט יוסף שבת כרך ב' עמוד רח"צ הלכה פ"א ועמוד ש' הלכה פ"ב. מהדורת תשנ"ב. | הערה 914: חזון עובדיה שבת כרך ג' עמוד ת"ל הלכה ד'. מהדורת תשע"א. מכיון שזה פסיק רישיה, ופסיק רישיה אפילו באיסור תורה אם הגוי אינו מכוין למלאכה, מותר.
- שאלה קנונית: חם מאוד בשבת, מותר לבקש מגוי להדליק מזגן?
- ניסוחים נוספים: להדליק מאוורר על ידי גוי · גוי מדליק מזגן בשבת · מזגן לתינוקות בשבת · לבקש מגוי לכבות מזגן כשקר · ממפתח הספר: גוי- הדלקת מאוורר ומזגן
- תנאים: אם אחרי כמה שעות נשתנה מזג האוויר והמיזוג עלול לגרום חולי, יכול לומר לגוי לכבותו. · מותר אף שיש במזגן מנורת בקרה שנדלקת.
- תשובה קצרה: כשהחום כבד מאוד ומצטערים ממנו, מותר לומר לגוי להדליק מאוורר או מזגן לצורך הסובל מהחום, וכל שכן לחולים או קטנים, ואף בריא מותר ליהנות. כשיש תינוקות קטנים יש להתיר אף אם החום אינו גדול כל כך.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו) · אזהרה: מילה רפואית בקטע (נבדק: אינה מקרה רפואי)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — מזגן ומאוורר; תלוי במכשיר
- קטגוריה: shabbat / אמירה לנכרי · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**33. הכלל לאמירה לגוי** — פרק כ״ג, דיני אמירה לגוי בשבת, הלכה א׳, עמ׳ 258 · `ong-23-1`
- לשון הספר: "כל דבר שאסור ליהודי לעשותו בשבת, בין אם אסור מהתורה ובין אם אסור מדברי חכמים, אסור לומר לגוי לעשותו בשבת, ואין הבדל בין אם אומר לו מלפני שבת לעשות לו את המלאכה בשבת או אם אומר לו בשבת. ואמירה לגוי בשבת אסורה מדברי חכמים. ובמקום שיש צורך מצוה או צורך גדול או חולי קצת או הפסד מרובה, מותר לומר לגוי לעשות מלאכה האסורה מדברי חכמים."
- מקורות וטעמים: הערה 891: ילקוט יוסף שבת כרך ב' עמוד רכ"ז הלכה א'. מהדורת תשנ"ב. | הערה 892: שולחן ערוך סימן ש"ז סעיף ה'.
- שאלה קנונית: מותר לבקש מגוי לעשות בשבילי מלאכה בשבת?
- ניסוחים נוספים: אמירה לגוי בשבת · שבס גוי · לבקש מגוי לפני שבת שיעשה בשבת · מתי מותר לומר לגוי לעשות מלאכה · ממפתח הספר: גוי- אמירה
- תנאים: במקום צורך מצוה, צורך גדול, חולי קצת או הפסד מרובה, מותר לומר לגוי לעשות מלאכה האסורה מדברי חכמים.
- תשובה קצרה: כל דבר שאסור ליהודי לעשות בשבת, מהתורה או מדברי חכמים, אסור לומר לגוי לעשותו בשבת, בין שאומר לו לפני שבת ובין בשבת.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — הכלל הקלאסי (שו״ע ש״ז)
- קטגוריה: shabbat / אמירה לנכרי · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

**34. כבה החשמל בבית הכנסת** — פרק כ״ג, דיני אמירה לגוי בשבת, הלכה כ״ד, עמ׳ 264 · `ong-23-24-a`
- לשון הספר: "אם כבה החשמל בבית הכנסת באמצע התפילה בליל שבת או בליל הכיפורים, ואין כל הציבור יודע להתפלל בעל פה, מותר לומר לגוי שידליק את החשמל לצורך הרבים. ואם אפשר טוב לעשות כן על ידי אמירה לגוי שיאמר לגוי חברו.
והוא הדין בישיבה שנפסק החשמל מחמת איזה קלקול, ואי אפשר ללמוד, יש להקל בזה. אבל לצורך מצוה של יחיד, אין להקל לומר לגוי לעשות מלאכה האסורה מן התורה."
- מקורות וטעמים: הערה 918: קיצור ילקוט יוסף חלק א' עמוד תקצ"ז הלכה ס"ה. מהדורת תשס"ו.
- שאלה קנונית: כבה החשמל בבית הכנסת באמצע תפילת ליל שבת, מותר לבקש מגוי להדליק?
- ניסוחים נוספים: הפסקת חשמל בבית הכנסת בליל כיפור · נפל החשמל בישיבה בשבת · אין אור בבית הכנסת והציבור לא יודע בעל פה · אמירה לגוי לצורך הרבים · ממפתח הספר: גוי- כבה החשמל בבית הכנסת · גוי- כבה החשמל בישיבה
- תנאים: אם אפשר, טוב לעשות כן על ידי אמירה לגוי שיאמר לגוי חברו. · רק כשיש בדבר הכרח גדול.
- תשובה קצרה: אם כבה החשמל בבית הכנסת באמצע התפילה בליל שבת או בליל כיפור, ואין כל הציבור יודע להתפלל בעל פה, מותר לומר לגוי להדליק לצורך הרבים. וכן בישיבה שאי אפשר ללמוד יש להקל. לצורך מצוה של יחיד אין להקל במלאכה מהתורה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — חשמל
- קטגוריה: shabbat / אמירה לנכרי · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה


### הבדלה

**35. שמיעת הבדלה בטלפון ורדיו** — פרק כ״ד, דיני יציאת השבת והבדלה, הלכה ז׳, עמ׳ 266 · `ong-24-7`
- לשון הספר: "אין יוצאים ידי חובת ההבדלה בשמיעת ההבדלה בטלפון, וכן אין יוצאים ידי חובה בשמיעת ההבדלה מהרדיו."
- מקורות וטעמים: הערה 926: ילקוט יוסף שבת כרך א' עמוד תס"ב הלכה כ"ג. מהדורת תשנ"ב.
- שאלה קנונית: אפשר לצאת ידי חובת הבדלה בטלפון או ברדיו?
- ניסוחים נוספים: הבדלה - שמיעתה בטלפון · הבדלה - שמיעתה ברדיו · הבדלה בזום או בשיחת וידאו · לשמוע הבדלה ברמקול · ממפתח הספר: הבדלה- שמיעתה בטלפון · הבדלה- שמיעתה ברדיו
- תנאים: —
- תשובה קצרה: אין יוצאים ידי חובת הבדלה בשמיעתה בטלפון, וכן אין יוצאים בשמיעתה מהרדיו.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — שמיעה דרך מכשירי תקשורת; טכנולוגיות חדשות (וידאו, שידור חי) לא נידונו בספר
- קטגוריה: shabbat / הבדלה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**36. לברך על מנורת החשמל** — פרק כ״ד, דיני יציאת השבת והבדלה, הלכה י״ד, עמ׳ 268 · `ong-24-14`
- לשון הספר: "אין לברך ברכת מאורי האש על מנורת חשמל."
- מקורות וטעמים: הערה 935: חזון עובדיה שבת כרך ב' עמוד תל"ו הלכה ט'. מהדורת תשס"ח.
- שאלה קנונית: אפשר לברך בורא מאורי האש על נורה חשמלית?
- ניסוחים נוספים: הבדלה - לברך על מנורת החשמל · מאורי האש על אור חשמל · נורה במקום נר הבדלה · ממפתח הספר: הבדלה- לברך על מנורת החשמל
- תנאים: —
- תשובה קצרה: אין לברך ברכת מאורי האש על מנורת חשמל.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: TECHNOLOGY_REVIEW_NEEDED — תלוי בסוג התאורה החשמלית
- קטגוריה: shabbat / הבדלה · סוג: din · פרסום: from-book-tech-note
- נדרשת בדיקה: כן — בירור מציאות/מכשירים עדכניים + ביקורת רבנית של התשובה הקצרה

**37. הבדלה כשהוא יושב** — פרק כ״ד, דיני יציאת השבת והבדלה, הלכה י, עמ׳ 267 · `ong-24-10`
- לשון הספר: "צריך לעשות את ההבדלה כשהוא יושב."
- מקורות וטעמים: הערה 930: חזון עובדיה שבת כרך ב' עמוד ת"ד הלכה א'. מהדורת תשס"ח.
- שאלה קנונית: כשמבדילים במוצאי שבת, המבדיל עומד או יושב?
- ניסוחים נוספים: הבדלה כשהוא יושב · לשבת בזמן ההבדלה · הבדלה בעמידה · ממפתח הספר: הבדלה כשהוא יושב
- תנאים: —
- תשובה קצרה: צריך לעשות את ההבדלה בישיבה.
- בטיחות התשובה: עבר את השער (אין מילה חזקה מזו שבספר; דרגת "טוב/ראוי/המחמיר" נשמרה; התנאים נשמרו)
- עדכניות: STABLE_CLASSICAL_RULE — דין קלאסי של מוצאי שבת והבדלה
- קטגוריה: shabbat / הבדלה · סוג: din · פרסום: from-book
- נדרשת בדיקה: ביקורת רבנית של התשובה הקצרה (כמו בכל הרשומות)

---

## M. Rights and provenance

- **Basis:** the owner states that he received full permission directly from the author to use the book in the app.
  Recorded as rights basis **`author-permission`** — never Public Domain, CC0 or any Creative Commons licence.
- **Registry:** `LICENSES['author-permission']` — "באישור המחבר; כל הזכויות שמורות למחבר"; redistribution and offline
  use allowed (as permitted), commercial use `UNKNOWN` (as the permission states — to be confirmed, §O), modification
  not allowed. `AUTHOR_PERMISSION_WORKS` names the only two works that may carry it (`Oneg_Shabbat`,
  `Oneg_Shabbat_Notes`), each with: work עונג שבת · author הרב ישראל שריקי · edition מהדורה ראשונה תשע״ג · copyright
  "כל הזכויות שמורות (בדפוס)" · rightsBasis author-permission · permissionStatedBy בעל האפליקציה · permissionEvidence
  "written permission to be kept by the owner — not stored in the repo". Tests fail if any other work, edition or pack
  carries this licence, or if any rights field of this work names PD/CC.
- **Credit line** under the text and on every question page: "עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות
  שמורות".
- **Not in the repository:** the PDF itself (only its SHA-256), the approbation images, the imprint's phone numbers, the
  dedications. **One visible redaction:** note 440 prints a private technician's mobile number (2013) for installing a
  Shabbat kit in fridges; the app shows "[מספר הטלפון שבספר לא הובא כאן]", and the original note's SHA-256 is kept.

---

## N. Implemented now vs next steps

**Implemented now**
- The book in the library (all 752 halachot, the blessing table, the introduction), with the notes layer, page numbers,
  per-unit hashes and a reproducible extraction.
- 976 question records in the engine (697 + 196 + 83 by publication state), all passing the gate.
- Search weighting, flow precedence, agent/conversation routing, graph, question page, reader, About page.
- 66 exact links from notes to the Shulchan Arukh, Rambam and Talmud.
- Tests: `tests/ongShabbat.test.mjs` (25 tests: text hashes, headings, footnotes, pages, no duplicates, sources,
  strength and conditions, device and high-stakes gates, rights and the licence exception, the 9 examples, silence where
  the book is silent, parallels, exact links, size, rendering). Existing tests extended: local sources now include the
  book's halachot; the security-camera acceptance query also accepts the book's two security-camera halachot; the
  licence test's credits list shows only CC BY-SA texts; the 448-question coverage fixture lists nine of the book's
  records as accepted/partial answers after each was read against its question (marked `ongShabbatNote`).
- Size: packs 172 KB gzip (114 KB book, 48 KB notes, 9 KB anchors); question layer 1.69 MB raw / 288 KB gzip in the
  main bundle; question-page component 15 KB (3.6 KB gzip, lazy).

**Next steps**
1. **Rabbinic review** of the 893 derived short answers (every record is `rabbinicReview: "pending"`), starting with
   the 196 technology/reality records and the 4 `machloket` records.
2. The **blessing table** as 283 "מה מברכים על X?" records (decide how to handle the existing Yalkut blessing entries).
3. LIKELY links: קיצור ילקוט יוסף (page → siman/se'if map for the cited edition), כף החיים (Sefaria, live), בן איש חי
   (שנה/פרשה/אות map).
4. Tune ranking against a small labelled set of the book's own headings (every title as a query).
5. Owner decisions in §O (dedications, approbations, note 440, commercial use).

---

## O. Open questions (only for the owner, the author, or a rabbinic reviewer)

**For the owner / the author**
1. Does the permission cover **commercial use** (the licence records it as UNKNOWN) and **offline redistribution inside
   the app stores**? Is the permission limited to this edition?
2. Should the **approbation letters** (pp. 4–11, images only) be shown (as images), and the **dedications** (pp.
   313–318, private names) be included?
3. **Note 440**: restore the technician's phone number, or keep the redaction?
4. Is a **newer edition** (with updated device rulings) available? The fridge, LED, plata and security-camera halachot
   would benefit most.
5. The book states "1,560 ק״ג" as the amount for separating challah with a blessing (א׳ ח׳): the draft reads it as
   1.560 kg; the author may want to confirm the printed figure.

**For a rabbinic reviewer**
1. The technology-dependent rulings of §H against today's devices: modern fridges, LED indicator lamps, adjustable and
   timer platas, electric ovens that respond to the door, inverter ACs, security cameras and sensors.
2. Where the book and Yalkut Yosef stand side by side, whether any pair actually differs in ruling (e.g. ז׳ (סעודה
   שלישית) ז׳: "רצה והחליצנו" when סעודה שלישית runs past nightfall — the book adds omitting the word "הזה"; ט׳ ב׳ vs ט׳ ח׳ on tea
   leaves and tea bags inside the book).
3. The 8 high-stakes records outside chapters כ׳–כ״א (§I): whether any should show a short answer after all (e.g. ט״ז
   (צובע) ד׳ blood on toilet paper, י״ז ט׳ worms), or whether more should be high-stakes (e.g. י״ג (מניקור וקוסמטיקה)
   י״ד, cream for a baby).
4. Whether halachot that say Shabbat is broken for a person in (possible) danger — כ׳ ל״ח (a baby's fever), כ׳ ל״ט
   (bites and stings), כ״א ב׳ (the first three days after birth) — should carry a danger line; the app shows only words
   the book itself uses.
5. The 4 records marked `machloket` and the 56 marked `chumra`: whether the level is conveyed correctly in the short
   answer.
