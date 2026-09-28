// Authoring aid: prints the paragraphs of a rite's leaves (index, opening and closing words, small-print marker) so
// a composition's anchors can be chosen from the text itself. Usage:
//   node scripts/siddur/dump-leaf.mjs <nusach> <ref substring | regex> [--full]
import { loadSiddur } from '../../src/services/nusach.mjs';
import { plainText } from '../../src/services/prayer/riteServiceComposer.mjs';

const [nusach, pattern, flag] = process.argv.slice(2);
const pack = await loadSiddur(nusach);
const re = new RegExp(pattern);
for (const [ref, text] of Object.entries(pack.texts)) {
  if (!re.test(ref)) continue;
  console.log(`\n=== ${ref} (${text.he.length}¶)`);
  text.he.forEach((markup, i) => {
    const plain = plainText(markup);
    const small = /^\s*(<[^>]+>\s*)*<small/i.test(markup) ? 'S' : ' ';
    const big = /<big|<b>/.test(markup.slice(0, 40)) ? 'B' : ' ';
    if (flag === '--full') console.log(`${String(i).padStart(3)} ${small}${big} ${plain}`);
    else console.log(`${String(i).padStart(3)} ${small}${big} ${plain.slice(0, 90)}${plain.length > 90 ? ` … ${plain.slice(-45)}` : ''}`);
  });
}
