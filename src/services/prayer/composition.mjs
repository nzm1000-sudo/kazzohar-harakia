// Crash-proof composition and per-prayer kill switch (Smart Siddur stage 5).
// A composer that throws must never take the Siddur down: safeCompose returns a result object
// and the caller falls back to the printed edition with a visible note.

// Kill switch: set a prayer to false to return it to the printed text immediately.
export const PRAYER_ENGINE_FLAGS = Object.freeze({
  'edot-hamizrach.weekday-mincha': true,
});
export const engineEnabled = packId => PRAYER_ENGINE_FLAGS[packId] === true;

export function safeCompose(compose, { onError = null } = {}) {
  try {
    const composed = compose();
    if (!composed || !composed.document || !Array.isArray(composed.document.sections)) {
      return { ok: false, composed: null, reason: 'invalid-document', error: null };
    }
    return { ok: true, composed, reason: null, error: null };
  } catch (error) {
    try { onError?.(error); } catch { /* reporting must not throw either */ }
    return { ok: false, composed: null, reason: 'composer-threw', error: { name: error?.name || 'Error', message: String(error?.message || error) } };
  }
}
