// Stage 5 safety: crash-proof composition, versioned+validated sessions, pack contract over two years,
// and the legacy Mincha rules verified side-by-side against the new facts→rules layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeCompose, engineEnabled, PRAYER_ENGINE_FLAGS } from '../src/services/prayer/composition.mjs';
import { composeWeekdayMincha, validatePrayerDocument, WEEKDAY_MINCHA_PACK } from '../src/services/prayer/weekdayMinchaComposer.mjs';
import { createPrayerSession, documentForSession, isValidSession, loadOpenSession, saveSession, sessionInputs, SESSION_STORAGE_KEY, SESSION_SCHEMA_VERSION } from '../src/services/prayer/prayerSession.mjs';
import { computePrayerDayFacts } from '../src/services/prayer/prayerDayFacts.mjs';
import { resolvePrayerRules } from '../src/services/prayer/prayerRules.mjs';

const JLM = { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235, source: 'manual' };
const NYC = { tzid: 'America/New_York', latitude: 40.7128, longitude: -74.006, source: 'manual' };
const IL = { location: JLM, halachicResidenceStatus: 'israel' };
const DIA = { location: NYC, halachicResidenceStatus: 'diaspora' };
function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; }
const read = s => readFileSync(new URL(s, import.meta.url), 'utf8');

test('safeCompose never throws: a throwing composer becomes a result with a reason', () => {
  const seen = [];
  const bad = safeCompose(() => { throw new TypeError("Cannot read properties of undefined (reading 'he')"); }, { onError: e => seen.push(e.message) });
  assert.deepEqual([bad.ok, bad.reason, bad.error.name], [false, 'composer-threw', 'TypeError']);
  assert.equal(seen.length, 1);
  assert.equal(safeCompose(() => ({ nope: true })).reason, 'invalid-document');
  const good = safeCompose(() => composeWeekdayMincha({ now: new Date('2026-11-24T12:00:00Z'), settings: IL }));
  assert.equal(good.ok, true);
  assert.equal(safeCompose(() => { throw new Error('x'); }, { onError: () => { throw new Error('reporter broke'); } }).ok, false, 'a broken reporter cannot re-throw');
});

test('kill switch: the reader routes to the printed edition when a prayer is switched off', () => {
  assert.equal(engineEnabled(WEEKDAY_MINCHA_PACK.id), true);
  assert.equal(engineEnabled('edot-hamizrach.weekday-maariv'), false, 'nothing is enabled implicitly');
  assert.ok(Object.isFrozen(PRAYER_ENGINE_FLAGS));
  const reader = read('../src/components/SourceReader.jsx');
  assert.match(reader, /engineEnabled\(WEEKDAY_MINCHA_PACK\.id\)/);
  assert.match(reader, /<ReaderErrorBoundary fallback=\{printed\}>/);
});

test('sessions: schema version in the key; invalid records are dropped, never dereferenced', () => {
  assert.equal(SESSION_STORAGE_KEY, `kz-prayer-sessions-v${SESSION_SCHEMA_VERSION}`);
  const storage = memoryStorage();
  const inputs = sessionInputs({ now: new Date('2026-11-24T10:00:00Z'), settings: IL, times: { sunrise: '2026-11-24T04:20:00Z', sunset: '2026-11-24T14:37:00Z' } });
  const session = createPrayerSession(inputs);
  assert.equal(session.schemaVersion, SESSION_SCHEMA_VERSION);
  assert.equal(isValidSession(session), true);
  assert.equal(saveSession(session, storage), true);
  assert.ok(loadOpenSession({ prayerDate: session.prayerDate, now: new Date('2026-11-24T11:00:00Z'), storage }));
  // Corrupt shapes that once crashed the reader: missing inputs, blockIds not an array, old schema.
  for (const broken of [{ ...session, inputs: undefined }, { ...session, blockIds: 'amida.1' }, { ...session, schemaVersion: 1 }, { ...session, inputs: { ...session.inputs, preferences: null } }, 'garbage', null]) {
    assert.equal(isValidSession(broken), false);
    assert.equal(documentForSession(broken), null);
    assert.equal(saveSession(broken, storage), false);
  }
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ [session.prayer]: { ...session, blockIds: 'amida.1' } }));
  assert.equal(loadOpenSession({ prayerDate: session.prayerDate, now: new Date('2026-11-24T11:00:00Z'), storage }), null, 'a corrupt stored session is ignored');
  storage.setItem(SESSION_STORAGE_KEY, '{not json');
  assert.equal(loadOpenSession({ prayerDate: session.prayerDate, now: new Date(), storage }), null);
});

test('personal verses are frozen with the session and rebuild identically', () => {
  const verses = [{ id: 'Psalms.23.1', text: 'מזמור לדוד', reference: 'תהלים כג, א', sourceReference: 'Psalms 23:1', name: 'דוד' }];
  const inputs = sessionInputs({ now: new Date('2026-11-24T10:00:00Z'), settings: IL, times: { sunrise: '2026-11-24T04:20:00Z', sunset: '2026-11-24T14:37:00Z' }, preferences: { personalVerses: verses } });
  const session = createPrayerSession(inputs);
  assert.ok(session.blockIds.some(id => id.endsWith('personal.verse.1')));
  assert.ok(documentForSession(session), 'the frozen document rebuilds with its verse');
});

test('pack contract: the real Mincha pack composes every day for two years, with and without zmanim, never throws, always valid', () => {
  const statuses = new Set();
  for (const settings of [IL, DIA]) {
    for (let t = Date.UTC(2025, 9, 1); t <= Date.UTC(2027, 9, 10); t += 864e5) {
      const date = new Date(t).toISOString().slice(0, 10);
      for (const times of [{ sunrise: `${date}T04:30:00Z`, sunset: `${date}T15:30:00Z` }, null]) {
        const result = safeCompose(() => composeWeekdayMincha({ now: new Date(`${date}T12:00:00Z`), settings, times, preferences: { personalVerses: [{ id: 'x', text: 'פסוק', reference: 'r', sourceReference: 's', name: 'n' }] } }));
        assert.equal(result.ok, true, `${date} ${settings.halachicResidenceStatus} ${times ? 'zmanim' : 'no-zmanim'}: ${result.error?.message}`);
        const { document } = result.composed;
        assert.deepEqual(validatePrayerDocument(document), [], `${date} structure`);
        assert.ok(['adapted', 'partial', 'needs-input', 'unsupported'].includes(document.status), `${date} status ${document.status}`);
        statuses.add(document.status);
        const amida = document.sections.find(s => s.id === 'amida').blocks;
        assert.equal(amida.filter(b => b.personal).length, 1, `${date} exactly one personal verse`);
        if (!times) assert.notEqual(document.status, 'adapted', `${date}: missing zmanim can never be "adapted"`);
      }
    }
  }
  assert.deepEqual([...statuses].sort(), ['adapted', 'needs-input', 'partial', 'unsupported']);
});

test('side-by-side verification: legacy Mincha rules agree with the new facts→rules layer on every supported day', () => {
  const disagreements = [];
  let compared = 0;
  for (const settings of [IL, DIA]) {
    for (let t = Date.UTC(2025, 9, 1); t <= Date.UTC(2027, 9, 10); t += 864e5) {
      const date = new Date(t).toISOString().slice(0, 10);
      const legacy = composeWeekdayMincha({ now: new Date(`${date}T12:00:00Z`), settings, times: { sunrise: `${date}T04:30:00Z`, sunset: `${date}T15:30:00Z` } });
      if (legacy.rules['scope.weekday-mincha'].status !== 'applicable') continue;
      const facts = computePrayerDayFacts({ instant: `${date}T12:00:00Z`, settings });
      const fresh = resolvePrayerRules({ facts, prayer: { type: 'mincha' }, sun: { state: 'before', zmaniyotMinutesAfterSunset: null } }).rules;
      compared += 1;
      const pairs = [
        ['gevurot', legacy.rules['season.gevurot'].value === 'winter' ? 'mashiv-haruach' : 'morid-hatal', fresh['gevurot.season'].value],
        ['hashanim', legacy.rules['season.birkat-hashanim'].value === 'winter' ? 'barech-aleinu' : 'barchenu', fresh['birkat-hashanim.season'].value],
        ['tachanun', legacy.rules.tachanun.status === 'applicable' ? 'said' : legacy.rules.tachanun.status === 'not-applicable' ? 'not-said' : legacy.rules.tachanun.status, fresh.tachanun.status === 'resolved' ? fresh.tachanun.value : fresh.tachanun.status],
      ];
      for (const [rule, a, b] of pairs) if (a !== b) disagreements.push(`${date} ${settings.halachicResidenceStatus} ${rule}: legacy=${a} new=${b}`);
    }
  }
  assert.ok(compared > 400, `compared ${compared} supported days`);
  assert.deepEqual(disagreements, [], `\n${disagreements.join('\n')}`);
});

import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source); loaded.filename = source; loaded.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url))); loaded._compile(compiled, source);
  return loaded.exports;
}

test('composed reader renders the personal verse between אלהי נצור and יהיו לרצון, with its reference caption', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { PrayerDocumentView } = loadJsx('components/ComposedPrayerReader.jsx');
  const composed = composeWeekdayMincha({ now: new Date('2026-11-24T12:00:00Z'), settings: IL, times: { sunrise: '2026-11-24T04:20:00Z', sunset: '2026-11-24T14:37:00Z' }, preferences: { personalVerses: [{ id: 'Psalms.23.1', text: 'מזמור לדוד יהוה רעי', reference: 'תהלים כג, א', sourceReference: 'Psalms 23:1', name: 'דוד' }] } });
  const html = renderToStaticMarkup(React.createElement(PrayerDocumentView, { composed, font: 25 }));
  const plain = html.replace(/[\u0591-\u05C7]/g, ''); // nikud-insensitive ordering check
  const verse = plain.indexOf('prayer-personal-verse');
  const netzor = plain.indexOf('אלהי, נצר');
  const closing = plain.indexOf('יהיו לרצון', verse);
  assert.ok(netzor > 0 && verse > netzor && closing > verse, 'order: netzor < verse < closing yihyu');
  assert.match(html, /<span class="personal-verse-caption">תהלים כג, א<\/span>מזמור לדוד יהוה רעי/);
});
