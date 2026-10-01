// Builds the hand-made test fixture of the Torah content engine (the "בני ציון" data contract, docs/bnei-zion/SCHEMA.md).
// Every text is a placeholder marked "דוגמה לבדיקה" — nothing here is from the archive, and none of it ever ships.
//   node tests/fixtures/torahContentSample/build-fixture.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../../src/services/prayer/checksum.mjs';
import { normalizeHebrew } from '../../../src/content.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const MARK = 'דוגמה לבדיקה';
const filler = (title, n) => Array.from({ length: n }, (_, i) => `${MARK} · פסקה ${i + 1} של "${title}". זהו טקסט מדומה לבדיקת המנוע בלבד, ואינו מן המאגר. הוא נועד לבדוק פסקאות, אורך קריאה, חיפוש ותצוגה נקייה וברורה בכל גודל טקסט.`);

// [id, title, contentType, parashot, holidays, special, topics, readMinutes, pack, paragraphs, extra words]
const A = [
  ['bz-bereshit-01', 'אור ראשון', 'short', ['בראשית'], [], [], ['אמונה'], 2, 'bereshit', 2, 'בריאת האור'],
  ['bz-bereshit-02', 'שבת של בריאה', 'deep', ['בראשית'], [], [], ['שבת', 'אמונה'], 7, 'bereshit', 6, 'מנוחה וקדושה'],
  ['bz-bereshit-03', 'מעשה בעץ הגן', 'story', ['בראשית'], [], [], ['חינוך'], 4, 'bereshit', 3, 'סיפור על גן'],
  ['bz-bereshit-04', 'איכה — שאלה לילדים', 'family', ['בראשית'], [], [], ['משפחה', 'חינוך'], 3, 'bereshit', 3, 'שאלה פתוחה'],
  ['bz-bereshit-05', 'צלם אלוקים', 'short', ['בראשית'], [], [], ['כבוד הבריות'], 2, 'bereshit', 2, 'כבוד האדם'],
  ['bz-bereshit-06', 'קין והבל — עיון', 'deep', ['בראשית'], [], [], ['מידות'], 9, 'bereshit', 7, 'קנאה ותשובה'],
  ['bz-lechlecha-01', 'לך לך — יציאה לדרך', 'short', ['לך לך'], [], [], ['אמונה'], 3, 'bereshit', 2, 'אברהם אבינו'],
  ['bz-lechlecha-02', 'הכנסת אורחים במסע', 'story', ['לך לך'], [], [], ['חסד'], 5, 'bereshit', 4, 'אהל פתוח'],
  ['bz-yitro-01', 'כאיש אחד בלב אחד', 'short', ['יתרו'], [], [], ['אחדות'], 2, 'shemot', 2, 'מעמד הר סיני'],
  ['bz-yitro-02', 'עצת יתרו', 'deep', ['יתרו'], [], [], ['הנהגה'], 6, 'shemot', 5, 'שרי אלפים'],
  ['bz-yitro-03', 'הסבא שבא לבית הכנסת', 'story', ['יתרו'], [], [], ['משפחה'], 4, 'shemot', 3, 'סיפור לשבת'],
  ['bz-yitro-04', 'כבד את אביך', 'family', ['יתרו'], [], [], ['משפחה', 'כיבוד הורים'], 3, 'shemot', 2, 'עשרת הדברות'],
  ['bz-yitro-05', 'זכור את יום השבת', 'deep', ['יתרו'], [], [], ['שבת'], 8, 'shemot', 6, 'זכירה ושמירה'],
  ['bz-tetzave-01', 'זכירת עמלק', 'deep', ['תצווה'], [], ['shabbat-zachor'], ['זיכרון'], 6, 'shemot', 4, 'שבת זכור'],
  ['bz-tazria-metzora-01', 'לשון הרע ותיקונה', 'deep', ['תזריע', 'מצורע'], [], [], ['שמירת הלשון'], 7, 'vayikra', 5, 'נגעים ודיבור'],
  ['bz-tazria-01', 'לידה של חיים', 'short', ['תזריע'], [], [], ['משפחה'], 2, 'vayikra', 2, 'אם ובנה'],
  ['bz-metzora-01', 'הבית שדיבר', 'story', ['מצורע'], [], [], ['שמירת הלשון'], 4, 'vayikra', 3, 'סיפור על בית'],
  ['bz-purim-01', 'ונהפוך הוא', 'short', [], ['purim'], [], ['שמחה'], 2, 'moadim', 2, 'מגילת אסתר'],
  ['bz-purim-02', 'משלוח מנות של אהבה', 'story', [], ['purim'], [], ['חסד', 'אחדות'], 4, 'moadim', 3, 'רעות'],
  ['bz-purim-03', 'הסתר פנים', 'deep', [], ['purim'], [], ['אמונה'], 7, 'moadim', 5, 'נס נסתר'],
  ['bz-pesach-01', 'והגדת לבנך', 'family', [], ['pesach'], [], ['חינוך', 'משפחה'], 3, 'moadim', 3, 'ליל הסדר'],
  ['bz-pesach-02', 'חירות של אמת', 'deep', [], ['pesach'], [], ['אמונה'], 8, 'moadim', 6, 'עבדות וחירות'],
  ['bz-sukkot-01', 'צל האמונה', 'short', [], ['sukkot'], [], ['אמונה'], 2, 'moadim', 2, 'סוכה'],
];

const index = { version: 'fixture-1', generatedAt: '2026-10-01T00:00:00Z', articles: [], parashot: {}, holidays: {}, topics: {}, packs: {} };
const packs = {};
const docs = [];
// The early fixture's kinds, in the archive's vocabulary (docs/bnei-zion/SCHEMA.md): a longer piece of commentary is
// "commentary"; short and longer divrei torah are "dvar-torah"; stories and family pieces keep their kind.
const KIND = { short: 'dvar-torah', deep: 'dvar-torah', story: 'story', family: 'family' };
const COMMENTARY = new Set(['bz-yitro-02', 'bz-bereshit-06', 'bz-tazria-metzora-01']);
const HEADINGS = { 'bz-yitro-02': 'עצת יתרו — ״לא טוב הדבר אשר אתה עשה״ (י״ח, י״ז) · דוגמה לבדיקה' };
for (const [id, title, rawType, parashot, holidays, specialShabbatot, topics, readMinutes, pack, count, extra] of A) {
  const contentType = COMMENTARY.has(id) ? 'commentary' : KIND[rawType];
  const shabbatTable = contentType === 'story' && readMinutes <= 4 ? true : undefined;
  const paragraphs = filler(title, count);
  paragraphs[0] = `${extra}. ${paragraphs[0]}`;
  index.articles.push({ id, title, ...(HEADINGS[id] ? { heading: HEADINGS[id] } : {}), contentType, parashot, holidays, specialShabbatot, topics, readMinutes, year: 'תשפ״ו', ...(shabbatTable ? { shabbatTable } : {}), pack, excerpt: paragraphs[0].slice(0, 140) });
  for (const name of parashot) (index.parashot[name] ||= []).push(id);
  for (const name of holidays) (index.holidays[name] ||= []).push(id);
  for (const name of topics) (index.topics[name] ||= []).push(id);
  (packs[pack] ||= { articles: {} }).articles[id] = {
    paragraphs,
    source: { collection: 'בני ציון', author: 'משה מזרחי', originalPdf: `fixture/${pack}.pdf`, pageStart: 1, pageEnd: 2 },
    sourceAppearances: [{ issue: `${MARK} 1`, year: 'תשפ״ו' }],
    rights: { permission: 'granted', creditRequired: true, note: 'שימוש באישור מפורש של בעל הזכויות' },
    extraction: { method: 'fixture', confidence: 1 },
    status: 'published',
  };
  docs.push({ id, t: normalizeHebrew(title), m: normalizeHebrew([...parashot, ...holidays, ...specialShabbatot, ...topics, contentType, 'בני ציון', 'משה מזרחי'].join(' ')), x: normalizeHebrew(paragraphs.join(' ')) });
}
mkdirSync(`${here}packs`, { recursive: true });
for (const [name, pack] of Object.entries(packs)) {
  const text = JSON.stringify(pack);
  // One pack as gzip (the shipping format), the others plain JSON: the engine reads both, by their magic bytes.
  const gz = name === 'moadim';
  const file = gz ? `${name}.json.gz` : `${name}.json`;
  writeFileSync(`${here}packs/${file}`, gz ? gzipSync(text) : text);
  index.packs[name] = { file, checksum: checksum(text), articles: Object.keys(pack.articles).length };
}
const header = `// ${MARK} — a hand-made fixture of the "בני ציון" data contract (docs/bnei-zion/SCHEMA.md) for tests and the dev preview.\n// Placeholder text only; never shipped. Regenerate: node tests/fixtures/torahContentSample/build-fixture.mjs\n`;
writeFileSync(`${here}index.mjs`, `${header}export default ${JSON.stringify(index, null, 1)};\n`);
writeFileSync(`${here}search.mjs`, `${header}export default ${JSON.stringify({ version: 'fixture-1', docs })};\n`);
console.log(`${A.length} articles, ${Object.keys(packs).length} packs`);
