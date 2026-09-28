# Halacha AI proxy (not deployed)

The app's assistant works fully without this. The proxy exists so a *free* cloud model can help understand unclear
Hebrew replies — never to answer halacha from its own knowledge. Retrieval happens on the device; the proxy receives a
small packet (the question, the open multiple-choice step or the top verified entries) and returns JSON that the app
validates with `src/services/ai/halachaGate.mjs` before showing anything.

Zero-cost rules:
- Cloudflare Workers **Free** plan only (over its 100k requests/day the Worker errors; no charge).
- Groq **Free** plan key, with no payment method on the Groq organization (over the limit: HTTP 429).
- Optional Workers AI binding on the Free plan (10,000 Neurons/day, then errors).
- Every limit response becomes HTTP 429 to the app → the app benches the provider and falls back. No paid fallback.
- Gemini's free tier is deliberately not used: its terms allow human review of inputs and ask not to send sensitive
  data, and it may not be offered to users in the EEA/UK.

To enable: deploy (`wrangler deploy` with `wrangler.toml` from the example), set `GROQ_API_KEY`, then build the app with
`VITE_HALACHA_AI_PROXY=https://<worker>.workers.dev`. Requires the owner's explicit approval; nothing here is deployed.
