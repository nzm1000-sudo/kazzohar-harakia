// התבודדות — the screen's brightness and keep-awake, with the promise that the person's own brightness always comes back.
// Pure logic over an injected native plugin (KZHitbodedut: dim / restore / getBrightness / setKeepAwake) and a
// storage (localStorage-like), so it is tested with mocks (tests/hitbodedutBrightness.test.mjs).
//
// The original brightness is restored:
//   · when the session ends (restore)
//   · when the app goes to the background (suspend — and re-dimmed on return, if the session is still on)
//   · on termination and after a crash: the native side keeps its own copy of the original (UserDefaults /
//     SharedPreferences) and puts it back when the app terminates and again when the plugin loads; on the next launch
//     recover() repeats it from this side, so a stale record can never leave the screen dark.
// Without the native plugin (the web), nothing happens here; the session's software dimming layer is the dimming.

export const BRIGHTNESS_KEY = 'kz-hitbodedut-brightness-v1';
export const DEFAULT_DIM_LEVEL = 0.12;   // of 1 — low enough to be calm, high enough to still read the time
export const MIN_DIM_LEVEL = 0.02;
export const END_RAMP_MS = 3000;          // the climb back to the person's brightness when a session ends

const clampLevel = value => Math.min(1, Math.max(MIN_DIM_LEVEL, Number.isFinite(Number(value)) ? Number(value) : DEFAULT_DIM_LEVEL));

function readRecord(storage) {
  try {
    const raw = storage?.getItem(BRIGHTNESS_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    return record && Number.isFinite(record.original) ? record : null;
  } catch { return null; }
}
function writeRecord(storage, record) { try { storage?.setItem(BRIGHTNESS_KEY, JSON.stringify(record)); } catch {} }
function clearRecord(storage) { try { storage?.removeItem(BRIGHTNESS_KEY); } catch {} }

export function createBrightnessGuard({ plugin = null, storage = null, now = () => Date.now() } = {}) {
  let state = { dimmed: false, suspended: false, level: DEFAULT_DIM_LEVEL, keepAwake: false };
  const call = async (method, args) => {
    if (!plugin || typeof plugin[method] !== 'function') return null;
    try { return await plugin[method](args); } catch { return null; }
  };

  return {
    get state() { return { ...state, record: readRecord(storage) }; },

    // Lowers the brightness, remembering the original first (once — a second dim never overwrites the original with
    // an already-dimmed value).
    async dim(level = DEFAULT_DIM_LEVEL) {
      const target = clampLevel(level);
      let record = readRecord(storage);
      if (!record) {
        const current = await call('getBrightness');
        const original = Number(current?.brightness);
        if (Number.isFinite(original)) {
          record = { original, level: target, at: now() };
          writeRecord(storage, record);
        }
      } else {
        record = { ...record, level: target };
        writeRecord(storage, record);
      }
      // Dimming never brightens: a person whose own brightness is already lower keeps theirs (Android reports "no
      // override" as a negative original — unknown, so no cap there).
      const own = Number(record?.original);
      const applied = Number.isFinite(own) && own > 0 ? Math.max(MIN_DIM_LEVEL, Math.min(target, own)) : target;
      const result = await call('dim', { level: applied });
      if (!record && Number.isFinite(Number(result?.original))) writeRecord(storage, { original: Number(result.original), level: target, at: now() });
      state = { ...state, dimmed: true, suspended: false, level: applied };
      return state;
    },

    // Puts the original brightness back and forgets it. With rampMs (the end of a session, in the open app) the native
    // side climbs back to it gradually instead of at once — so nobody is left in the dark, nor dazzled.
    async restore({ rampMs = 0 } = {}) {
      const record = readRecord(storage);
      const ramp = Math.max(0, Math.round(Number(rampMs) || 0));
      if (record || state.dimmed) await call('restore', { ...(record ? { original: record.original } : {}), ...(ramp ? { rampMs: ramp } : {}) });
      clearRecord(storage);
      state = { ...state, dimmed: false, suspended: false };
      return state;
    },

    // The app went to the background: the person's brightness comes back at once (the native side does the same on its
    // own); the record stays, so the return re-dims.
    async suspend() {
      if (!state.dimmed) return state;
      const record = readRecord(storage);
      await call('restore', record ? { original: record.original, keepRecord: true } : { keepRecord: true });
      state = { ...state, suspended: true };
      return state;
    },

    async resumeDim() {
      if (!state.dimmed || !state.suspended) return state;
      await call('dim', { level: state.level });
      state = { ...state, suspended: false };
      return state;
    },

    async setKeepAwake(on) {
      await call('setKeepAwake', { on: Boolean(on) });
      state = { ...state, keepAwake: Boolean(on) };
      return state;
    },

    // On launch / when the page opens: a record without a live session means the app ended while dimmed (a crash, a
    // kill from the app switcher) — restore. Returns true when something was restored.
    async recover({ sessionActive = false } = {}) {
      const record = readRecord(storage);
      if (!record || sessionActive) return false;
      await call('restore', { original: record.original });
      await call('setKeepAwake', { on: false });
      clearRecord(storage);
      state = { ...state, dimmed: false, suspended: false, keepAwake: false };
      return true;
    },
  };
}
