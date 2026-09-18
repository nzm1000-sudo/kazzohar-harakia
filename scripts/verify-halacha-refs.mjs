// Verifies every reference in the question layer resolves on Sefaria with Hebrew text.
// Usage: node scripts/verify-halacha-refs.mjs
import { HALACHA_QUESTIONS } from '../src/data/halachaQuestions.mjs';

const refs = [...new Set(HALACHA_QUESTIONS.flatMap(q => q.sources.map(s => s.ref)))];
const results = new Map();
for (let i = 0; i < refs.length; i += 8) {
  await Promise.all(refs.slice(i, i + 8).map(async ref => {
    try {
      const d = await (await fetch('https://www.sefaria.org/api/texts/' + encodeURIComponent(ref) + '?context=0&commentary=0')).json();
      const he = Array.isArray(d.he) ? d.he.flat(Infinity).filter(Boolean) : d.he ? [d.he] : [];
      results.set(ref, { ok: he.length > 0, actual: d.ref, license: d.heLicense, version: d.heVersionTitle, error: d.error });
    } catch (e) { results.set(ref, { ok: false, error: e.message }); }
  }));
}
const bad = [...results].filter(([, r]) => !r.ok);
const licenses = {};
for (const [, r] of results) if (r.ok) licenses[r.license || 'unknown'] = (licenses[r.license || 'unknown'] || 0) + 1;
console.log(JSON.stringify({ questions: HALACHA_QUESTIONS.length, uniqueRefs: refs.length, ok: refs.length - bad.length, licenses, bad: bad.map(([ref, r]) => ({ ref, error: r.error })) }, null, 2));
process.exitCode = bad.length ? 1 : 0;
