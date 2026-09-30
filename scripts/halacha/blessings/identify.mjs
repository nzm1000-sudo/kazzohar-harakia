// מנוע הברכות — what a food IS, from its whole name, before any category rule is applied.
//
// Why this exists (the errors it fixes): the old build matched a product to a row of the table when its name merely
// BEGAN with the row's first word — "אגוזי מלך קלופים" and "אגוזי פקאן קלופים" became the "אגוזי" chocolate bar
// (שהכל), "אטריות אורז" became wheat noodles, "פריכיות חיטה/עדשים/תירס" became rice cakes, "מצות מתפוחי אדמה" became
// matzah. A single word ("אגוז", "שוקולד", "דגן", "ממרח") must never decide alone. Here a name is read word by word:
//   1. a plain nut (every other word only says how it is sold: קלופים, קלויים, טבעיים, 200 גרם…);
//   2. products whose identity is known and whose ruling was checked against named sources (wafer bars, spreads,
//      ice-cream forms, cereal bars, tortillas, pizza, filled dough, sandwiches);
//   3. otherwise null — the caller goes on to its own (guarded) steps, and in the end to "טרם אומת", never to a guess.
// Every result says which step decided it (via). Pure functions: the tests call them directly.

const unifyQuotes = text => String(text || '').replace(/[״”“]/g, '"').replace(/[׳’‘`]/g, "'");
export const nameWords = name => unifyQuotes(name).replace(/[(),.;:!?/\\\-–+&]+/g, ' ').split(/\s+/).filter(Boolean);
const has = (words, re) => words.some(word => re.test(word));

// ------------------------------------------------------------------------------------------- 1. plain nuts
// kind 'tree' → העץ / נפשות (rule tree-nut); 'peanut' → the table's row בוטנים (האדמה / נפשות).
const NUTS = [
  { words: [['אגוזי', 'מלך'], ['אגוז', 'מלך']], kind: 'tree' },
  { words: [['אגוזי', 'פקאן'], ['אגוז', 'פקאן'], ['פקאן'], ['פקאנים']], kind: 'tree' },
  { words: [['אגוזי', 'לוז'], ['אגוז', 'לוז'], ['לוז'], ['בונדוק']], kind: 'tree' },
  { words: [['אגוזי', 'קשיו'], ['אגוז', 'קשיו'], ['קשיו']], kind: 'tree' },
  { words: [['אגוזי', 'מקדמיה'], ['מקדמיה']], kind: 'tree' },
  { words: [['אגוזי', 'ברזיל'], ['אגוז', 'ברזיל']], kind: 'tree' },
  { words: [['פיסטוק'], ['פיסטוקים'], ['אגוז', 'פיסטוק']], kind: 'tree' },
  { words: [['שקדים'], ['שקד']], kind: 'tree' },
  { words: [['צנוברים'], ['צנובר']], kind: 'tree' },
  { words: [['אגוזים'], ['אגוז', 'עץ']], kind: 'tree' },
  { words: [['בוטנים'], ['בוטן']], kind: 'peanut' },
];
// Words that only say how the nut is sold. Anything else (מצופה, מסוכר, שוקולד, ממרח, חטיף, מיקס of other foods…)
// means it is not a plain nut.
const SOLD_AS = /^(ו?קלופים|קלוף|קלופות|ו?קלויים|קלוי|קלויות|קלייה|טבעיים|טבעי|טבעיות|ו?מלוחים|מלוח|ממולחים|ו?מומלחים|מומלח|ללא|בלי|מלח|שלמים|שלם|חצאים|גרוסים|גרוס|פרוסים|פרוסות|פרוס|סיניים|סיני|אורגניים|אורגני|טריים|טרי|ענק|גדולים|מובחרים|איכותיים|משובחים|בקליפה|קליפה|יבשים|חיים|לא|קלים|במשקל|אריזה|אריזת|חסכון|משפחתית|קטנה|גדולה|מארז|שקית|\d+|\d+%|גרם|גר|ג|ק"ג|קג|ק|ג')$/;
export function plainNut(name) {
  const words = nameWords(name);
  for (const nut of NUTS) for (const phrase of nut.words) {
    const at = words.findIndex((word, index) => phrase.every((part, k) => words[index + k] === part));
    if (at < 0) continue;
    const rest = [...words.slice(0, at), ...words.slice(at + phrase.length)];
    if (rest.every(word => SOLD_AS.test(word))) return nut.kind;
  }
  return null;
}

// ------------------------------------------------------------------------------------------- 2. known identities
const GRAIN_WORDS = /^(ו?עוגיות|ו?עוגייה|ו?עוגיה|ו?ביסקוויט|ו?ביסקויט|ו?ביסקוויטים|ו?ופל|ו?וופל|ו?ופלים|ו?וופלים|ו?בראוני|ו?בראוניז|ו?בראוניס|ו?בייגלה|ו?עוגה|ו?קרקר|ו?פתי|ו?לוטוס|ו?אוראו)$/;
const COATED = /^(מצופה|מצופים|מצופות|בציפוי|ציפוי|מסוכר|מסוכרים|ממותק|ממותקים|מקורמל|מקורמלים|בקרמל|בשוקולד|בדבש|בסוכר)$/;
const NUT_SPREAD = /^(שקדים|בוטנים|אגוזים|קשיו|פיסטוק|לוז)$/;

export function knownIdentity(name, { brand = '' } = {}) {
  const words = nameWords(name);
  const text = words.join(' ');
  const brandText = unifyQuotes(brand);
  const r = (rule, via = 'identity') => ({ target: `r:${rule}`, via });
  const first = words[0] || '';
  const drinkOrDairy = /^(משקה|מילקי|יוגורט|מעדן|גלידה|גלידת|טילון|שלגון|ארטיק|רולדה|עוגה|עוגת|שוקו)$/.test(first);

  // Wafer bars. Their names are brand names; the identity (a wafer coated with chocolate) is the maker's own
  // ingredient list (טורטית: "ופל מצופה (30%)… קמח חיטה"). A drink, a dairy dessert or an ice cream named after the
  // bar is not the bar.
  if (!drinkOrDairy && /(^| )(טורטית|כיף כף|כיף כיף|פסק זמן|קיט קט|קיטקט|קינדר בואנו|דופלו)( |$)/.test(text)) return r('coated-wafer');
  if (/^(וופלים|ופלים|וופל|ופל|בפלות)$/.test(first) && words.length > 1) return has(words, COATED) || has(words, /^מצופ/) ? r('coated-wafer') : r('wafer');

  // Spreads (the Open Food Facts categories that were left out as "not eaten on their own").
  if (/^(ממרח|חמאת)$/.test(first)) {
    if (/^(שוקולד|נוטלה|קקאו)$/.test(words[1] || '') || (words[1] === 'אגוזי' && words[2] === 'לוז')) return r('sweet-spread');
    if (NUT_SPREAD.test(words[1] || '') || (words[1] === 'אגוזי' && /^(מלך|לוז)$/.test(words[2] || ''))) return r('nut-butter');
  }
  if (first === 'נוטלה') return r('sweet-spread');

  // Ice cream: a cone (טילון) is always a cone — the name says so, whatever the brand (מגנום, נסטלה…). Grain pieces
  // inside the ice cream are a question of their own; a sandwich between biscuits is the table's קסטה row (caller).
  if (first === 'טילון' || text.startsWith('גביע גלידה')) return r('ice-cream-cone');
  if (/^(גלידה|גלידת|שלגון|ארטיק|קרמיסימו|מגנום)$/.test(first) || /^(מגנום|magnum)$/i.test(brandText)) {
    if (/קסטה/.test(text)) return null;
    if (has(words, GRAIN_WORDS) || /פסק זמן|קראנצ'י/.test(text)) return r('ice-cream-grain');
    return r('ice-cream');
  }

  // Cereal bars. The Energy (אנרג'י) and Corny bars are named in Rav Ofir Malka's table (מזונות / נפשות); a bar
  // called "חטיף דגנים" of another maker needs its ingredients (the rule asks).
  if (/^(חטיף|חטיפי)$/.test(first) && /^(דגנים|שיבולת|רב|גרנולה)$/.test(words[1] || '')) {
    if (/^(אנרג'י|אנרגי|energy|corny|קורני)$/i.test(brandText.trim()) && !/(טעמי|עוגיות|ביסקוויט)/.test(text)) return r('cereal-bar-grain', 'brand');
    return r('cereal-bar');
  }

  // Tortillas (הלכה יומית: wheat → המוציא; corn, lentil or chickpea flour → שהכל).
  if (/^(טורטיה|טורטייה|טורטיות|טורטיית|טורטייות)$/.test(first) || text.startsWith('חטיפי טורטיה')) {
    if (/^חטיפי/.test(first)) return /תירס/.test(text) ? r('corn') : null;
    if (has(words, /^(תירס|חומוס|עדשים)$/) && !has(words, /^(חיטה|ו?חיטה)$/)) return r('corn-tortilla');
    return r('tortilla');
  }

  if (first === 'פיצה' || (first === 'פיצות')) return r('pizza');
  if (/^(בורקס|בורקסים|כיסונים|רביולי|קרפלך|סמבוסק|סמבוסק'|אמפנדה|פירושקי|מאפה)$/.test(first) && !/^מאפה$/.test(text)) {
    if (first === 'מאפה' && !has(words, /^(במילוי|ממולא|ממולאים)$/)) return null;
    return r('filled-dough');
  }
  if (/^(כריך|טוסט)$/.test(first) && !/פסח/.test(text)) return r('sandwich');
  return null;
}

// ------------------------------------------------------------------------------------------- 3. not what a row says
// A name that begins with a row's words is that row only if nothing else in it changes the food. Words after "בטעם"
// only give a flavour.
const CHANGES_FOOD = /^(ו?אורז|ו?תירס|ו?חיטה|ו?כוסמין|ו?כוסמת|ו?קינואה|ו?עדשים|ו?חומוס|ו?אפונה|ו?תפוחי|ו?תפוח|תפו"א|ו?שוקולד|ו?ופל|ו?וופל|ו?ביסקוויט|ו?עוגיות|ו?דגנים|ו?קמח|ו?פסטה|ו?טונה|ו?בשר|ו?עוף|ו?גבינה|ו?בראוני|ו?בראוניס|ו?בראוניז|דובאי|ו?קורנפלקס|ו?פצפוצים|ו?עוגייה|ו?עוגיה|קונג'אק|קונג׳אק|מצופה|מצופים|בציפוי|ציפוי|ממולא|ממולאים|במילוי|מילוי|ו?קרמל|מסוכר|ממותק|מקורמל|מקורמלים|גלוטן|צמחי|הצומח|מהצומח|טבעוני|טבעוניות|טבעוניים|צמחוני|צמחוניות|סויה|טופו|מיקס|mix|ו?במבה|ו?ביסלי|בייגלה|ו?טחינה|ו?אגוזי|מקדמיה|כורכום|ו?בננה|ו?תפוז|ו?פסיפלורה|ו?מנגו)$/;
export function changesFood(name, rowWords, allowed = null, rowName = '') {
  const words = nameWords(name).slice(rowWords);
  const own = new Set(nameWords(rowName.replace(/[\[\]]/g, ' ')));
  let flavour = false;
  for (const word of words) {
    if (/^(בטעם|טעם|בטעמי)$/.test(word)) { flavour = true; continue; }
    if (flavour) continue;
    if (allowed && allowed.test(word)) continue;
    if (own.has(word)) continue; // the row's own words ("עלי גפן ממולאים באורז")
    // Hebrew prefixes (ו, מ, ב, ה, ל, ש) do not change the word: 'מתפוחי אדמה' is 'תפוחי אדמה'.
    if (CHANGES_FOOD.test(word) || (word.length > 3 && CHANGES_FOOD.test(word.replace(/^[ומבהלש]/, '')))) return word;
  }
  return null;
}

// ------------------------------------------------------------------------------------------- 4. names
// A display name must be a proofread name: no word joined to the next ("אגוזיםושוקולד"), no final letter inside a word,
// no stray punctuation. The build proofreads the names it shows (NAME_FIXES in curation.mjs) and leaves out any other
// name that fails here.
export function nameProblem(name) {
  const text = String(name || '');
  if (!text.trim()) return 'empty';
  if (/\s{2,}|^\s|\s$/.test(text)) return 'spacing';
  if (/[ךםןףץ][א-ת]/.test(text)) return 'final letter inside a word';
  if (/[א-ת]{13,}/.test(text)) return 'suspiciously long word';
  if (/&quot;|&amp;|[{}<>]|\.\s*[א-ת]/.test(text) && !/\d\.\d/.test(text)) return 'markup or stray punctuation';
  return null;
}
