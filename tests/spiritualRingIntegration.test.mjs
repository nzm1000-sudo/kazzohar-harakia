// Stage 4a — one snapshot, one decision for Today, one component in two places.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = read('../src/NewApp.jsx');
const shell = read('../src/components/Shell.jsx');
const today = read('../src/pages/TodayPage.jsx');

test('isTodayPage is the very decision that renders TodayPage (no second derivation)', () => {
  assert.match(app, /const routed = source \? <SourceReader/);
  assert.match(app, /: mode==='offline' \? <OfflineLibrary \/>\n\s*: null;\n\s*const isTodayPage = routed === null;/);
  assert.match(app, /\{routed \?\? <TodayPage/);
  assert.equal((app.match(/<TodayPage/g) || []).length, 1);
  assert.match(app, /<Shell isTodayPage=\{isTodayPage\} ring=\{ring\}/);
  assert.doesNotMatch(shell, /navRootFor\([^)]*\)\s*===\s*'today'/, 'Shell does not re-derive the Today condition');
  assert.match(shell, /ring && !isTodayPage && <SpiritualRing size="small"/);
});

test('one snapshot for every ring: computed once in NewApp, day/night from dayContext.afterSunset', () => {
  assert.equal((app.match(/useSpiritualPresence\(/g) || []).length, 1);
  assert.match(app, /dayOrNight: context\.afterSunset \? 'night' : 'day'/);
  assert.match(today, /<SpiritualRing size="large" todayProgress=\{ring\.todayProgress\} presenceLevel=\{ring\.presenceLevel\} dayOrNight=\{ring\.dayOrNight\}/);
  assert.match(shell, /todayProgress=\{ring\.todayProgress\} presenceLevel=\{ring\.presenceLevel\} dayOrNight=\{ring\.dayOrNight\}/);
});

test('the label appears only with the large ring on Today, nowhere else', () => {
  const files = ['../src/components/Shell.jsx', '../src/components/SpiritualRing.jsx', '../src/NewApp.jsx'];
  for (const f of files) assert.doesNotMatch(read(f), /מעגל הרוחני<\/|>מעגל הרוחני</, f);
  assert.match(today, /<p className="spiritual-circle-label">מעגל הרוחני<\/p>/);
});

test('exactly one ring component in the codebase; the logo itself is untouched', () => {
  assert.match(shell, /<span className="brand-mark-wrap"><span className=\{`brand-mark presence-/);
  assert.match(read('../src/styles/base.css'), /\.brand-ring\{position:absolute;top:50%;left:50%;transform:translate\(-50%,-50%\);pointer-events:none\}/);
});
