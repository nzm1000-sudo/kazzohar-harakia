// Halacha AI proxy — a Cloudflare Worker (free plan) that holds the free-tier API key and forwards one small, already-
// retrieved packet to a free model. It never calls a paid endpoint, never retries into a paid tier, and turns every
// quota/limit response into HTTP 429 so the app falls back to its deterministic engine.
// Env: GROQ_API_KEY (Groq free plan, no card on file), optional AI binding (Workers AI, Workers Free plan), ALLOWED_ORIGINS.
const MAX_BODY = 12_000;
const MAX_OUTPUT = 600;
const PER_IP_PER_MINUTE = 6;
const TASKS = {
  'map-option': 'The user is answering a multiple-choice question. Reply with JSON {"index": n} for the option they mean (0-based), or {"index": null} if unclear. No other text.',
  interpret: 'Map the Hebrew question to one of the given flow ids if it clearly belongs to one: {"flowId": "..."}; otherwise rewrite it as a short, clear Hebrew search query: {"query": "..."}; if it is not a halacha question: {}. Never answer the question.',
  explain: 'You explain an already-decided halachic answer to a Hebrew speaker, using ONLY the entries and sources in the packet. Every sentence must be a claim with sourceIds from the packet; quotes must be verbatim. Do not add rulings, conditions, opinions, rabbis or books that are not in the packet. If the packet does not support an explanation, return {"type":"insufficient","claims":[]}. JSON: {"type":"answer|disagreement|insufficient","text":"...","claims":[{"text":"...","sourceIds":["..."],"support":"direct|synthesis","quote":"..."}],"entryIds":[],"sourceIds":[],"confidence":"direct|grounded_synthesis|incomplete"}.',
};
const recent = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = { 'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('method', { status: 405, headers: cors });
    const ip = request.headers.get('cf-connecting-ip') || 'x';
    const minute = Math.floor(Date.now() / 60000);
    const count = recent.get(`${ip}:${minute}`) || 0;
    if (count >= PER_IP_PER_MINUTE) return new Response('{"error":"rate"}', { status: 429, headers: { ...cors, 'retry-after': '60' } });
    recent.set(`${ip}:${minute}`, count + 1);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return new Response('{"error":"too-large"}', { status: 413, headers: cors });
    let body; try { body = JSON.parse(raw); } catch { return new Response('{"error":"json"}', { status: 400, headers: cors }); }
    const system = TASKS[body.task];
    if (!system) return new Response('{"error":"task"}', { status: 400, headers: cors });
    const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(body.packet) }];
    const maxTokens = Math.min(Number(body.maxOutputTokens) || 300, MAX_OUTPUT);
    const providers = [groq, workersAi];
    for (const provider of providers) {
      const result = await provider(env, messages, maxTokens).catch(() => null);
      if (result?.quota) continue;
      if (result?.json) return new Response(JSON.stringify(result.json), { headers: { ...cors, 'content-type': 'application/json' } });
    }
    return new Response('{"error":"quota"}', { status: 429, headers: { ...cors, 'retry-after': '3600' } });
  },
};

async function groq(env, messages, maxTokens) {
  if (!env.GROQ_API_KEY) return null;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.GROQ_MODEL || 'openai/gpt-oss-120b', messages, max_tokens: maxTokens, temperature: 0.1, response_format: { type: 'json_object' } }),
  });
  if (response.status === 429) return { quota: true };
  if (!response.ok) return null;
  const data = await response.json();
  return { json: JSON.parse(data.choices?.[0]?.message?.content || 'null') };
}

async function workersAi(env, messages, maxTokens) {
  if (!env.AI) return null;
  try {
    const out = await env.AI.run(env.WORKERS_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages, max_tokens: maxTokens, response_format: { type: 'json_object' } });
    const text = typeof out?.response === 'string' ? out.response : JSON.stringify(out?.response ?? null);
    return { json: JSON.parse(text) };
  } catch { return { quota: true }; } // on the Workers Free plan, an exhausted daily allowance fails instead of billing
}
