// Siddur text integrity after block splitting: no orphaned brackets or stray punctuation anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { normalizeSiddurBlocks, rebalanceParentheses, attachLeadingPunctuation } from '../src/services/siddurBlocks.mjs';
import { getText } from '../src/services/sefaria.mjs';

const strip = s => String(s).replace(/[֑-ׇ]/g, '');
const blocksFor = async ref => {
  const t = await getText(ref, 'nikud');
  const paras = t.hebrew.map((value, index) => ({ text: value, source: t.indexes?.[index] ?? index }));
  return normalizeSiddurBlocks(paras, { title: ref, markup: paras.map(p => t.siddurMarkup?.[p.source] || p.text), context: {} });
};
const balanced = text => { let d = 0; for (const c of text) { if (c === '(') d++; else if (c === ')') { d--; if (d < 0) return false; } } return d === 0; };
// Printed in the edition itself with a reversed bracket: "(זכרון תרועה באהבה(" — prayer text is never altered.

test('Birkat HaMazon: each condition on its own line, each addition whole, the fixed text separated', async () => {
  const blocks = (await blocksFor('Siddur Edot HaMizrach, Post Meal Blessing')).map(b => [b.type, strip(b.text)]);
  const at = blocks.findIndex(([, t]) => t === 'ברשות מלכא עלאה קדישא');
  assert.ok(at >= 0, 'opening words without a dangling bracket');
  assert.deepEqual(blocks.slice(at + 1, at + 8), [
    ['conditionalAddition', 'בשבת'], ['recitedText', 'וברשות שבת מלכתא.'],
    ['conditionalAddition', 'ביו״ט'], ['recitedText', 'וברשות יומא טבא אושפיזא קדישא.'],
    ['conditionalAddition', 'בסוכה'], ['recitedText', 'וברשות שבעה אושפיזין עלאין קדישין'],
    // The condition in parentheses stays inside the line it belongs to (shown as a direction, not said text).
    ['recitedText', 'וברשות מורי ורבותי וברשותכם. נברך (בעשרה ויותר: אלהינו) שאכלנו משלו:'],
  ]);
  const zimmun = (await blocksFor('Siddur Edot HaMizrach, Post Meal Blessing')).find(b => strip(b.text).startsWith('וברשות מורי ורבותי'));
  assert.equal(zimmun.segments.find(segment => strip(segment.text) === '(בעשרה ויותר: אלהינו)').kind, 'instruction');
});

test('whole Siddur (every text): brackets balanced in every line, no line starts with stray punctuation', async () => {
  const refs = Object.keys(siddurOffline.texts).filter(r => r.startsWith('Siddur Edot HaMizrach'));
  assert.ok(refs.length > 100);
  const problems = [];
  for (const ref of refs) {
    for (const block of await blocksFor(ref)) {
      const text = strip(block.text);
      if (!balanced(text)) problems.push(`${ref}: ${text.slice(0, 60)}`);
      if (/^\s*[.,:;)]/.test(text)) problems.push(`${ref} starts with punctuation: ${text.slice(0, 40)}`);
      if (/\(\s*$/.test(text)) problems.push(`${ref} ends with "(": ${text.slice(-40)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('rebalancing keeps brackets that are balanced inside one piece exactly as printed', () => {
  const parts = rebalanceParentheses([{ type: 'recitedText', text: 'נברך' }, { type: 'conditionalAddition', text: '(בעשרה ויותר: אלהינו)' }, { type: 'recitedText', text: 'שאכלנו משלו:' }]);
  assert.deepEqual(parts.map(p => p.text), ['נברך', '(בעשרה ויותר: אלהינו)', 'שאכלנו משלו:']);
  assert.deepEqual(attachLeadingPunctuation([{ type: 'conditionalAddition', text: 'ורב חסד' }, { type: 'recitedText', text: ': ישוב ירחמנו' }]).map(p => p.text), ['ורב חסד:', 'ישוב ירחמנו']);
  assert.deepEqual(attachLeadingPunctuation([{ type: 'rubric', text: 'יפנה לצד ימין' }, { type: 'recitedText', text: ',' }]).map(p => p.text), ['יפנה לצד ימין,']);
});
