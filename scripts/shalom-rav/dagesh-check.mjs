// שלום רב — checks where the extraction placed each dagesh and shin/sin dot (the only points decided on letter seams)
// against every pointed word the app already holds (the siddurim and Tanakh): a word whose letters are known but whose
// dagesh/dot pattern matches no known spelling is listed for the visual review.
import { readFileSync, readdirSync } from 'node:fs';
const known = new Map();
const letters = w => w.replace(/[^א-ת]/g, '');
const dots = w => w.normalize('NFC').replace(/[^א-תּׁׂ]/g, '');
const add = text => { for (const w of String(text).split(/[\s־\-־,.:;()]+/)) { const k = letters(w); if (k.length > 1 && /[ְ-ּ]/.test(w)) { if (!known.has(k)) known.set(k, new Set()); known.get(k).add(dots(w)); } } };
const files = ['src/data/nusach/siddurSefard.mjs', 'src/data/nusach/siddurAshkenaz.mjs', 'src/data/nusach/siddurChabad.mjs', 'src/data/nusach/siddurChabadTehillatHashem.mjs', 'src/data/siddurOffline.mjs', 'src/data/tehillim.json', 'src/data/tanakh.json'];
for (const f of files) add(readFileSync(f, 'utf8'));
for (const f of readdirSync('src/data/liturgy')) add(readFileSync('src/data/liturgy/' + f, 'utf8'));
const pages = JSON.parse(readFileSync('sources/shalom-rav/extracted/pages.json', 'utf8')).pages;
let total = 0, same = 0; const diff = [];
for (const p of pages) for (const l of p.lines) {
  if (l.cls === 'prose' || l.cls === 'heading') continue;
  for (const w of l.text.split(/[\s־\-־,.:;()]+/)) {
    const k = letters(w);
    if (k.length < 2 || !known.has(k) || !/[ְ-ֻ]/.test(w)) continue;
    total++;
    if (known.get(k).has(dots(w))) same++; else diff.push(`${p.printedPage} ${w}  ~ ${[...known.get(k)].slice(0, 3).join(' | ')}`);
  }
}
console.log(`dagesh/dot pattern: ${total} known words, ${same} match a known spelling (${(100 * same / total).toFixed(2)}%), ${diff.length} to review`);
if (process.argv[2]) console.log(diff.slice(0, Number(process.argv[2])).join('\n'));
