// HalachaLanguageModel — one interface for every language model the assistant may use, so the Halacha logic never
// knows which vendor answered. FREE-FIRST: the chain only ever holds on-device or free-tier providers; a provider that
// reports its quota exhausted is benched until its reset time. Nothing here can upgrade to a paid tier, and when no
// provider is available the assistant simply runs on the deterministic engine.
//
// interface HalachaLanguageModel {
//   id: string; label: string; kind: 'on-device' | 'cloud' | 'mock' | 'none';
//   availability(): Promise<{ available: boolean, reason?: string }>;
//   complete({ task, packet, maxOutputTokens, signal }): Promise<object>   // parsed JSON, validated by the caller
// }

export class ModelUnavailableError extends Error { constructor(reason) { super(reason); this.reason = reason; } }
export class QuotaExhaustedError extends Error { constructor(retryAfterMs = 60 * 60 * 1000) { super('quota-exhausted'); this.retryAfterMs = retryAfterMs; } }

export const NoModelProvider = {
  id: 'none', label: 'ללא מודל', kind: 'none',
  async availability() { return { available: false, reason: 'no-model' }; },
  async complete() { throw new ModelUnavailableError('no-model'); },
};

// Apple Foundation Models through the app's native message bridge (KZBridgeViewController, "kzHalachaModel"), on
// iOS 26+ with Apple Intelligence on. Hebrew is not a supported language of the on-device model today, so the native
// side reports "language-not-supported" and this stays unavailable; it turns on without an app change once Apple adds
// Hebrew, because the check (supportsLocale("he")) is made on the device each time.
export function nativeHalachaBridge(win = globalThis.window) {
  const handler = win?.webkit?.messageHandlers?.kzHalachaModel;
  if (!handler) return null;
  const pending = new Map();
  let counter = 0;
  win.__kzHalachaModelReply = message => { const resolve = pending.get(message?.id); if (resolve) { pending.delete(message.id); resolve(message); } };
  const call = (action, payload = {}, timeoutMs = 12000) => new Promise(resolve => {
    const id = `m${++counter}`;
    pending.set(id, resolve);
    setTimeout(() => { if (pending.delete(id)) resolve({ error: 'timeout' }); }, timeoutMs);
    handler.postMessage({ action, id, ...payload });
  });
  return { availability: payload => call('availability', payload, 3000), respond: payload => call('respond', payload) };
}

export function AppleOnDeviceProvider({ bridge = nativeHalachaBridge() } = {}) {
  return {
    id: 'apple-on-device', label: 'Apple · על המכשיר', kind: 'on-device',
    async availability() {
      if (!bridge) return { available: false, reason: 'not-native' };
      const result = await bridge.availability({ locale: 'he' });
      return result?.available ? { available: true } : { available: false, reason: result?.reason || result?.error || 'unavailable' };
    },
    async complete({ task, packet, maxOutputTokens = 300 }) {
      const result = await bridge.respond({ task, packet: JSON.stringify(packet), maxOutputTokens });
      if (result?.error) throw new ModelUnavailableError(result.error);
      try { return JSON.parse(result?.json || 'null'); } catch { throw new ModelUnavailableError('bad-json'); }
    },
  };
}

// A free cloud model behind the app's own tiny proxy (server/halacha-ai-proxy). The key lives only in the proxy.
// Not configured → unavailable. HTTP 429 → QuotaExhaustedError (fallback, never billing).
export function CloudProxyProvider({ endpoint = null, fetchImpl = globalThis.fetch, timeoutMs = 9000 } = {}) {
  return {
    id: 'cloud-free', label: 'מודל ענן חינמי', kind: 'cloud',
    async availability() {
      if (!endpoint) return { available: false, reason: 'not-configured' };
      if (globalThis.navigator && globalThis.navigator.onLine === false) return { available: false, reason: 'offline' };
      return { available: true };
    },
    async complete({ task, packet, maxOutputTokens = 600, signal }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      signal?.addEventListener?.('abort', () => controller.abort());
      try {
        const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, packet, maxOutputTokens }), signal: controller.signal });
        if (response.status === 429) throw new QuotaExhaustedError(Number(response.headers?.get?.('retry-after') || 3600) * 1000);
        if (!response.ok) throw new ModelUnavailableError(`http-${response.status}`);
        return await response.json();
      } catch (error) {
        if (error instanceof QuotaExhaustedError || error instanceof ModelUnavailableError) throw error;
        throw new ModelUnavailableError(error?.name === 'AbortError' ? 'timeout' : 'network');
      } finally { clearTimeout(timer); }
    },
  };
}

// Scripted provider for tests and for exercising the UI without any key.
export function MockProvider(script = {}, { available = true } = {}) {
  const calls = [];
  return {
    id: 'mock', label: 'מודל בדיקה', kind: 'mock', calls,
    async availability() { return available ? { available: true } : { available: false, reason: 'mock-off' }; },
    async complete(request) {
      calls.push(request);
      const reply = typeof script[request.task] === 'function' ? script[request.task](request) : script[request.task];
      if (reply instanceof Error) throw reply;
      if (reply === undefined) throw new ModelUnavailableError('no-script');
      return reply;
    },
  };
}

// The fallback chain: first available provider wins; failures fall through; quota exhaustion benches a provider.
// Also a small local budget per day and an in-memory cache, so free quotas are not spent twice on the same packet.
export function createModelChain(providers = [], { dailyBudget = 40, now = () => Date.now(), storage = null } = {}) {
  const benchedUntil = new Map();
  const cache = new Map();
  const dayKey = () => new Date(now()).toISOString().slice(0, 10);
  const usedToday = () => { try { const v = JSON.parse(storage?.getItem('kz-ai-budget-v1') || 'null'); return v?.day === dayKey() ? v.used : 0; } catch { return 0; } };
  const spend = () => { try { storage?.setItem('kz-ai-budget-v1', JSON.stringify({ day: dayKey(), used: usedToday() + 1 })); } catch { /* ignore */ } };
  let memoryUsed = 0;
  const used = () => storage ? usedToday() : memoryUsed;

  async function status() {
    for (const provider of providers) {
      if ((benchedUntil.get(provider.id) || 0) > now()) continue;
      const availability = await provider.availability();
      if (availability.available) return { provider, available: true };
    }
    return { provider: null, available: false };
  }

  async function complete(request) {
    const key = JSON.stringify([request.task, request.packet]);
    if (cache.has(key)) return { ...cache.get(key), cached: true };
    for (const provider of providers) {
      if ((benchedUntil.get(provider.id) || 0) > now()) continue;
      const availability = await provider.availability();
      if (!availability.available) continue;
      if (provider.kind === 'cloud' && used() >= dailyBudget) continue;
      try {
        const json = await provider.complete(request);
        if (provider.kind === 'cloud') { memoryUsed++; spend(); }
        const result = { json, providerId: provider.id };
        cache.set(key, result);
        return result;
      } catch (error) {
        if (error instanceof QuotaExhaustedError) benchedUntil.set(provider.id, now() + error.retryAfterMs);
        // Any other failure falls through to the next provider, and finally to the deterministic engine.
      }
    }
    return null;
  }

  return { providers, status, complete, benchedUntil };
}

// The app's configuration: on-device first, then the free cloud proxy if one was configured at build time.
export function defaultModelChain() {
  let storage = null;
  try { storage = globalThis.localStorage; } catch { /* private mode */ }
  const endpoint = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HALACHA_AI_PROXY) || null;
  return createModelChain([AppleOnDeviceProvider(), CloudProxyProvider({ endpoint })], { storage });
}

// A short Hebrew description of why AI help is off, for the assistant's status line.
export function unavailableReasonLabel(reason) {
  return {
    'not-native': 'בדפדפן אין מודל על המכשיר',
    'language-not-supported': 'המודל של Apple עדיין לא תומך בעברית',
    appleIntelligenceNotEnabled: 'Apple Intelligence כבויה במכשיר',
    deviceNotEligible: 'המכשיר אינו תומך ב־Apple Intelligence',
    modelNotReady: 'המודל של Apple עדיין נטען',
    'os-too-old': 'גרסת iOS ישנה מדי למודל על המכשיר',
    'not-configured': 'לא הוגדר שירות ענן חינמי',
    offline: 'אין חיבור לרשת',
  }[reason] || 'אין מודל זמין כרגע';
}
