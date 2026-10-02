// התבודדות — every way out of a session puts the app back (the owner's report: leaving the session by Back left the
// whole app black). Drives src/services/hitbodedut/exitGuard.mjs and launchRecovery.mjs over a fake window / document /
// history with the real session controller, brightness guard and audio engine (native plugin mocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHitbodedutController, SESSION_KEY, sessionOptions, TEHILLIM_DIM_LEVEL } from '../src/services/hitbodedut/session.mjs';
import { createBrightnessGuard, BRIGHTNESS_KEY } from '../src/services/hitbodedut/brightness.mjs';
import { createAmbientAudio } from '../src/services/ambientAudio/engine.mjs';
import { createLiveActivityBridge } from '../src/services/hitbodedut/liveActivity.mjs';
import {
  IMMERSIVE_ATTR, GUARD_FLAG, isHitbodedutRoute, enterImmersive, exitImmersive, leaveSession, watchSessionRoute, guardBack, dropGuard,
} from '../src/services/hitbodedut/exitGuard.mjs';
import { LEFTOVER_KEYS, hasLeftovers, recoverHitbodedutAtLaunch } from '../src/services/hitbodedut/launchRecovery.mjs';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 1, 18, 0, 0);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function settle() { for (let i = 0; i < 8; i += 1) await tick(); }

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}

// A browser-ish world: history entries with hashes, popstate on back, hashchange on links, visibility.
function world(startHash = '#leatzmi/hitbodedut') {
  const win = new EventTarget();
  const doc = new EventTarget();
  const attrs = new Map();
  doc.hidden = false;
  doc.sessionScreen = false;
  doc.documentElement = { setAttribute: (k, v) => attrs.set(k, String(v)), removeAttribute: k => attrs.delete(k), hasAttribute: k => attrs.has(k), getAttribute: k => attrs.get(k) ?? null };
  doc.querySelector = selector => (selector === '.hb-session' && doc.sessionScreen ? {} : null);
  const entries = [{ state: { kzDepth: 0 }, hash: '#leatzmi' }, { state: { kzDepth: 1 }, hash: startHash }];
  let index = 1;
  const hashOf = url => { const s = String(url ?? ''); const at = s.indexOf('#'); return at < 0 ? entries[index].hash : s.slice(at); };
  win.location = { get hash() { return entries[index].hash; }, get href() { return `capacitor://localhost/${entries[index].hash}`; } };
  win.history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState(state, _title, url) { entries.splice(index + 1); entries.push({ state, hash: hashOf(url) }); index += 1; },
    replaceState(state, _title, url) { entries[index] = { state, hash: hashOf(url) }; },
    back() { if (index === 0) return; const from = entries[index].hash; index -= 1; win.dispatchEvent(new Event('popstate')); if (entries[index].hash !== from) win.dispatchEvent(new Event('hashchange')); },
  };
  const statusBar = { calls: [], hide: async () => { statusBar.calls.push('hide'); }, show: async () => { statusBar.calls.push('show'); } };
  return {
    win, doc, attrs, statusBar, entries,
    get index() { return index; },
    // A link / the router going elsewhere (hashchange), or Back skipping the guard straight to another screen.
    link(hash) { entries.splice(index + 1); entries.push({ state: null, hash }); index += 1; win.dispatchEvent(new Event('hashchange')); },
    skipBackTo(hash) { index = entries.findIndex(entry => entry.hash === hash); win.dispatchEvent(new Event('popstate')); win.dispatchEvent(new Event('hashchange')); },
    hide() { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); },
    show() { doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); },
  };
}

function rig({ storage = memoryStorage(), brightness = 0.7 } = {}) {
  const log = [];
  const device = { brightness, awake: false, nativeOriginal: null };
  const plugin = {
    async getBrightness() { return { brightness: device.brightness }; },
    async dim({ level }) { if (device.nativeOriginal == null) device.nativeOriginal = device.brightness; device.brightness = level; log.push('dim'); return { original: device.nativeOriginal }; },
    async restore({ original, keepRecord } = {}) { const v = original ?? device.nativeOriginal; if (v != null) device.brightness = v; if (!keepRecord) device.nativeOriginal = null; log.push('restore'); },
    async setKeepAwake({ on }) { device.awake = on; log.push(`awake:${on}`); },
    async liveSupported() { return { supported: true, enabled: true }; },
    async liveStart() { log.push('liveStart'); return { started: true }; },
    async liveUpdate() {},
    async liveEnd() { log.push('liveEnd'); },
    async takeLiveActions() { return { actions: [] }; },
  };
  const backend = { backgroundCapable: true, log: [] };
  for (const m of ['start', 'pause', 'resume', 'stop', 'setVolume', 'chime']) backend[m] = async arg => { backend.log.push(m); return m === 'start' ? true : undefined; };
  let now = T0;
  const audio = createAmbientAudio(backend);
  const controller = createHitbodedutController({
    screen: createBrightnessGuard({ plugin, storage }),
    audio,
    live: createLiveActivityBridge(plugin, { platform: 'ios' }),
    storage,
    clock: () => now,
  });
  return { controller, device, backend, audio, log, storage, setNow: value => { now = value; } };
}

const startOptions = { minutes: 15, sound: 'brown', volume: 0.4, display: 'timer', screenOn: true, dim: true, chime: true };

// Everything the session changed is back: brightness, keep-awake, the sound, the chrome, the stored session.
function assertRestored(r, w) {
  assert.equal(r.controller.active, false, 'the session is over');
  assert.equal(r.device.brightness, 0.7, 'the person\'s brightness is back');
  assert.equal(r.device.awake, false, 'keep-awake is off');
  assert.ok(r.backend.log.includes('stop'), 'the sound stopped');
  assert.equal(r.storage.getItem(SESSION_KEY), null, 'no session kept');
  assert.equal(r.storage.getItem(BRIGHTNESS_KEY), null, 'no brightness record kept');
  if (w) {
    assert.equal(w.attrs.has(IMMERSIVE_ATTR), false, 'the header and the tab bar are back');
    assert.ok(w.statusBar.calls.includes('show'), 'the status bar is back');
  }
}

async function startedIn(w, r, options = startOptions) {
  enterImmersive({ doc: w.doc, statusBar: w.statusBar });
  await r.controller.start(options);
  assert.equal(r.device.brightness, 0.12);
  assert.equal(r.device.awake, true);
}

test('routes: only leatzmi/hitbodedut and its sub-pages are the session\'s', () => {
  assert.equal(isHitbodedutRoute('#leatzmi/hitbodedut'), true);
  assert.equal(isHitbodedutRoute('leatzmi/hitbodedut/focus'), true);
  assert.equal(isHitbodedutRoute('#leatzmi'), false);
  assert.equal(isHitbodedutRoute('#leatzmi/hitbodedutX'), false);
  assert.equal(isHitbodedutRoute(''), false);
  assert.equal(isHitbodedutRoute('#today'), false);
});

test('immersive: enter hides the chrome, exit restores it, idempotently', () => {
  const w = world();
  enterImmersive({ doc: w.doc, statusBar: w.statusBar });
  assert.equal(w.attrs.get(IMMERSIVE_ATTR), 'hitbodedut');
  assert.deepEqual(w.statusBar.calls, ['hide']);
  assert.equal(exitImmersive({ doc: w.doc, statusBar: w.statusBar }), true);
  assert.equal(exitImmersive({ doc: w.doc, statusBar: w.statusBar }), false);
  assert.equal(w.attrs.has(IMMERSIVE_ATTR), false);
  assert.deepEqual(w.statusBar.calls, ['hide', 'show']);
});

test('popstate on the session (the guard popped by the edge swipe / Back): ends quietly on the choice screen — no question, no closing screen', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const seen = [];
  r.controller.subscribe((session, summary) => { seen.push(summary); });
  const off = guardBack({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  assert.equal(w.win.history.state[GUARD_FLAG], true, 'a guard entry with the same address');
  const depth = w.entries.length;
  w.win.history.back();
  await settle();
  assertRestored(r, w);
  assert.equal(r.controller.summary, null, 'no closing screen waiting');
  assert.ok(seen.every(summary => summary === null), 'the closing screen was never shown, not even for a moment');
  assert.equal(r.backend.log.includes('chime'), false);
  assert.notEqual(w.win.history.state?.[GUARD_FLAG], true, 'no guard re-pushed');
  assert.equal(w.entries.length, depth, 'the guard is not pushed again');
  assert.equal(isHitbodedutRoute(w.win.location.hash), true, 'on the choice screen of התבודדות');
  off();
});

test('popstate that reaches another screen (Back skipped the guard): the session ends and everything is restored', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const off = guardBack({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  w.skipBackTo('#leatzmi');
  await settle();
  assert.equal(w.win.location.hash, '#leatzmi');
  assert.notEqual(w.win.history.state?.[GUARD_FLAG], true, 'no guard pushed on the other screen');
  assertRestored(r, w);
  assert.equal(r.controller.summary, null, 'no dark closing screen waiting');
  off();
});

test('hashchange to another screen (the app-wide watcher, independent of the page): ends and restores', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const off = watchSessionRoute({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  w.link('#leatzmi/hitbodedut/focus');
  await settle();
  assert.equal(r.controller.active, true, 'a sub-page of התבודדות keeps the session');
  w.link('#today');
  await settle();
  assertRestored(r, w);
  off();
});

test('popstate to another screen through the watcher alone (no page listening any more): ends and restores', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const off = watchSessionRoute({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  w.win.history.back();       // from the session's own entry (no guard) to #leatzmi
  await settle();
  assertRestored(r, w);
  off();
});

test('visibility: hidden then shown on the session lights the controls; shown on another screen ends it', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  let returned = 0;
  const offBack = guardBack({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar, onReturn: () => { returned += 1; } });
  const offWatch = watchSessionRoute({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  w.hide();
  await r.controller.background();
  assert.equal(r.device.brightness, 0.7, 'hidden: the person\'s brightness');
  w.show();
  await r.controller.foreground();
  await settle();
  assert.equal(returned, 1, 'coming back lights the controls');
  assert.equal(r.controller.active, true);
  assert.equal(r.device.brightness, 0.12, 'and re-dims on the session');
  // While hidden, the app moved to another screen (a widget link, a notification).
  w.hide();
  await r.controller.background();
  w.entries.push({ state: null, hash: '#today' });
  w.skipBackTo('#today');
  offBack();
  w.show();
  await settle();
  assertRestored(r, w);
  offWatch();
});

test('unmount (leaving the page): leaveSession ends quietly — at once, no chime — and drops the closing screen', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const restoreCalls = [];
  const original = r.controller.end;
  r.controller.end = (...args) => { restoreCalls.push(args[2]); return original(...args); };
  assert.equal(await leaveSession(r.controller, { doc: w.doc, statusBar: w.statusBar }), true);
  assert.deepEqual(restoreCalls, [{ quiet: true, closing: false }]);
  assert.equal(r.backend.log.includes('chime'), false);
  assertRestored(r, w);
  assert.equal(r.controller.summary, null);
  assert.equal(await leaveSession(r.controller, { doc: w.doc, statusBar: w.statusBar }), false, 'twice is harmless');
});

test('leaving after Tehillim chapters were read: no closing screen afterwards either (it is only for a session whose time ran out)', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r, { ...startOptions, display: 'tehillim', dimLevel: 0.12 });
  r.controller.noteChapter(23);
  const seen = [];
  r.controller.subscribe((session, summary) => { seen.push(summary); });
  await leaveSession(r.controller, { doc: w.doc, statusBar: w.statusBar });
  assertRestored(r, w);
  assert.equal(r.controller.summary, null);
  assert.ok(seen.every(summary => summary === null), 'never shown, not even between the end and its sound / brightness calls');
});

test('leaving: the closing screen is dropped in the same turn as the end — before the slow native calls settle', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  // The native side is slow (the sound's stop, the Live Activity): the end has not settled when the screen re-renders.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const stop = r.audio.stop.bind(r.audio);
  r.audio.stop = async (...args) => { await gate; return stop(...args); };
  const leaving = leaveSession(r.controller, { doc: w.doc, statusBar: w.statusBar });
  assert.equal(r.controller.active, false, 'ended at once');
  assert.equal(r.controller.summary, null, 'no closing screen while the end is still settling');
  await settle();
  assert.equal(r.controller.summary, null);
  release();
  assert.equal(await leaving, true);
  assert.equal(r.controller.summary, null, 'and none after it');
});

test('a session whose time runs out on the page still gets its closing screen (kept until חזרה)', async () => {
  const r = rig();
  await r.controller.start(startOptions);
  r.setNow(T0 + 15 * MIN + 500);
  await r.controller.tick();
  assert.equal(r.controller.summary?.timer.endReason, 'completed');
  await settle();
  assert.equal(r.controller.summary?.timer.endReason, 'completed', 'nothing dismisses it by itself');
});

test('dropGuard steps back off the guard only while it is the entry shown', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const off = guardBack({ win: w.win, doc: w.doc, controller: r.controller });
  off();
  const at = w.index;
  dropGuard(w.win);
  assert.equal(w.index, at - 1);
  dropGuard(w.win);
  assert.equal(w.index, at - 1, 'no guard: nothing');
});

test('recover({ resume: false }): a kept running session is closed without re-dimming or replaying', async () => {
  const storage = memoryStorage();
  const first = rig({ storage });
  await first.controller.start(startOptions);
  // The app is killed here; the native side put the brightness back on its own at the next launch.
  const second = rig({ storage, brightness: 0.7 });
  await second.controller.recover(T0 + MIN, { resume: false });
  assert.equal(second.controller.active, false);
  assert.equal(second.log.includes('dim'), false, 'never dimmed again');
  assert.equal(second.backend.log.includes('start'), false, 'never played again');
  assert.equal(second.device.awake, false);
  assert.ok(second.log.includes('liveEnd'));
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
});

test('launch recovery: the leftover keys mirror the services\' keys', () => {
  assert.deepEqual([...LEFTOVER_KEYS], [SESSION_KEY, BRIGHTNESS_KEY]);
  assert.equal(hasLeftovers(memoryStorage()), false);
  assert.equal(hasLeftovers(memoryStorage({ [BRIGHTNESS_KEY]: '{"original":0.5}' })), true);
});

test('launch recovery on another screen: the chrome, the brightness, keep-awake and the Live Activity are put back', async () => {
  const storage = memoryStorage();
  const before = rig({ storage });
  await before.controller.start(startOptions);
  const w = world('#today');
  w.attrs.set(IMMERSIVE_ATTR, 'hitbodedut');      // left on <html> by the crash
  const after = rig({ storage, brightness: 0.12 }); // the screen still dark (say the native restore did not run)
  let loaded = 0;
  const load = async () => {
    loaded += 1;
    return { leaveSession, hitbodedut: ({ resume }) => { after.controller.ready = after.controller.recover(T0 + MIN, { resume }); return after.controller; } };
  };
  assert.equal(await recoverHitbodedutAtLaunch({ doc: w.doc, hash: '#today', storage, statusBar: w.statusBar, load }), true);
  assert.equal(loaded, 1);
  assert.equal(w.attrs.has(IMMERSIVE_ATTR), false);
  assert.ok(w.statusBar.calls.includes('show'));
  assert.equal(after.controller.active, false);
  assert.equal(after.device.brightness, 0.7, 'the original brightness from the record');
  assert.equal(after.device.awake, false);
  assert.ok(after.log.includes('liveEnd'));
  assert.equal(after.log.includes('dim'), false);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
  assert.equal(after.controller.summary, null);
});

test('launch recovery: on התבודדות itself the page resumes the session; with nothing left, nothing is loaded', async () => {
  const storage = memoryStorage({ [SESSION_KEY]: '{}' });
  let loaded = 0;
  const load = async () => { loaded += 1; return {}; };
  const w = world();
  w.doc.sessionScreen = true;
  w.attrs.set(IMMERSIVE_ATTR, 'hitbodedut');
  assert.equal(await recoverHitbodedutAtLaunch({ doc: w.doc, hash: '#leatzmi/hitbodedut', storage, statusBar: w.statusBar, load }), false);
  assert.equal(w.attrs.has(IMMERSIVE_ATTR), true, 'a session screen already showing keeps its look');
  const clean = world('#today');
  clean.attrs.set(IMMERSIVE_ATTR, 'hitbodedut');
  assert.equal(await recoverHitbodedutAtLaunch({ doc: clean.doc, hash: '#today', storage: memoryStorage(), statusBar: clean.statusBar, load }), false);
  assert.equal(clean.attrs.has(IMMERSIVE_ATTR), false, 'a stray attribute is removed anyway');
  assert.equal(loaded, 0);
});

test('Tehillim dims the screen less than the quiet clock (reading needs light)', () => {
  assert.equal(sessionOptions({ display: 'tehillim' }).dimLevel, TEHILLIM_DIM_LEVEL);
  assert.ok(TEHILLIM_DIM_LEVEL >= 0.25);
  assert.equal(sessionOptions({ display: 'timer' }).dimLevel, undefined);
  assert.equal(sessionOptions({ display: 'tehillim', dimLevel: 0.2 }).dimLevel, 0.2);
});

// ── The look: computed from the stylesheet itself ──────────────────────────────────────────────────────────────────
const css = readFileSync(new URL('../src/styles/hitbodedut.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/HitbodedutPage.jsx', import.meta.url), 'utf8');
const prop = (name, scope = css) => { const m = scope.match(new RegExp(`${name}:\\s*([^;}]+)`)); assert.ok(m, name); return m[1].trim(); };
const rgba = value => {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const m = value.match(/rgba?\(([^)]+)\)/);
  assert.ok(m, value);
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
};
const over = (base, [r, g, b, a]) => [base[0] * (1 - a) + r * a, base[1] * (1 - a) + g * a, base[2] * (1 - a) + b * a];
const lum = ([r, g, b]) => { const c = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const BLACK = [5, 5, 5];

test('the Tehillim centre verse keeps ≥ 7:1 against the candle at its brightest point', () => {
  const scope = css.slice(css.indexOf('.hb-session.is-tehillim{'));
  let bg = over(BLACK, rgba(prop('--hb-glow')));                  // the session's own faint glow
  bg = over(bg, rgba(prop('--hb-candle-aura', scope)));            // the candle's wide aura
  bg = over(bg, rgba(prop('--hb-candle-halo', scope)));            // its halo (full strength at the centre — the breath's peak)
  bg = over(bg, rgba(prop('--hb-candle-flame', scope)));           // the upright flame of light through the centre
  bg = over(bg, rgba(prop('--hb-candle-core', scope)));            // and its heart
  const text = rgba(prop('--hb-verse', scope)).slice(0, 3);
  const ratio = contrast(text, bg);
  assert.ok(ratio >= 7, `centre verse ${ratio.toFixed(2)}:1`);
  assert.ok(lum(bg) > lum(BLACK) * 20, 'and the candle is a real light behind it');
  assert.match(css, /\.hb-wheel-item\.is-centre\{color:var\(--hb-verse/);
  // The neighbours: softer, yet visible.
  const near = rgba(prop('--hb-verse-near', scope)).slice(0, 3);
  const opacity = page.match(/WHEEL_OPACITY = \[([^\]]+)\]/)[1].split(',').map(Number);
  assert.equal(opacity[0], 1);
  assert.ok(opacity[1] >= 0.45 && opacity[1] < 1);
  assert.ok(contrast(over(BLACK, [...near, opacity[1]]), BLACK) >= 4.5, 'the first neighbours read clearly');
  // The dimming layer reaches the centre on the Tehillim screen only at half strength (the words stay readable).
  assert.match(css, /\.hb-session\.is-tehillim \.hb-dim-layer\{[^}]*mask-image:radial-gradient\(ellipse[^;]*rgba\(0,0,0,\.5\) 0/);
});

test('the session controls are gold and findable at rest (≥ 4.5:1), bright when lit', () => {
  const block = css.slice(css.indexOf('.hb-controls{'), css.indexOf('}', css.indexOf('.hb-controls{')));
  const gold = rgba(prop('--hb-gold', block));
  const rest = Number(prop('opacity', block));
  assert.ok(gold[0] > gold[2] + 60 && gold[1] > gold[2] + 30, 'a gold hue');
  const atRest = contrast(over(BLACK, [...gold.slice(0, 3), rest]), BLACK);
  assert.ok(atRest >= 4.5, `at rest ${atRest.toFixed(2)}:1`);
  assert.ok(contrast(gold.slice(0, 3), BLACK) >= 7, 'lit');
  assert.match(css, /\.hb-ctl-ring\{[^}]*border:1\.5px solid var\(--hb-gold-ring\)/);
  assert.match(css, /\.hb-ctl small\{[^}]*color:var\(--hb-gold\)/);
});

test('visibility alone: the app shown again on another screen (no navigation event seen) ends the session', async () => {
  const w = world();
  const r = rig();
  await startedIn(w, r);
  const off = watchSessionRoute({ win: w.win, doc: w.doc, controller: r.controller, statusBar: w.statusBar });
  w.hide();
  await r.controller.background();
  w.entries[w.index].hash = '#today';            // the WebView was reloaded / restored elsewhere while hidden
  assert.equal(r.controller.active, true);
  w.show();
  await settle();
  assertRestored(r, w);
  off();
});
