export class RequestTimeoutError extends Error {
  constructor(ms) { super(`Request timed out after ${ms}ms`); this.name = 'TimeoutError'; }
}
function cancelled(reason) {
  if (reason instanceof Error) return reason;
  const error = new Error('Request cancelled'); error.name = 'AbortError'; return error;
}

// Bound both receipt of headers AND consumption of the response body.
// Promise.race also protects against a transport adapter that ignores abort.
export async function requestJsonResponse(url, {
  signal, timeoutMs = 12000, fetchImpl = globalThis.fetch, ...options
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Invalid timeout');
  if (signal?.aborted) throw cancelled(signal.reason);
  const controller = new AbortController();
  let rejectAbort;
  const interruption = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = reason => { const error = cancelled(reason); controller.abort(error); rejectAbort(error); };
  const onAbort = () => abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => abort(new RequestTimeoutError(timeoutMs)), timeoutMs);
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { ...options, signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        return { response, data };
      })(),
      interruption,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
