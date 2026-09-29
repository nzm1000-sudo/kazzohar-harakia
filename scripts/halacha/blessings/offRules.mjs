// מנוע הברכות — how a product of Open Food Facts is placed under ONE rule of src/data/blessings/rules.mjs or ONE row of
// the עונג שבת table, or left out. Deterministic and reviewable: fixed lists, checked in this order —
//   1. left out: products that are not eaten as they are (spices, sauces, oils, flour, supplements, baby food…);
//   2. a product whose name begins with the name of a row of the table that names a product (במבה, ביסלי, קרמבו…);
//   3. its Open Food Facts category (with its ingredients where the rule depends on them: the five grains, rice, corn);
//   4. the head word of its Hebrew name (for products without categories);
//   otherwise it is left out ("no rule applies").
// Where the ingredients change the rule (a chocolate bar with a wafer, gluten-free bread of rice flour), the product
// goes to the conditional rule, never to a guess.

const GRAIN_EN = new Set(['en:wheat', 'en:wheat-flour', 'en:durum-wheat', 'en:durum-wheat-semolina', 'en:wheat-semolina', 'en:semolina', 'en:soft-wheat', 'en:soft-wheat-flour', 'en:wholemeal-wheat-flour', 'en:whole-wheat-flour', 'en:barley', 'en:barley-flour', 'en:pearl-barley', 'en:rye', 'en:rye-flour', 'en:oat', 'en:oats', 'en:oat-flakes', 'en:oat-flour', 'en:rolled-oats', 'en:spelt', 'en:spelt-flour', 'en:bulgur', 'en:couscous', 'en:breadcrumbs', 'en:bread', 'en:wheat-flakes', 'en:whole-wheat', 'en:wholemeal-spelt-flour', 'en:wholegrain-wheat-flour', 'en:whole-grain-oat-flakes', 'en:wholegrain-oat-flakes', 'en:biscuit', 'en:wafer']);
const GRAIN_HE = ['קמח-חיטה', 'קמח-חטה', 'חיטה-מלא', 'קמח-כוסמין', 'כוסמין', 'שיבולת-שועל', 'שבולת-שועל', 'קמח-שיפון', 'שיפון', 'קמח-שעורה', 'פירורי-לחם', 'סולת', 'בורגול', 'קמח-לבן', 'ביסקוויט', 'ופל'];
const CORN = ['en:corn', 'en:maize', 'en:corn-grits', 'en:cornmeal', 'en:corn-flour', 'en:maize-flour', 'en:corn-starch', 'en:popcorn'];
const CORN_HE = ['תירס'];
const RICE = ['en:rice', 'en:rice-flour', 'en:puffed-rice', 'en:brown-rice', 'en:white-rice', 'en:basmati-rice'];
const RICE_HE = ['אורז'];
const POTATO = ['en:potato', 'en:potatoes', 'en:potato-flakes', 'en:dehydrated-potatoes', 'en:potato-starch', 'en:dried-potatoes'];
const POTATO_HE = ['תפוחי-אדמה', 'תפוח-אדמה', 'תפו-א'];

// Hebrew ingredient ids are often one long run of OCR'd words; malt (לתת / malt extract) flavours and is not the grain.
const clean = tag => tag.replace(/לתת-?שעורה|לתת|malt[a-z-]*/g, '');
function grainIn(tags) { return tags.some(tag => GRAIN_EN.has(tag) || (tag.startsWith('he:') && GRAIN_HE.some(word => clean(tag).includes(word)))); }
const anyIn = (tags, en, he) => tags.some(tag => en.includes(tag) || (tag.startsWith('he:') && he.some(word => tag.includes(word))));

// Categories whose products are not eaten on their own: no blessing is looked up for them.
const EXCLUDE = ['en:baby-foods', 'en:baby-milks', 'en:food-additives', 'en:dietary-supplements', 'en:bodybuilding-supplements', 'en:protein-powders', 'en:herbs-and-spices', 'en:spices', 'en:condiments', 'en:sauces', 'en:mayonnaises', 'en:ketchup', 'en:mustards', 'en:dressings', 'en:vinegars', 'en:vegetable-oils', 'en:olive-oils', 'en:oils', 'en:salts', 'en:flours', 'en:baking-aids', 'en:yeasts', 'en:sugar-substitutes', 'en:artificial-sugar-substitutes', 'en:bouillon-cubes', 'en:broths', 'en:stocks', 'en:pet-food', 'en:non-food-products', 'en:peanut-butters', 'en:nut-butters', 'en:chocolate-spreads', 'en:hazelnut-spreads', 'en:sweet-spreads', 'en:salted-spreads', 'en:dips', 'en:margarines', 'en:shellfish', 'en:crustaceans', 'en:molluscs', 'en:pork', 'en:quinoa', 'en:simple-syrups', 'en:cooking-helpers', 'en:tomato-pastes', 'en:tomato-sauces', 'en:soy-sauces', 'en:pestos', 'en:seasonings'];
const EXCLUDE_HEAD = ['זרעי', 'קוביות', 'תמצית', 'תרסיס', 'מיוניז', 'חרדל', 'קורנפלור', 'פפריקה', 'פסטו', 'טפנד', 'סחוג', 'ציזיקי', 'קקאו', 'צילי', "צ'ילי", 'תרכיז', 'קינואה', 'סייטן', 'רסק', 'אבקת', 'רוטב', 'תבלין', 'תבלינים', 'שמן', 'קמח', 'מלח', 'חומץ', 'מיונז', 'קטשופ', 'תערובת', 'שמרים', 'סירופ', 'ממרח', 'חמאת', 'תחליף', 'תוסף', 'ויטמין', 'פטה', 'מחית', 'פירה'];

// Rows of the table that name a product: a product whose name begins with these words IS that product.
const NAME_ROWS = [
  ['במבה', 'במבה'], ['ביסלי', 'ביסלי'], ['דוריטוס', 'דוריטוס [חטיף תירס]'], ["תפוצ'יפס", 'תפוצ\'יפס [חטיף]'], ['תפוציפס', 'תפוצ\'יפס [חטיף]'],
  ['קרמבו', 'קרמבו'], ['בננית', 'בננית'], ['טעמי', 'טעמי [חטיף]'], ['אגוזי', 'אגוזי [חטיף]'], ['נשנשים', 'נשנשים [חטיף]'], ['קורנפלקס', 'קורנפלקס'],
  ['מרשמלו', 'מרשמלו'], ['חלווה', 'חלווה'], ['חלבה', 'חלווה'], ['שערות סבתא', 'שערות סבתא'], ['חטיף נוגט', 'חטיף נוגט'], ['כיפלי', 'כיפלי קראנץ'],
  ['בוטן אמריקאי', 'בוטן אמריקאי'], ['לחמית', 'לחמית'], ['צנימים', 'צנימים שנעשו במפעל'], ['שקדי מרק', 'שקדי מרק'], ['מציות', 'מציות'], ['פתיתי תירס', 'פתיתי תירס'],
  ['פריכיות אורז', 'פריכיות אורז'], ['פריכיות', 'פריכיות אורז'], ['קוסקוס', 'קוסקוס אפילו עם ירקות או בשר'], ['מלאווח', 'מלאווח'], ["ג'חנון", 'ג\'חנון'], ['סמבוסק', 'סמבוסק מטוגן'],
  ['מלפפונים חמוצים', 'מלפפון חמוץ'], ['מלפפון חמוץ', 'מלפפון חמוץ'], ['זיתים', 'זיתים'], ['טחינה', 'טחינה'], ['חומוס', 'חומוס למריחה'], ['דבש תמרים', 'דבש תמרים'], ['סילאן', 'דבש תמרים'],
  ['דבש', 'דבש דבורים'], ['סוכר', 'סוכר'], ['מצות', 'מצה [לא בפסח]'], ['מצה', 'מצה [לא בפסח]'], ['בירה', 'בירה'], ['ערק', 'ערק'], ['קוניאק', 'קוניאק'], ['ויסקי', 'ויסקי'],
  ['וופל', 'וופל'], ['ופל', 'וופל'], ['ביסקוויט', 'ביסקוויט'], ['ביסקויט', 'ביסקוויט'], ['בייגלה', 'ביגל\'ה'], ['ביגלה', 'ביגל\'ה'], ["ביגל'ה", 'ביגל\'ה'],
  ['פופקורן', 'פופקורן'], ['לזניה', 'לזאניה'], ['לזאניה', 'לזאניה'], ['קובה', 'קובה'], ['ספגטי', 'ספגטי'], ['אטריות', 'אטריות'], ['סוכריות', 'סוכריות'], ['טופי', 'טופי'],
  ['שמנת', 'שמנת'], ['לבן', 'לֶבֶןּ'], ['חמאה', 'חמאה [כשאוכלה בלי לחם]'], ['נקניקיות', 'נקניק'], ['נקניק', 'נקניק'], ['סרדינים', 'סרדינים'], ['שניצל', 'שניצל בקמח או בפירורי לחם'],
  ['קציצות', 'קציצות'], ['שקדים', 'שקדים'], ['בוטנים', 'בוטנים'], ['קשיו', 'אגוז קשיו'], ['פיסטוק', 'פיסטוק'], ['פקאן', 'פקאן'], ['צנוברים', 'צנוברים'],
  ['גרעיני תירס', 'גרגרי תירס'], ['גרגרי תירס', 'גרגרי תירס'], ['גרעיני חמניות', 'גרעיני חמניות [שחורים]'], ['גרעיני דלעת', 'גרעיני דלעת [לבנים]'], ['גרעיני אבטיח', 'גרעיני אבטיח'], ['צימוקים', 'צימוקים'], ['תמרים', 'תמרים'],
  ['חמוציות', 'חמוציות'], ['תירס', 'תירס'], ['פטריות', 'פטריות'], ['גלידה', 'גלידה'], ['ארטיק קרח', 'ארטיק קרח'], ['שוקולד', 'שוקולד'], ['מעדן חלב', 'מעדן חלב'], ['חלב קוקוס', 'חלב קוקוס'], ['חלב אגוז הודי', 'חלב אגוז הודי'], ['חלב', 'חלב'],
  ['ריבת אתרוג', 'ריבת אתרוג'], ['ריבה', 'ריבה'], ["צ'יפס", "צ'יפס"], ['ציפס', "צ'יפס"], ['פרכיות', 'פריכיות אורז'], ['מלוואח', 'מלאווח'], ['שניצלונים', 'שניצל בקמח או בפירורי לחם'],
  ['סלט חצילים', 'סלט חצילים [כשאוכלו ללא לחם]'], ['סלט טונה', 'סלט טונה או ביצים'], ['סלט ביצים', 'סלט טונה או ביצים'], ['סלט כרוב', 'סלט כרוב'], ['מטבוחה', 'מטבוחה [כשאוכלה ללא לחם]'],
  ['טופו', 'טופו'], ['עלי גפן ממולאים', 'עלי גפן ממולאים באורז'], ['לבבות דקל', 'לבבות דקל'], ['אננס', 'אננס'], ['מרציפן', 'מרציפן'], ['קרטיב', 'ארטיק קרח'], ['שום', 'שום'], ['עוגיות קוקוס', 'עוגיות קוקוס'], ['עוגיות בוטנים', 'עוגיות בוטנים'], ['שוקולית', null],
];
// Rows that themselves hold a grain (or are the grain): a grain in the product does not move them to "ממתק עם דגן".
const GRAIN_ROWS = new Set(['ביסלי', 'נשנשים [חטיף]', 'כיפלי קראנץ', 'בוטן אמריקאי', 'לחמית', 'צנימים שנעשו במפעל', 'שקדי מרק', 'מציות', 'קוסקוס אפילו עם ירקות או בשר', 'מלאווח', 'ג\'חנון', 'סמבוסק מטוגן', 'מצה [לא בפסח]', 'בירה', 'וופל', 'ביסקוויט', 'ביגל\'ה', 'לזאניה', 'קובה', 'ספגטי', 'אטריות', 'קרמבו', 'שניצל בקמח או בפירורי לחם', 'עוגיות קוקוס', 'עוגיות בוטנים', 'קורנפלקס']);
// Rows of a single sweet or dairy food: when the product holds one of the five grains, the row does not describe it.
const GRAIN_SENSITIVE_PREFIX = new Set(['שוקולד', 'חלב', 'מעדן חלב', 'גלידה', 'סוכריות', 'טופי', 'מרשמלו', 'חלווה', 'חלבה', 'במבה', 'בננית', 'אגוזי', 'טעמי', 'חטיף נוגט']);

const CATEGORY_RULES = [
  [['en:beers'], { row: 'בירה' }],
  [['en:fruit-wines', 'en:ciders'], { rule: 'drink' }],
  [['en:wines', 'en:red-wines', 'en:white-wines', 'en:sparkling-wines', 'en:grape-juices'], { rule: 'wine' }],
  [['en:spirits', 'en:liqueurs', 'en:whiskies', 'en:vodkas', 'en:anise-flavoured-spirits', 'en:brandies', 'en:rums', 'en:gins'], { rule: 'spirits' }],
  [['en:oat-based-drinks', 'en:rice-based-drinks', 'en:cereal-based-drinks'], { rule: 'grain-drink' }],
  [['en:plant-based-milk-alternatives', 'en:soy-based-drinks', 'en:almond-based-drinks', 'en:legume-based-drinks', 'en:coconut-milks', 'en:nut-based-drinks'], { rule: 'plant-milk' }],
  [['en:iced-teas', 'en:iced-coffees', 'en:energy-drinks', 'en:sodas', 'en:soft-drinks', 'en:colas', 'en:carbonated-drinks', 'en:waters', 'en:flavored-waters', 'en:fruit-juices', 'en:juices-and-nectars', 'en:fruit-nectars', 'en:vegetable-juices', 'en:lemonades', 'en:sweetened-beverages'], { rule: 'drink' }],
  [['en:coffees', 'en:instant-coffees', 'en:coffee-drinks', 'en:teas', 'en:tea-bags', 'en:herbal-teas', 'en:black-teas', 'en:green-teas', 'en:hot-beverages'], { rule: 'hot-drink' }],
  [['en:ice-creams-and-sorbets', 'en:ice-creams', 'en:frozen-desserts', 'en:ice-cream-bars', 'en:sorbets'], { rule: 'ice-cream' }],
  [['en:butters'], { row: 'חמאה [כשאוכלה בלי לחם]' }],
  [['en:milks', 'en:dairy-drinks', 'en:milkshakes', 'en:yogurts', 'en:cheeses', 'en:creams', 'en:dairy-desserts', 'en:fermented-milk-products', 'en:cottage-cheeses', 'en:cream-cheeses', 'en:dairies'], { rule: 'dairy', grainSensitive: true }],
  [['en:eggs'], { rule: 'animal' }],
  [['en:meats', 'en:poultries', 'en:sausages', 'en:fishes', 'en:canned-fishes', 'en:tunas', 'en:fish-preparations', 'en:meat-preparations', 'en:prepared-meats'], { rule: 'animal', grainSensitive: true }],
  [['en:chewing-gums'], { rule: 'gum' }],
  [['en:chocolates', 'en:chocolate-candies', 'en:milk-chocolates', 'en:dark-chocolates', 'en:candy-chocolate-bars', 'en:white-chocolates'], { rule: 'chocolate', grainSensitive: true }],
  [['en:halva', 'en:sesame-halva'], { row: 'חלווה' }],
  [['en:candies', 'en:confectioneries', 'en:lollipops', 'en:gummies', 'en:marshmallows', 'en:jelly-candies', 'en:bonbons', 'en:toffees'], { rule: 'candy', grainSensitive: true }],
  [['en:jams', 'en:fruit-preserves', 'en:marmalades', 'en:fruit-jams'], { rule: 'jam' }],
  [['en:date-syrups'], { row: 'דבש תמרים' }],
  [['en:honeys'], { row: 'דבש דבורים' }],
  [['en:sugars', 'en:granulated-sugars'], { row: 'סוכר' }],
  [['en:tahini'], { row: 'טחינה' }],
  [['en:hummus'], { row: 'חומוס למריחה' }],
  [['en:matzos', 'en:matzot', 'en:matzahs'], { row: 'מצה [לא בפסח]' }],
  [['en:gluten-free-breads'], { rule: 'mixture' }],
  [['en:brioches', 'en:sweet-breads', 'en:challahs'], { rule: 'sweet-bread', grainNeeded: true }],
  [['en:breads', 'en:pitas', 'en:flatbreads', 'en:white-breads', 'en:wholemeal-breads', 'en:sliced-breads', 'en:rolls', 'en:baguettes', 'en:wheat-tortillas'], { rule: 'bread', grainNeeded: true }],
  [['en:puffed-rice-cakes', 'en:rice-cakes'], { row: 'פריכיות אורז' }],
  [['en:puffed-cereal-cakes', 'en:corn-cakes'], { rule: 'corn' }],
  [['en:crackers', 'en:crackers-appetizers', 'en:rusks', 'en:breadsticks', 'en:pretzels', 'en:crispbreads', 'en:toasts'], { rule: 'dry-crackers', grainNeeded: true }],
  [['en:wafers'], { row: 'וופל' }],
  [['en:biscuits', 'en:cookies', 'en:cakes', 'en:sweet-pastries-and-pies', 'en:viennoiseries', 'en:croissants', 'en:pastries', 'en:biscuits-and-cakes', 'en:chocolate-biscuits', 'en:sponge-cakes', 'en:muffins'], { rule: 'kisnin', grainNeeded: true }],
  [['en:pastas', 'en:noodles', 'en:couscous', 'en:instant-noodles', 'en:spaghetti', 'en:dry-pastas', 'en:fresh-pastas'], { rule: 'grain-cooked', grainNeeded: true }],
  [['en:corn-flakes'], { row: 'קורנפלקס' }],
  [['en:breakfast-cereals', 'en:mueslis', 'en:granolas', 'en:cereal-flakes', 'en:extruded-cereals', 'en:cereal-grains'], { rule: 'breakfast-cereal' }],
  [['en:rices', 'en:aromatic-rices', 'en:basmati-rices', 'en:long-grain-rices'], { row: 'אורז' }],
  [['en:popcorn'], { row: 'פופקורן' }],
  [['en:potato-crisps', 'en:crisps-made-from-potato', 'en:salty-snacks-made-from-potato'], { potato: true }],
  [['en:corn-chips', 'en:tortilla-chips', 'en:puffed-salty-snacks-made-from-maize'], { rule: 'corn' }],
  [['en:legumes', 'en:pulses', 'en:canned-legumes', 'en:chickpeas', 'en:lentils', 'en:beans', 'en:legume-seeds', 'en:dried-legumes'], { rule: 'legume' }],
  [['en:almonds'], { row: 'שקדים' }], [['en:cashew-nuts'], { row: 'אגוז קשיו' }], [['en:pistachios'], { row: 'פיסטוק' }], [['en:pecans', 'en:pecan-nuts'], { row: 'פקאן' }],
  [['en:hazelnuts'], { row: 'בונדוק' }], [['en:peanuts'], { row: 'בוטנים' }], [['en:pine-nuts'], { row: 'צנוברים' }],
  [['en:sunflower-seeds'], { row: 'גרעיני חמניות [שחורים]' }], [['en:pumpkin-seeds'], { row: 'גרעיני דלעת [לבנים]' }], [['en:watermelon-seeds'], { row: 'גרעיני אבטיח' }],
  [['en:nuts', 'en:nuts-and-their-products', 'en:mixed-nuts', 'en:seeds'], { rule: 'nut' }],
  [['en:dates', 'en:medjool-dates', 'en:deglet-noor-dates'], { row: 'תמרים' }], [['en:raisins'], { row: 'צימוקים' }], [['en:dried-cranberries'], { row: 'חמוציות' }],
  [['en:dried-apricots', 'en:prunes', 'en:dried-figs'], { rule: 'dried-fruit' }],
  [['en:dried-fruits'], { rule: 'fruit-plant' }],
  [['en:pickles', 'en:pickled-cucumbers', 'en:gherkins'], { row: 'מלפפון חמוץ' }], [['en:olives', 'en:green-olives', 'en:black-olives'], { row: 'זיתים' }],
  [['en:sweet-corns', 'en:canned-corn'], { row: 'תירס' }], [['en:mushrooms', 'en:canned-mushrooms'], { row: 'פטריות' }],
  [['en:pizzas', 'en:frozen-pizzas', 'en:pizzas-pies-and-quiches'], { rule: 'mixture' }],
  [['en:soups', 'en:instant-soups'], { rule: 'soup' }],
  [['en:vegetables', 'en:fresh-vegetables', 'en:frozen-vegetables', 'en:canned-vegetables', 'en:tomatoes', 'en:chopped-tomatoes'], { rule: 'vegetable' }],
  [['en:bars', 'en:cereal-bars', 'en:protein-bars', 'en:snacks', 'en:salty-snacks', 'en:appetizers', 'en:meals', 'en:prepared-salads', 'en:frozen-foods', 'en:sweet-snacks'], { rule: 'mixture', last: true }],
];

// The head word of a Hebrew product name, for products without categories.
const HEAD_RULES = {
  'מים': 'drink', 'סודה': 'drink', 'קולה': 'drink', 'מיץ': 'drink', 'נקטר': 'drink', 'לימונדה': 'drink', 'יין': 'wine', 'יוגורט': 'dairy', 'גבינה': 'dairy', 'גבינת': 'dairy', "קוטג'": 'dairy', 'קוטג': 'dairy',
  'מעדן': 'dairy', 'שוקו': 'dairy', 'עוגיות': 'kisnin', 'עוגיה': 'kisnin', 'עוגה': 'kisnin', 'עוגת': 'kisnin', 'רוגלך': 'kisnin', 'קרואסון': 'kisnin', 'מאפה': 'mixture', 'קרקר': 'dry-crackers', 'קרקרים': 'dry-crackers',
  'לחם': 'bread', 'לחמניות': 'bread', 'לחמניה': 'bread', 'פיתה': 'bread', 'פיתות': 'bread', 'לאפה': 'bread', 'חלה': 'bread', 'באגט': 'bread', 'בגט': 'bread', 'פתיתים': 'grain-cooked', 'פסטה': 'grain-cooked',
  'מקרוני': 'grain-cooked', 'פנה': 'grain-cooked', 'פוזילי': 'grain-cooked', 'בורגול': 'grain-cooked', 'אורז': 'rice', 'מסטיק': 'gum', 'קפה': 'hot-drink', 'תה': 'hot-drink', 'טונה': 'animal',
  'ביצים': 'animal', 'עוף': 'animal', 'בשר': 'animal', 'סלמון': 'animal', 'דג': 'animal', 'דגים': 'animal', 'מרק': 'soup', 'אגוזי': 'nut', 'אגוזים': 'nut', 'שעועית': 'legume', 'עדשים': 'legume', 'גרגרי': 'legume',
  'חטיף': 'mixture', 'דגני': 'breakfast-cereal', 'גרנולה': 'breakfast-cereal', 'שיבולת': 'breakfast-cereal', 'משקה': 'drink',
  'פסטרמה': 'animal', 'סלמי': 'animal', 'פילה': 'animal', 'נתחי': 'animal', 'המבורגר': 'animal', 'קבב': 'animal', 'קבנוס': 'animal', 'חזה': 'animal', 'רוסטביף': 'animal', 'צלעות': 'animal', 'הרינג': 'animal', 'שווארמה': 'animal',
  'מאסט': 'dairy', 'בולגרית': 'dairy', 'לאבנה': 'dairy', 'לבנה': 'dairy', 'גאודה': 'dairy', 'מוצרלה': 'dairy', 'צפתית': 'dairy', 'קשקבל': 'dairy', 'מילקי': 'dairy', 'פודינג': 'dairy',
  'גלידת': 'ice-cream', 'ארטיק': 'ice-cream', 'שלגון': 'ice-cream', 'טילון': 'ice-cream', 'סורבה': 'ice-cream',
  'עגבניות': 'vegetable', 'כרובית': 'vegetable', 'ברוקולי': 'vegetable', 'אפונה': 'vegetable', 'פלפל': 'vegetable', 'מלפפונים': 'pickled', 'כרוב': 'pickled', 'אדממה': 'legume',
  'גומי': 'candy', 'טורטיה': 'bread', 'טורטייה': 'bread', 'טורטיות': 'bread', 'טוסט': 'bread', 'לחמניית': 'bread', 'מאפין': 'kisnin', 'בפלות': 'kisnin', 'ופלים': 'kisnin', 'וופלים': 'kisnin', 'קרוטונים': 'dry-crackers',
  'נודלס': 'grain-cooked', 'ראמן': 'grain-cooked', 'ניוקי': 'grain-cooked', 'רביולי': 'mixture', 'כיסונים': 'mixture', 'פתית': 'grain-cooked', 'קוואקר': 'breakfast-cereal',
  'סלט': 'mixture', 'כריך': 'mixture', 'פיצה': 'mixture', 'בורקס': 'mixture', 'תבשיל': 'mixture', 'ארוחת': 'mixture', 'מנה': 'mixture', 'חטיפי': 'mixture',
  'שוופס': 'drink', 'פרילי': 'drink', 'פריגת': 'drink', 'פאנטה': 'drink', 'לימונענע': 'drink', 'ריבת': 'jam', 'קונפיטורת': 'jam', 'גרעיני': 'nut',
};
const GRAIN_RULES = new Set(['bread', 'sweet-bread', 'kisnin', 'dry-crackers', 'grain-cooked']);
const unifyQuotes = text => text.replace(/[״”“]/g, '"').replace(/[׳’‘`]/g, "'");
const words = name => unifyQuotes(name).split(/[\s,.\-–()]+/).filter(Boolean);

export function classifyProduct(product, { rows }) {
  const rowNamed = name => rows.find(row => row.name === name);
  const cats = new Set(product.categories || []);
  const tags = [...(product.ingredientTags || []), ...(product.ingredients || [])];
  const first3 = (product.ingredients || []).slice(0, 3);
  // A grain named in the product's name counts too ("שוקולד לבן עוגיות", "חטיף דגנים").
  const hasGrain = grainIn(tags) || /(עוגיות|עוגייה|ביסקוויט|ביסקויט|ופל|וופל|קורנפלקס|דגנים|קרקר|בייגלה)/.test(unifyQuotes(product.name));
  const grainMain = grainIn(first3);
  const hasData = tags.length > 0;
  const name = unifyQuotes(product.name.trim());
  const head = words(name)[0] || '';
  const toRow = (rowName, via) => { const row = rowNamed(rowName); if (!row) throw new Error(`offRules: no row ${rowName}`); return { target: `b:${row.n}`, via }; };
  const toRule = (rule, via) => ({ target: `r:${rule}`, via });

  // 1. not eaten as it is
  if ((product.categories || []).some(tag => EXCLUDE.includes(tag))) return { target: null, reason: 'category not eaten on its own' };
  if (EXCLUDE_HEAD.includes(head)) return { target: null, reason: 'name: not eaten on its own' };
  if (/תינוק|תמ"ל|תחליף חלב/.test(name)) return { target: null, reason: 'baby food' };

  if (/מסטיק/.test(name)) return toRule('gum', 'name');
  if (/^(משקה|נקטר).*ענבים/.test(name)) return toRule('grape-drink', 'name');

  // 2. the product is a row of the table by name
  for (const [prefix, rowName] of NAME_ROWS) {
    if (!(name === prefix || name.startsWith(`${prefix} `) || name.startsWith(`${prefix},`))) continue;
    if (rowName === null) break;
    // Coated or mixed with something else: the row of the plain food does not describe it (עיקר וטפל).
    if (/(בשוקולד|מצופ|בציפוי|ציפוי)/.test(name) && !/(מצופ|שוקולד|דבש|סוכר)/.test(rowName) && rowName !== 'שוקולד') return toRule('mixture', 'name');
    if (prefix === 'חלב' && /(שקד|סויה|סויא|שיבולת|שבולת|קוקוס|אורז|צמחי|אגוז)/.test(name)) break;
    if ((prefix === "צ'יפס" || prefix === 'ציפס') && /תירס/.test(name)) return toRule('corn', 'name');
    if (prefix === 'פרכיות' && anyIn(tags, CORN, CORN_HE) && !anyIn(tags, RICE, RICE_HE)) return toRule('corn', 'ingredients');
    if (hasGrain && GRAIN_SENSITIVE_PREFIX.has(prefix) && !GRAIN_ROWS.has(rowName)) return toRule('grain-sweet', 'ingredients');
    return toRow(rowName, 'name');
  }

  // 3. category (and ingredients where the rule depends on them)
  for (const [list, action] of CATEGORY_RULES) {
    if (!list.some(tag => cats.has(tag))) continue;
    if (action.row) return toRow(action.row, 'category');
    if (action.potato) {
      if (cats.has('en:stacked-extruded-potato-crisps') || !anyIn(first3, POTATO, POTATO_HE)) return toRule('potato', 'category');
      return toRow('תפוצ\'יפס [חטיף]', 'category');
    }
    let rule = action.rule;
    if (action.grainNeeded) {
      if (anyIn(tags, RICE, RICE_HE) && !hasGrain) return toRule('rice', 'ingredients');
      if (anyIn(tags, CORN, CORN_HE) && !hasGrain) return toRule('corn', 'ingredients');
      if (hasData && !hasGrain) return toRule('mixture', 'ingredients');
      return toRule(rule, hasData ? 'ingredients' : 'category');
    }
    if (action.grainSensitive && hasGrain) return toRule(rule === 'animal' || rule === 'dairy' ? 'mixture' : 'grain-sweet', 'ingredients');
    if (action.grainSensitive && anyIn(tags, RICE, RICE_HE)) return toRule('mixture', 'ingredients');
    if (rule === 'drink' && cats.has('en:grape-juices')) rule = 'wine';
    if (action.last && grainMain) return toRule('grain-sweet', 'ingredients');
    return toRule(rule, 'category');
  }

  // 4. the head word of the name
  let rule = HEAD_RULES[head];
  if (!rule) return { target: null, reason: 'no rule applies' };
  if (rule === 'drink' && /(שיבולת|אורז)/.test(name)) rule = 'grain-drink';
  else if (rule === 'drink' && /(סויה|שקדים|קוקוס)/.test(name)) rule = 'plant-milk';
  else if (rule === 'drink' && /ענבים/.test(name)) rule = head === 'מיץ' ? 'wine' : 'grape-drink';
  else if (rule === 'bread' && /מתוק|מתוקה|בריוש/.test(name)) rule = 'sweet-bread';
  if (GRAIN_RULES.has(rule)) {
    if (anyIn(tags, RICE, RICE_HE) && !hasGrain) return toRule('rice', 'ingredients');
    if (anyIn(tags, CORN, CORN_HE) && !hasGrain) return toRule('corn', 'ingredients');
    if (hasData && !hasGrain) return toRule('mixture', 'ingredients');
  }
  if (rule === 'dairy' && /(צמחי|טבעוני|קשיו|שקדים|סויה|אגוז|קוקוס)/.test(name)) rule = 'mixture';
  if (['dairy', 'animal', 'candy', 'ice-cream'].includes(rule) && (hasGrain || anyIn(tags, RICE, RICE_HE))) rule = 'mixture';
  return toRule(rule, 'name');
}
