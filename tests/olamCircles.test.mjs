// "מעגלי עולם" — completed circles derived from the journal, the high-water record, the fifteen ranks, the new scoring,
// the active-time study timer, the seal's geometry and the acknowledgement of "סיימתי".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import {
  ACHIEVEMENTS_KEY, CIRCLES_KEY, RANKS, WEEK_GOAL, circlesWord, computeCircle, lightAck, lightsByDay, lightsOf, markAnnounced, markSeen,
  mergeCircles, olamSpoken, rankFor, readCircles, remainingLong, remainingShort, studyLights, syncCircles,
} from '../src/services/spiritualCircle.mjs';
import { layerGrowth, sealPrimitives } from '../src/services/sealGeometry.mjs';
import { SEAL_HUES, sealLuminosity } from '../src/services/sealLuminosity.mjs';
import { IDLE_TIMEOUT_SECONDS, _clearAllSessions, activeDeltaSeconds, createPendingSession, pauseStudySession, recordInteraction, startStudySession } from '../src/services/studySession.mjs';
import { _clearAllEvents, getEvents, recordReadingCompletion, ACTIVITY_CATEGORY, ACTIVITY_TYPE } from '../src/services/mitzvotJournal.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const root = fileURLToPath(new URL('..', import.meta.url));
function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; }
function withClock(startIso, run) {
  const RealDate = Date; let clock = RealDate.parse(startIso);
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } };
  try { return run(ms => { clock += ms; }); } finally { globalThis.Date = RealDate; }
}

// A Tuesday of a week that opened on Sunday 2026-11-01; the next week opens on 2026-11-08.
const TUE = '2026-11-03';
const prayers = (key, n) => Array.from({ length: n }, (_, i) => ({ jewishDate: key, category: 'prayer', quantity: 1, id: `${key}-${i}` }));
// n lights in one event (Tehillim chapters), for building large histories quickly.
const chapters = (key, n) => ({ jewishDate: key, category: 'tehillim', quantity: n });

test('the open circle: 0, 71, 72, 73, 143 and 144 lights', () => {
  const at = n => computeCircle(prayers(TUE, n), TUE);
  assert.deepEqual([at(0).active, at(0).lifetime, at(0).progress], [0, 0, 0]);
  assert.deepEqual([at(71).active, at(71).lifetime], [71, 0]);
  assert.deepEqual([at(72).active, at(72).lifetime, at(72).progress], [0, 1, 0], '72 completes a circle; the ring restarts at 0 / 72');
  assert.deepEqual([at(73).active, at(73).lifetime], [1, 1], 'the overflow carries into the next circle');
  assert.deepEqual([at(143).active, at(143).lifetime], [71, 1]);
  assert.deepEqual([at(144).active, at(144).lifetime, at(144).completedThisWeek], [0, 2, 2]);
  assert.equal(at(71).remaining, 1);
});

test('several circles in one day, and in one session', () => {
  const day = computeCircle([chapters(TUE, 150), ...prayers(TUE, 3)], TUE); // the whole book of Tehillim and three prayers
  assert.equal(day.week, 153);
  assert.equal(day.completedThisWeek, 2);
  assert.equal(day.active, 9);
});

test('Motzaei Shabbat: an unfinished circle vanishes, the completed ones stay', () => {
  const events = prayers(TUE, 60);
  assert.equal(computeCircle(events, TUE).active, 60);
  const sunday = computeCircle(events, '2026-11-08');
  assert.deepEqual([sunday.active, sunday.lifetime, sunday.week], [0, 0, 0], '60 / 72 → 0 / 72, nothing counted');
  const withCircles = [...prayers(TUE, 72 * 3 + 10)];
  const after = computeCircle(withCircles, '2026-11-08');
  assert.equal(after.active, 0);
  assert.equal(after.lifetime, 3, 'the reset never erases a completed circle');
});

test('lifetime 49 + active 71 + one action → 50, active 0, rank נצח; active 65 + 20 → one more circle, active 13', () => {
  const past = Array.from({ length: 49 }, () => chapters('2026-10-27', 72)); // 49 circles last week
  const before = computeCircle([...past, chapters(TUE, 71)], TUE);
  assert.deepEqual([before.lifetime, before.active], [49, 71]);
  const after = computeCircle([...past, chapters(TUE, 71), ...prayers(TUE, 1)], TUE);
  assert.deepEqual([after.lifetime, after.active], [50, 0]);
  assert.equal(rankFor(after.lifetime).name, 'נצח');
  const a = computeCircle([chapters(TUE, 65)], TUE);
  const b = computeCircle([chapters(TUE, 65), chapters(TUE, 20)], TUE);
  assert.deepEqual([a.lifetime, a.active, b.lifetime, b.active], [0, 65, 1, 13]);
});

test('lifetime is the sum over every week of the journal (retroactive), and never counts a week later than today', () => {
  const events = [chapters('2026-10-13', 150), chapters('2026-10-20', 71), chapters('2026-10-27', 72), chapters(TUE, 80), chapters('2026-12-01', 500)];
  assert.equal(computeCircle(events, TUE).lifetime, 2 + 0 + 1 + 1);
});

test('the fifteen ranks: exact thresholds and names (אור הגנוז at 750)', () => {
  assert.deepEqual(RANKS.map(rank => [rank.at, rank.name]), [
    [5, 'מלכות'], [10, 'יסוד'], [20, 'הוד'], [50, 'נצח'], [100, 'תפארת'], [150, 'גבורה'], [250, 'חסד'], [300, 'בינה'],
    [400, 'חכמה'], [500, 'כתר'], [600, 'לוחות הברית'], [750, 'אור הגנוז'], [850, 'עץ החיים'], [900, 'אור השכינה'], [1000, 'אור אין סוף'],
  ]);
  assert.ok(!RANKS.some(rank => rank.name === 'עץ הדעת'));
  for (const [i, rank] of RANKS.entries()) {
    assert.equal(rankFor(rank.at).index, i);
    assert.equal(rankFor(rank.at - 1).index, i - 1);
  }
});

test('status words, with Arabic numerals: 3, 50, 325, 999 → 1000, and beyond', () => {
  const three = rankFor(3);
  assert.deepEqual([circlesWord(3), three.name, remainingShort(three)], ['3 מעגלים', null, 'עוד 2 למלכות']);
  const fifty = rankFor(50);
  assert.deepEqual([circlesWord(50), fifty.name, remainingShort(fifty)], ['50 מעגלים', 'נצח', 'עוד 50 לתפארת']);
  const r325 = rankFor(325);
  assert.deepEqual([circlesWord(325), r325.name, remainingShort(r325), remainingLong(r325)], ['325 מעגלים', 'בינה', 'עוד 75 לחכמה', 'עוד 75 מעגלים לחכמה']);
  assert.equal(r325.progress, 0.25);
  assert.equal(olamSpoken(r325), 'אורות עגולים. הושלמו 325 מעגלים. דרגת בינה. נותרו 75 מעגלים לדרגת חכמה.');
  assert.equal(rankFor(999).name, 'אור השכינה');
  assert.equal(rankFor(1000).name, 'אור אין סוף');
  assert.equal(rankFor(1000).next, null);
  assert.equal(rankFor(1237).name, 'אור אין סוף');
  assert.equal(rankFor(1237).count, 1237, 'never capped at 1000');
  assert.equal(circlesWord(1), 'מעגל אחד');
  assert.doesNotMatch(circlesWord(325) + remainingShort(r325), /[א-ת]״[א-ת]|[א-ת]׳/, 'no Hebrew-letter numerals');
});

test('the high-water record: never lowered, idempotent, one versioned key; the migration keeps everything and animates nothing', () => {
  const storage = memoryStorage();
  // An existing user (no record yet) with 7 circles already in the journal: all shown at once, marked seen and announced.
  const first = syncCircles(7, storage);
  assert.deepEqual(first, { best: 7, seen: 7, announced: 0 });
  assert.equal(readCircles(storage).best, 7);
  // Entries removed: the derived count drops, the shown count does not.
  assert.equal(syncCircles(3, storage).best, 7);
  assert.equal(syncCircles(3, storage).best, 7);
  // A new circle: best rises; seen stays until the completion is shown.
  assert.deepEqual(syncCircles(8, storage), { best: 8, seen: 7, announced: 0 });
  assert.deepEqual(syncCircles(8, storage), { best: 8, seen: 7, announced: 0 }, 'a reload or a second read changes nothing');
  // The completion is marked seen before it plays: a reload mid-animation finds nothing new to show.
  markSeen(8, storage);
  assert.equal(readCircles(storage).seen, 8);
  assert.equal(syncCircles(8, storage).seen, 8);
  // A rank acknowledged once stays acknowledged.
  syncCircles(10, storage); markSeen(10, storage);
  assert.equal(readCircles(storage).announced, 0);
  markAnnounced(1, storage);
  assert.equal(readCircles(storage).announced, 1);
  assert.equal(CIRCLES_KEY, 'kz-olam-circles-v1');
  assert.notEqual(CIRCLES_KEY, ACHIEVEMENTS_KEY);
  // Nothing stored and nothing derived: a new user starts at zero.
  assert.deepEqual(mergeCircles(null, 0), { best: 0, seen: 0, announced: -1 });
  // A damaged record is read as none.
  const bad = memoryStorage(); bad.setItem(CIRCLES_KEY, '{oops');
  assert.equal(readCircles(bad), null);
});

test('a duplicate record or a double tap cannot add a light or a circle twice', () => {
  const storage = memoryStorage();
  const where = { category: ACTIVITY_CATEGORY.SHNAYIM_MIKRA, type: ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION, source: 'shnayim-mikra', sourceId: 'bereshit', title: 'פרשת בראשית', occurredAt: new Date('2026-11-03T08:00:00Z'), tzid: 'Asia/Jerusalem', storage };
  assert.equal(recordReadingCompletion(where).created, true);
  assert.equal(recordReadingCompletion(where).created, false);
  const events = getEvents({}, storage);
  assert.equal(events.length, 1);
  assert.equal(computeCircle(events, TUE).week, 1);
  _clearAllEvents(storage);
});

test('the new scoring: no daily ceilings, a light per Tehillim chapter, study by active minutes', () => {
  assert.equal(lightsByDay(Array.from({ length: 10 }, () => ({ jewishDate: TUE, category: 'brachot', quantity: 1 }))).get(TUE), 10);
  assert.equal(lightsByDay([chapters(TUE, 40)]).get(TUE), 40);
  for (const category of ['prayer', 'birkat_hamazon', 'omer_count', 'shnayim_mikra', 'brachot', 'other']) assert.equal(lightsOf({ category }), 1, category);
  assert.equal(lightsOf({ category: 'tehillim', quantity: 1 }), 1);
  assert.equal(lightsOf({ category: 'tehillim', quantity: 3 }), 3);
  for (const [minutes, lights] of [[0, 0], [0.5, 0], [1, 1], [4, 1], [9, 1], [10, 2], [12, 2], [15, 3], [60, 12]]) {
    assert.equal(studyLights(minutes), lights, `${minutes} minutes`);
    assert.equal(lightsOf({ category: 'torah_study', unit: 'minutes', quantity: minutes }), lights);
  }
  assert.equal(lightsOf({ category: 'torah_study', unit: 'count', quantity: 1 }), 1, 'a "סיימתי" on a unit');
  assert.equal(lightsOf({ category: 'unknown' }), 0);
  // One day can complete a circle: three prayers, Birkat HaMazon, a blessing, 30 chapters, 3 units and 3 hours of study.
  const day = [...prayers(TUE, 3), { jewishDate: TUE, category: 'birkat_hamazon' }, { jewishDate: TUE, category: 'brachot' }, chapters(TUE, 30),
    ...Array.from({ length: 3 }, () => ({ jewishDate: TUE, category: 'torah_study', unit: 'count', quantity: 1 })), { jewishDate: TUE, category: 'torah_study', unit: 'minutes', quantity: 180 }];
  assert.equal(computeCircle(day, TUE).lifetime, 1);
});

test('the study timer counts active time only: three idle minutes stop it, the idle stretch is dropped, leaving the app pauses it', () => {
  assert.equal(IDLE_TIMEOUT_SECONDS, 180);
  assert.equal(activeDeltaSeconds(0, 150_000), 150);
  assert.equal(activeDeltaSeconds(0, 180_000), 180);
  assert.equal(activeDeltaSeconds(0, 181_000), 0, 'longer than three minutes: none of it counts');
  assert.equal(activeDeltaSeconds(5_000, 1_000), 0);
  const storage = memoryStorage(); const saved = globalThis.localStorage; globalThis.localStorage = storage;
  try {
    _clearAllEvents(storage); _clearAllSessions(storage);
    withClock('2026-11-03T08:00:00Z', advance => {
      startStudySession(createPendingSession({ workId: 'Genesis', workTitle: 'בראשית', tzid: 'Asia/Jerusalem' }), storage);
      advance(120_000); recordInteraction(storage); // reading, scrolling: +2:00
      advance(240_000); recordInteraction(storage); // four minutes without a touch: dropped
      advance(60_000); pauseStudySession(storage); // a minute more, then the app is hidden: +1:00
      advance(600_000); // away for ten minutes: nothing
      startStudySession(createPendingSession({ workId: 'Genesis', workTitle: 'בראשית', tzid: 'Asia/Jerusalem' }), storage);
      advance(60_000); recordInteraction(storage); // back, a minute of reading: +1:00
    });
    const study = getEvents({ category: 'torah_study' }, storage);
    assert.equal(study.length, 1);
    assert.equal(study[0].quantity, 4, 'four active minutes of the eighteen that passed');
    assert.equal(lightsOf(study[0]), 1);
  } finally { globalThis.localStorage = saved; }
  // The hook: engagement (scroll, touch, pointer, key, wheel) keeps it alive; no clock ticks it forward.
  const hooks = read('../src/hooks.jsx');
  assert.match(hooks, /const ENGAGE_EVENTS = \['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'\];/);
  assert.doesNotMatch(hooks.slice(hooks.indexOf('export function useStudyTimer'), hooks.indexOf('export function useSpiritualPresence')), /setInterval/);
  assert.match(hooks, /if \(document\.hidden\) \{\s*isActiveRef\.current = false;\s*studySession\.pauseStudySession\(\);/);
});

test('the seal: deterministic, one layer per rank, growing in proportion between ranks; the count is never drawn in it', () => {
  assert.deepEqual(sealPrimitives(325), sealPrimitives(325));
  const g = count => layerGrowth(count);
  assert.equal(g(300)[7], 1, 'בינה complete at 300');
  assert.equal(g(325)[8], 0.25);
  assert.equal(g(350)[8], 0.5);
  assert.equal(g(375)[8], 0.75);
  assert.equal(g(400)[8], 1, 'חכמה at 400');
  assert.equal(g(3)[0], 0.6, 'before the first rank the first layer is already on its way');
  assert.deepEqual(g(0), Array(15).fill(0));
  assert.ok(g(5000).every(t => t === 1));
  // Richer with every rank.
  const sizes = [0, ...RANKS.map(rank => rank.at)].map(count => sealPrimitives(count).length);
  for (let i = 1; i < sizes.length; i += 1) assert.ok(sizes[i] >= sizes[i - 1], `rank ${i} adds to the seal`);
  assert.ok(sizes.at(-1) > sizes[0] * 5);
  // Pre-rank: the central light and one thin ring only.
  assert.deepEqual(sealPrimitives(0).map(item => item.kind).sort(), ['circle', 'core', 'glow']);
  for (const count of [0, 5, 325, 1000, 1237]) assert.ok(sealPrimitives(count).every(item => item.kind !== 'text'));
  // Symmetric about the vertical axis: every primitive has a mirror.
  const points = sealPrimitives(1000).flatMap(item => (item.kind === 'dot' ? [[item.cx, item.cy]] : item.kind === 'line' ? [[item.x1, item.y1], [item.x2, item.y2]] : []));
  for (const [x, y] of points) assert.ok(points.some(([x2, y2]) => Math.abs(x2 - (128 - x)) < 0.05 && Math.abs(y2 - y) < 0.05), `mirror of ${x},${y}`);
});

test('the seal never reads as a cross: no orthogonal axis pair, no long stroke through the centre, no four-on-the-axes layer', () => {
  const C = 64;
  const angleOf = (x, y) => ((Math.atan2(x - C, C - y) * 180) / Math.PI + 360) % 360;
  const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 1;
  const counts = [...new Set([...Array.from({ length: 201 }, (_, i) => i * 5), 3, 325, 350, 375, 1237, 5000])];
  for (const count of counts) {
    const items = sealPrimitives(count);
    const lines = items.filter(item => item.kind === 'line');
    const axes = new Set();
    for (const { x1, y1, x2, y2 } of lines) {
      const length = Math.hypot(x2 - x1, y2 - y1);
      // No long stroke anywhere, and nothing drawn through the centre.
      assert.ok(length <= 10, `${count}: a stroke ${length.toFixed(1)} long`);
      const cross = Math.abs((x2 - x1) * (C - y1) - (y2 - y1) * (C - x1)) / (length || 1);
      const t = ((C - x1) * (x2 - x1) + (C - y1) * (y2 - y1)) / (length * length || 1);
      assert.ok(!(cross < 3 && t > 0 && t < 1), `${count}: a stroke passes through the centre`);
      axes.add(Math.round(angleOf((x1 + x2) / 2, (y1 + y2) / 2)) % 180);
    }
    // Never a vertical and a horizontal axis together; any other perpendicular pair only within an even rhythm of 6+ axes.
    assert.ok(!(axes.has(0) && axes.has(90)), `${count}: marks on both the vertical and the horizontal axis`);
    for (const a of axes) if (axes.has((a + 90) % 180)) assert.ok(axes.size >= 6, `${count}: a dominant orthogonal pair ${a}/${(a + 90) % 180}`);
    // No layer of exactly four elements set on the axes (+) or on the diagonals (×).
    const layers = new Map();
    for (const item of items) {
      const at = item.at ?? (item.kind === 'dot' || (item.kind === 'circle' && item.cx !== undefined) ? angleOf(item.cx, item.cy) : item.kind === 'line' ? angleOf((item.x1 + item.x2) / 2, (item.y1 + item.y2) / 2) : null);
      if (at === null) continue;
      const layer = item.key.split('-')[0];
      layers.set(layer, [...(layers.get(layer) || []), at]);
    }
    for (const [layer, list] of layers) {
      if (list.length !== 4) continue;
      for (const set of [[0, 90, 180, 270], [45, 135, 225, 315]]) assert.ok(!set.every(deg => list.some(at => near(at, deg))), `${count}: layer ${layer} is four marks on ${set.join('/')}`);
    }
  }
  // The six-fold vocabulary is there: six marks for מלכות, six arcs for נצח, a Magen David for אור הגנוז, six leaves for עץ החיים.
  const at = count => sealPrimitives(count).map(item => item.key);
  assert.equal(at(5).filter(k => /^m-/.test(k)).length, 6);
  assert.equal(at(50).filter(k => /^n-/.test(k)).length, 6);
  assert.equal(at(750).filter(k => /^g-/.test(k)).length, 4);
  assert.equal(at(850).filter(k => /^e-/.test(k)).length, 6);
});

test('the seal moves gently only where it should, and stands still under reduced motion', () => {
  const seal = read('../src/components/CircleSeal.jsx');
  assert.match(seal, /alive = false/);
  assert.match(seal, /circle-seal-breath/);
  assert.match(seal, /circle-seal-drift/);
  const css = read('../src/styles/base.css');
  assert.match(css, /\.circle-seal\.is-alive \.circle-seal-breath\{animation:seal-breathe 7s ease-in-out infinite\}/);
  assert.match(css, /\.circle-seal\.is-alive \.circle-seal-drift\{animation:seal-drift 120s linear infinite\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.circle-seal\.is-alive \.circle-seal-breath,[^}]*\{animation:none\}\.circle-seal-sheen\{display:none\}/);
  assert.match(css, /html\[data-a11y-motion\] \.circle-seal-sheen\{display:none\}/);
  // Keyframes animate transform and opacity only.
  for (const name of ['seal-breathe', 'seal-drift', 'seal-sheen', 'olam-halo']) {
    const body = css.slice(css.indexOf(`@keyframes ${name}{`)).split('\n')[0];
    assert.doesNotMatch(body.replace(/transform|opacity/g, ''), /[a-z-]+:(?!\d|rotate|scale)/, name);
  }
  // Alive: the page's large seal, Home, the card and the current rank only — never the whole path.
  assert.match(read('../src/pages/OlamPage.jsx'), /size=\{196\} alive vivid \/>[\s\S]*alive=\{status === 'current'\}/);
  assert.match(read('../src/components/OlamCircles.jsx'), /size=\{44\} alive \/>/);
});

test('the seal\'s luminosity: one gold hue at מלכות, five at אור אין סוף, colour and effect never falling as the count rises', () => {
  const L = sealLuminosity;
  assert.deepEqual([L(0).hues, L(5).hues, L(10).hues, L(20).hues], [1, 1, 1, 1], 'gold alone through הוד');
  assert.equal(L(5).weights.violet, 0, 'מלכות is gold only');
  assert.deepEqual(RANKS.map(rank => L(rank.at).hues), [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5]);
  assert.deepEqual(RANKS.map(rank => L(rank.at).effect), [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
  assert.deepEqual([L(0).intensity, L(1000).intensity, L(5000).intensity], [0, 1, 1]);
  assert.equal(L(35).weights.violet, 0.5, 'a hue fades in over the stretch before its rank');
  assert.deepEqual(SEAL_HUES.map(hue => hue.name), ['violet', 'sky', 'rose', 'green']);
  let prev = L(0);
  for (let n = 1; n <= 1200; n += 1) {
    const cur = L(n);
    assert.ok(cur.hues >= prev.hues && cur.effect >= prev.effect && cur.intensity >= prev.intensity, `${n}: never less than ${n - 1}`);
    for (const name of Object.keys(cur.weights)) assert.ok(cur.weights[name] >= prev.weights[name], `${n}: ${name}`);
    prev = cur;
  }
  assert.deepEqual(L(325), L(325));
});

test('the seal\'s colour and life: every seal coloured, only alive seals move, and nothing moves under reduced motion', () => {
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const Seal = loadComponent('CircleSeal.jsx');
  const draw = props => renderToStaticMarkup(React.createElement(Seal, props));
  const still = draw({ count: 1000, size: 56 });
  assert.match(still, /circle-seal-haze/, 'a path seal keeps its rank\'s colours');
  assert.doesNotMatch(still, /circle-seal-glint|circle-seal-sheen/, 'but no glints or travelling lights');
  const top = draw({ count: 1000, size: 196, alive: true });
  assert.match(top, /^<svg class="circle-seal is-alive" data-fx="5" data-hues="5"[^>]*aria-hidden="true"/);
  assert.equal((top.match(/class="circle-seal-glint"/g) || []).length, 9);
  assert.equal((top.match(/class="circle-seal-sheen /g) || []).length, 4);
  const first = draw({ count: 5, size: 196, alive: true });
  assert.match(first, /data-fx="0" data-hues="1"/);
  assert.doesNotMatch(first, /circle-seal-haze|circle-seal-glint|circle-seal-sheen|--seal-(violet|sky|rose|green)/, 'מלכות: gold only, breathing only');
  const home = draw({ count: 1000, size: 44, alive: true });
  assert.match(home, /data-small=""/);
  assert.doesNotMatch(home, /circle-seal-glint/, 'the small Home seal stays clean');
  assert.doesNotMatch(draw({ count: 1000, size: 196 }), /<text/);
  // Every animation of the luminosity is inside one block that requires motion to be allowed (the system and the app).
  const css = read('../src/styles/seal.css');
  const open = css.indexOf('@media (prefers-reduced-motion:no-preference){');
  assert.ok(open > 0);
  const close = css.indexOf('\n}\n', open);
  const inside = css.slice(open, close); const outside = css.slice(0, open) + css.slice(close);
  assert.doesNotMatch(outside.replace(/@keyframes[^\n]*/g, ''), /animation/, 'no animation outside the motion-allowed block');
  for (const rule of inside.split('\n').slice(1).filter(Boolean)) for (const selector of rule.slice(0, rule.indexOf('{')).split(',')) assert.match(selector, /^html:not\(\[data-a11y-motion\]\) /, selector);
  for (const name of [...css.matchAll(/@keyframes ([a-z-]+)\{/g)].map(m => m[1])) {
    const body = css.slice(css.indexOf(`@keyframes ${name}{`)).split('\n')[0];
    assert.doesNotMatch(body.replace(/transform|opacity/g, ''), /[a-z-]+:(?!\d|rotate|scale|perspective|\.)/, name);
  }
  assert.match(read('../src/NewApp.jsx'), /import '\.\/styles\/seal\.css';/);
});

test('the acknowledgement of "סיימתי": the light added, or the circle completed; nothing for a repeat', () => {
  const before = computeCircle(prayers(TUE, 47), TUE);
  const after = computeCircle(prayers(TUE, 48), TUE);
  assert.deepEqual(lightAck(before, after), { gained: 1, completed: false, active: 48, text: 'אור למעגל · 48 מתוך 72', spoken: 'נוסף אור אחד למעגל. 48 מתוך 72.' });
  const done = lightAck(computeCircle(prayers(TUE, 71), TUE), computeCircle(prayers(TUE, 72), TUE));
  assert.equal(done.completed, true);
  assert.equal(done.text, 'המעגל הושלם — מעגל חדש מתחיל');
  assert.equal(lightAck(after, after), null);
  const button = read('../src/components/CompletionButton.jsx');
  assert.match(button, /const added = lightAck\(before, circleNow\(tzid\)\);/);
  // Spoken once, within the one status line: "הוספת אור למעגל הרוחני. 48 מתוך 72"; shown as "48/72" under the ellipse.
  assert.match(button, /\{ack && `\. \$\{LIGHT_ADDED\}\. \$\{ack\.active\} מתוך \$\{WEEK_GOAL\}`\}/);
  assert.match(button, /<span className="completion-fraction" dir="ltr">\{fraction\}<\/span>/);
  assert.doesNotMatch(button, /כל סיום מוסיף אור למעגל הרוחני|light-ack|מתוך \$\{WEEK_GOAL\}<\/p>/, 'the old hint and the old "+1 אור למעגל · 48 מתוך 72" line are gone');
});

test('the screens: Home line, "אורות עגולים", "מעגלי עולם"; one rank system; quiet explanation; haptic only when allowed', () => {
  const circle = read('../src/services/spiritualCircle.mjs');
  assert.doesNotMatch(circle, /LEVELS|levelFor|DAY_CAP|ניצוץ|אבוקה/, 'the old levels and ceilings are gone');
  const today = read('../src/pages/TodayPage.jsx');
  assert.match(today, /<OlamHomeLine lifetime=\{completion\.shownLifetime\} onOpen=\{\(\) => onNav\('mitzvot-journal\/olam'\)\}/);
  const journal = read('../src/pages/MitzvotJournal.jsx');
  assert.match(journal, /<OlamCard lifetime=\{completion\.shownLifetime\}/);
  assert.match(journal, /המעגל מתאפס במוצ״ש באופן אוטומטי/);
  assert.doesNotMatch(journal, /circle\.level|מדרגת/);
  const page = read('../src/pages/OlamPage.jsx');
  assert.match(page, /<h1 className="olam-page-title">מעגלי עולם<\/h1>/);
  assert.match(page, /המעגל מתאפס במוצ״ש באופן אוטומטי/);
  assert.match(page, /אורות משלימים מעגל — כל תפילה, ברכה, פרק תהילים ולימוד מוסיפים אור\./);
  assert.match(read('../src/NewApp.jsx'), /mode==='mitzvot-journal\/olam' \? <OlamPage ring=\{ring\}/);
  const olam = read('../src/components/OlamCircles.jsx');
  assert.match(olam, /import \{ haptic \} from '\.\/jewishAlarm\/AlarmParts\.jsx';/);
  assert.match(read('../src/components/jewishAlarm/AlarmParts.jsx'), /if \(!hapticsAllowed\(\)\) return;/);
  assert.match(olam, /markSeen\(lifetime\);/);
  assert.match(olam, /if \(reduceMotionNow\(\)\) \{ finish\(\); return undefined; \}/);
  const css = read('../src/styles/base.css');
  assert.match(css, /\.olam-page-title\{[^}]*text-align:center/);
  assert.match(css, /html\[data-a11y-motion\] \.olam-travel\{display:none\}/);
});

// The compact views render their words and a single spoken sentence (server markup).
const require = createRequire(import.meta.url);
function loadComponent(relative, exportName = 'default') {
  const source = fileURLToPath(new URL(`../src/components/${relative}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const mod = new Module(source); mod.filename = source; mod.paths = Module._nodeModulePaths(root); mod._compile(compiled, source);
  return mod.exports[exportName];
}
test('"אורות עגולים" and the Home line: words beside the seal, one accessible name, the SVG hidden', () => {
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const OlamCard = loadComponent('OlamCircles.jsx', 'OlamCard');
  const OlamHomeLine = loadComponent('OlamCircles.jsx', 'OlamHomeLine');
  const card = renderToStaticMarkup(React.createElement(OlamCard, { lifetime: 325, onOpen: () => {}, completedThisWeek: 3 }));
  assert.match(card, /aria-label="אורות עגולים\. הושלמו 325 מעגלים\. דרגת בינה\. נותרו 75 מעגלים לדרגת חכמה\. השבוע הושלמו 3 מעגלים\. פתיחת מעגלי עולם"/);
  assert.match(card, />אורות עגולים</); assert.match(card, />325 מעגלים</); assert.match(card, />בינה</); assert.match(card, />75 מעגלים לחכמה</); assert.doesNotMatch(card.replace(/aria-label="[^"]*"/, ''), /עוד/, 'no "עוד" on the card');
  assert.match(card, /<svg class="circle-seal is-alive is-vivid"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(card, /<text/);
  const home = renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime: 3, onOpen: () => {} }));
  assert.match(home, /<button type="button" class="olam-home is-unranked"/);
  assert.match(home, />שלושה מעגלים</); assert.doesNotMatch(home, /עוד|למלכות/, 'Today: no way-ahead line, for symmetry');
  const top = renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime: 1237, onOpen: () => {} }));
  assert.match(top, />1237 מעגלים</); assert.match(top, />אור אין סוף</);
});

// Today stays as it was apart from the owner's wording (2026-09-30: no "0", no "עוד" on the Home line too): the rank
// opening is byte-identical to its markup before the vivid seals (sha-256 prefix from that version), the Home line keeps
// its plain 44px living seal, and Today never asks for `vivid`.
test('Today untouched: the Home seal line and its rank opening render exactly as before', () => {
  const { createHash } = require('node:crypto');
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const OlamHomeLine = loadComponent('OlamCircles.jsx', 'OlamHomeLine');
  const OlamUnlock = loadComponent('OlamCircles.jsx', 'OlamUnlock');
  const hash = element => createHash('sha256').update(renderToStaticMarkup(element)).digest('hex').slice(0, 16);
  const line = lifetime => renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime, onOpen: () => {} }));
  for (const lifetime of [0, 3, 325, 1000]) { assert.doesNotMatch(line(lifetime), /is-vivid|עוד|>0 מעגלים</, `Home line at ${lifetime}`); assert.match(line(lifetime), /<svg class="circle-seal is-alive"/); }
  assert.match(line(0), /<span class="olam-home-count is-centred">ללא מעגלים<\/span>/, 'Today at zero: ללא מעגלים, centred under the seal');
  assert.doesNotMatch(line(0) + line(325), /למלכות|לחכמה/, 'no way-ahead line on Today');
  assert.match(line(50), />חמישים מעגלים</); assert.match(line(325), />325 מעגלים</);
  assert.equal(hash(React.createElement(OlamUnlock, { unlock: { name: 'בינה', count: 300, index: 7 }, onClose: () => {} })), '30df5a88b3000f29');
  const today = read('../src/pages/TodayPage.jsx');
  assert.doesNotMatch(today, /vivid|CompletionButton|StudyCompletion|PrayerCompletion/);
  assert.match(today, /<OlamUnlock unlock=\{completion\.unlock\} onClose=\{completion\.dismissUnlock\} \/>/);
  assert.match(read('../src/components/OlamCircles.jsx'), /<CircleSeal count=\{rank\.count\} size=\{44\} alive \/>/);
});

test('vivid seals (מעגלי עולם, "אורות עגולים"): the same six-fold geometry, drawn stronger', () => {
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const Seal = loadComponent('CircleSeal.jsx');
  const draw = props => renderToStaticMarkup(React.createElement(Seal, props));
  const widths = html => [...html.replace(/<mask[\s\S]*?<\/mask>/, '').matchAll(/stroke="currentColor" stroke-width="([\d.]+)"/g)].map(m => Number(m[1]));
  const plain = draw({ count: 325, size: 196 }); const vivid = draw({ count: 325, size: 196, vivid: true });
  assert.match(vivid, /^<svg class="circle-seal is-vivid"/);
  assert.equal(widths(vivid).length, widths(plain).length, 'the same primitives');
  widths(vivid).forEach((w, i) => assert.ok(w > widths(plain)[i], 'every stroke thicker'));
  assert.doesNotMatch(plain, /is-vivid/);
  const css = read('../src/styles/seal.css');
  assert.match(css, /\.circle-seal\.is-vivid\{color:/);
  assert.match(read('../src/components/OlamCircles.jsx'), /size=\{76\} alive vivid \/>/);
});

function loadPage(relative) {
  const source = fileURLToPath(new URL(`../src/pages/${relative}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const mod = new Module(source); mod.filename = source; mod.paths = Module._nodeModulePaths(root); mod._compile(compiled, source);
  return mod.exports.default;
}
test('the rank path previews every rank in its own full colours, whatever the reader\'s count; where he stands stays clear', () => {
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const OlamPage = loadPage('OlamPage.jsx');
  const path = lifetime => {
    const html = renderToStaticMarkup(React.createElement(OlamPage, { ring: { lifetime }, onBack: () => {} }));
    return html.slice(html.indexOf('<ol class="olam-path-list">'));
  };
  const own = RANKS.map(rank => String(sealLuminosity(rank.at).hues));
  for (const lifetime of [0, 3, 325, 1000]) {
    const html = path(lifetime);
    const seals = [...html.matchAll(/<svg class="circle-seal( is-alive)? is-vivid olam-path-seal" data-fx="(\d)" data-hues="(\d)"/g)];
    assert.equal(seals.length, RANKS.length, `${lifetime}: fifteen seals`);
    assert.deepEqual(seals.map(m => m[3]), own, `${lifetime}: each rank's own palette`);
    assert.deepEqual(seals.map(m => m[2]), RANKS.map(rank => String(sealLuminosity(rank.at).effect)));
  }
  assert.equal((path(325).match(/aria-current="step"/g) || []).length, 1);
  assert.match(path(325), /<span class="olam-step-note">הדרגה הנוכחית<\/span>/);
  assert.equal((path(325).match(/circle-seal is-alive/g) || []).length, 1, 'only the current rank is fully alive');
  assert.doesNotMatch(read('../src/styles/base.css'), /\.olam-step\.is-ahead \.olam-step-seal \.circle-seal\{opacity/, 'future ranks are never washed out');
  // Their gentle life is staggered (each step its own beat) and lives only inside the motion-allowed block.
  const page = read('../src/pages/OlamPage.jsx');
  assert.match(page, /'--olam-beat': `\$\{-\(\(index \* 2\.7\) % 9\)\.toFixed\(1\)\}s`/);
  const css = read('../src/styles/seal.css');
  assert.match(css, /html:not\(\[data-a11y-motion\]\) \.circle-seal\.olam-path-seal:not\(\.is-alive\) \.circle-seal-breath\{animation:seal-breathe-soft 9s ease-in-out var\(--olam-beat,0s\) infinite\}/);
  assert.match(css, /\.olam-path-list::before\{[^}]*linear-gradient\(to bottom,var\(--gold\)[^}]*var\(--seal-violet\)[^}]*var\(--seal-sky\)[^}]*var\(--seal-rose\)[^}]*var\(--seal-green\)/);
});
