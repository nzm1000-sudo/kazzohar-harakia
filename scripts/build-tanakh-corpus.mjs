import fs from 'node:fs';
import path from 'node:path';

const [inputDir = '/tmp/tanach-xml', outputPath = 'src/data/tanakh.json'] = process.argv.slice(2);
const bookOrder = [
  ['Genesis', 'בראשית', 'Torah'], ['Exodus', 'שמות', 'Torah'], ['Leviticus', 'ויקרא', 'Torah'], ['Numbers', 'במדבר', 'Torah'], ['Deuteronomy', 'דברים', 'Torah'],
  ['Joshua', 'יהושע', 'Neviim'], ['Judges', 'שופטים', 'Neviim'], ['Samuel_1', 'שמואל א', 'Neviim'], ['Samuel_2', 'שמואל ב', 'Neviim'], ['Kings_1', 'מלכים א', 'Neviim'], ['Kings_2', 'מלכים ב', 'Neviim'], ['Isaiah', 'ישעיהו', 'Neviim'], ['Jeremiah', 'ירמיהו', 'Neviim'], ['Ezekiel', 'יחזקאל', 'Neviim'], ['Hosea', 'הושע', 'Neviim'], ['Joel', 'יואל', 'Neviim'], ['Amos', 'עמוס', 'Neviim'], ['Obadiah', 'עובדיה', 'Neviim'], ['Jonah', 'יונה', 'Neviim'], ['Micah', 'מיכה', 'Neviim'], ['Nahum', 'נחום', 'Neviim'], ['Habakkuk', 'חבקוק', 'Neviim'], ['Zephaniah', 'צפניה', 'Neviim'], ['Haggai', 'חגי', 'Neviim'], ['Zechariah', 'זכריה', 'Neviim'], ['Malachi', 'מלאכי', 'Neviim'],
  ['Psalms', 'תהילים', 'Ketuvim'], ['Proverbs', 'משלי', 'Ketuvim'], ['Job', 'איוב', 'Ketuvim'], ['Song_of_Songs', 'שיר השירים', 'Ketuvim'], ['Ruth', 'רות', 'Ketuvim'], ['Lamentations', 'איכה', 'Ketuvim'], ['Ecclesiastes', 'קהלת', 'Ketuvim'], ['Esther', 'אסתר', 'Ketuvim'], ['Daniel', 'דניאל', 'Ketuvim'], ['Ezra', 'עזרא', 'Ketuvim'], ['Nehemiah', 'נחמיה', 'Ketuvim'], ['Chronicles_1', 'דברי הימים א', 'Ketuvim'], ['Chronicles_2', 'דברי הימים ב', 'Ketuvim'],
];
const finalLetters = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const normalize = text => String(text).replace(/[\u0591-\u05C7]/g, '').replace(/[\u05BE\u05C0\u05C3\u05F3\u05F4\u200C\u200D]/g, '').replace(/[^א-ת]/g, '');
const letter = value => finalLetters[value] || value;
const decode = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const books = [];
const index = [];
for (const [id, hebrewName, division] of bookOrder) {
  const file = path.join(inputDir, 'Books', `${id}.xml`);
  if (!fs.existsSync(file)) throw new Error(`Missing UXLC book: ${file}`);
  const xml = fs.readFileSync(file, 'utf8');
  const verses = [];
  for (const chapterMatch of xml.matchAll(/<c n="(\d+)">([\s\S]*?)<\/c>/g)) {
    const chapter = Number(chapterMatch[1]);
    for (const verseMatch of chapterMatch[2].matchAll(/<v n="(\d+)">([\s\S]*?)<\/v>/g)) {
      const verse = Number(verseMatch[1]);
      const text = [...verseMatch[2].matchAll(/<w>([\s\S]*?)<\/w>/g)].map(match => decode(match[1])).join(' ');
      const letters = normalize(text);
      if (!text || !letters) throw new Error(`Empty verse: ${id} ${chapter}:${verse}`);
      verses.push([chapter, verse, text]);
      index.push([id, chapter, verse, letter(letters[0]), letter(letters.at(-1))]);
    }
  }
  books.push({ id, hebrewName, division, verses });
}

const output = {
  meta: {
    source: 'Tanach.us',
    version: 'Unicode/XML Leningrad Codex (UXLC) 2.5',
    build: '27.6',
    date: '2026-04-01',
    license: 'All biblical Hebrew text may be viewed or copied without restriction; citation appreciated.',
    sourceUrl: 'https://www.tanach.us/License.html',
    citation: 'Unicode/XML Leningrad Codex: UXLC 2.5 (27.6), Tanach.us Inc., Apr 2026.',
  },
  books,
  index,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(JSON.stringify({ books: books.length, verses: index.length, bytes: fs.statSync(outputPath).size, outputPath }));