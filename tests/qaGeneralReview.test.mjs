// General QA pass (1.10.2026): defects found walking every route at 320/390/430/1280 in light, dark and other themes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/base.css');

test('no link is left in the browser default blue: the diaspora sources and the statement e-mail use the app link style', () => {
  assert.match(read('../src/components/DiasporaIndicator.jsx'), /<a className="link" href=\{source\.url\}/);
  assert.match(read('../src/pages/AccessibilityPage.jsx'), /<a className="link" href=\{mailtoHref\(\{ subject: REPORT_SUBJECT \}\)\}/);
});

test('a search field with no page styling never falls back to the browser grey bevelled box (also broken in dark themes)', () => {
  const rule = css.match(/:where\(\.clearable-input>input:not\(\[type=range\]\)\)\{([^}]*)\}/);
  assert.ok(rule, 'zero-specificity base rule for clearable inputs');
  for (const part of ['border:1px solid var(--control-border)', 'border-radius:var(--radius-sm)', 'background:var(--surface)', 'color:var(--ink)']) assert.ok(rule[1].includes(part), part);
});

test('the prayer compass does not print the sensor message twice before the sensor reads', () => {
  const compass = read('../src/pages/PrayerCompass.jsx');
  assert.match(compass, /sensorState === 'ready' \? qualityLabel : sensorMessage === status \? null : sensorMessage/);
});

test('the halacha search button reads "חפש" (unavailable) when the field is empty, never "ניקוי" with nothing to clear', () => {
  const halacha = read('../src/pages/HalachaLibrary.jsx');
  assert.match(halacha, /disabled=\{!hasQuery\} aria-label=\{isSubmitted \? 'ניקוי' : 'חפש'\}>\{isSubmitted \? 'ניקוי' : 'חפש'\}<\/button>/);
  assert.match(css, /\.halacha-search>div>button:disabled\{opacity:\.45;cursor:default\}/);
});

test('a primary action that is a link (נסיעה חדשה) has no browser underline', () => {
  assert.match(css, /a\.personal-primary\{display:inline-flex;align-items:center;justify-content:center;text-decoration:none\}/);
});

test('fast times pass hebcal an option it knows (noMinorFast), so no "Ignoring unrecognized option" console warning', async () => {
  const source = read('../src/services/fastTimes.mjs');
  assert.doesNotMatch(source, /noMinorFasts/);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const { fastsBetween } = await import('../src/services/fastTimes.mjs');
    const fasts = fastsBetween('2026-09-01', '2026-09-30', { il: true });
    assert.ok(fasts.length > 0, 'Tzom Gedaliah and Yom Kippur are still found');
  } finally { console.warn = original; }
  assert.ok(!warnings.some(w => /unrecognized HebrewCalendar option/.test(w)), warnings.join('\n'));
});
