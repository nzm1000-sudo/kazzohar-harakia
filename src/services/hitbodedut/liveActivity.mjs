// The Live Activity of a session (iOS 16.1+, ActivityKit; ios/App/Shared/KZHitbodedutActivity.swift): on the Lock
// Screen "התבודדות · 18:42 נותרו", and in the Dynamic Island a small mark and the remaining time. The countdown is
// drawn by the system (Text(timerInterval:)), so nothing has to be sent while it runs — only on pause, resume and end.
// From iOS 17 its buttons (pause / resume / end) run App Intents in the app; they come back here as actions.
// Where it is not supported (Android, the web, iOS < 16.1, Live Activities switched off) every call is a quiet no-op.

export const LIVE_TITLE = 'התבודדות';

export function createLiveActivityBridge(plugin, { platform = 'web' } = {}) {
  let supported = null;
  let active = false;
  const call = async (method, args) => {
    if (!plugin || typeof plugin[method] !== 'function') return null;
    try { return await plugin[method](args); } catch { return null; }
  };
  const check = async () => {
    if (supported !== null) return supported;
    if (platform !== 'ios' || !plugin) { supported = false; return supported; }
    const result = await call('liveSupported');
    supported = Boolean(result?.supported && result?.enabled !== false);
    return supported;
  };
  return {
    get active() { return active; },
    supported: check,
    async start(timer) {
      if (!timer || !(await check())) return false;
      const result = await call('liveStart', { title: LIVE_TITLE, endsAt: timer.endsAt, durationMs: timer.durationMs, startedAt: timer.startedAt, paused: false, remainingMs: Math.max(0, timer.endsAt - Date.now()) });
      active = Boolean(result?.started);
      return active;
    },
    async pause(timer, remainingMs) {
      if (!active) return false;
      await call('liveUpdate', { endsAt: timer.endsAt, paused: true, remainingMs: Math.max(0, Math.round(remainingMs)) });
      return true;
    },
    async resume(timer) {
      if (!active) return false;
      await call('liveUpdate', { endsAt: timer.endsAt, paused: false, remainingMs: Math.max(0, timer.endsAt - Date.now()) });
      return true;
    },
    async end({ completed = false } = {}) {
      // Always asked of the native side (it also ends a stale activity left by an earlier launch).
      if (!plugin || platform !== 'ios') { active = false; return false; }
      await call('liveEnd', { completed });
      active = false;
      return true;
    },
    // Actions taken on the Lock Screen while the page was not listening (the app was suspended).
    async takeActions() {
      const result = await call('takeLiveActions');
      return Array.isArray(result?.actions) ? result.actions.filter(item => item && ['pause', 'resume', 'end'].includes(item.action)) : [];
    },
  };
}
