// האתגר העולמי — the Cloudflare Worker's entry (wrangler.toml main). Wires the routes (app.mjs) to D1 and the secret.
//   env.DB             the D1 database (binding "DB")
//   env.TOKEN_SECRET   the HMAC secret of the signed start (wrangler secret put TOKEN_SECRET) — never in the repo
//   env.ALLOWED_ORIGINS comma-separated origins (vars); env.DEV = "true" also allows http://localhost:* (wrangler dev)
//   env.RATE_LIMITER   optional Workers rate-limit binding; without it the write limits are D1 counters
// A daily cron (wrangler.toml [triggers]) sweeps the old rows.
import { createApp, scheduled as sweep } from './app.mjs';
import { createD1Store } from './d1Store.mjs';
import KEY from './key.mjs';

let app = null;
let appEnv = null;
function appFor(env) {
  if (app && appEnv === env) return app;
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app = createApp({ store: createD1Store(env.DB), secret: env.TOKEN_SECRET, key: KEY, allowedOrigins: allowed.length ? allowed : undefined, dev: env.DEV === 'true', rateLimiter: env.RATE_LIMITER || null });
  appEnv = env;
  return app;
}

export default {
  async fetch(request, env) {
    try { return await appFor(env)(request); } catch { return new Response('{"error":"config"}', { status: 500, headers: { 'content-type': 'application/json' } }); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(sweep(createD1Store(env.DB), Date.now())); },
};
