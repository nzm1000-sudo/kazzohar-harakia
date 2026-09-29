// The semantic benchmark runner: every query of tests/fixtures/semanticBenchmark.mjs through the engine, offline, from
// the app's own files. Prints Top-1, Top-5 and MRR@10 overall and by query type.
//   node scripts/torah/semantic-benchmark.mjs                 (the engine as shipped: hybrid)
//   node scripts/torah/semantic-benchmark.mjs --mode lexical  (Stage 0's lexical engine alone — the "before")
//   --verbose                                                  (each query's first ranks)
import { readFileSync } from 'node:fs';
import { diskFetch } from '../../tests/helpers/diskAssets.mjs';
import { configureIndexLoader } from '../../src/services/torah/searchIndex.mjs';
import { searchTorah } from '../../src/services/torah/search.mjs';
import { BENCHMARK, HELD_OUT, gradeOf, rankedOf, scoreQuery, summarize } from '../../tests/fixtures/semanticBenchmark.mjs';

export async function runBenchmark({ mode = 'hybrid', verbose = false, queries = BENCHMARK } = {}) {
  globalThis.fetch = diskFetch;
  configureIndexLoader({ load: async file => new Uint8Array(readFileSync(new URL(`../../public/torah-index/${file}`, import.meta.url))) });
  const rows = [];
  const times = [];
  for (const entry of queries) {
    const started = performance.now();
    const data = await searchTorah(entry.query, { limit: 10, mode });
    times.push(performance.now() - started);
    const score = scoreQuery(entry, data);
    rows.push({ id: entry.id, type: entry.type, ...score });
    if (verbose) {
      const ranked = rankedOf(data).slice(0, 5).map(item => `${gradeOf(item, entry)}:${item.kind === 'reference' ? `ref ${item.route}` : item.id}`);
      console.log(`${entry.id.padEnd(20)} top1=${score.top1} rr=${score.rr10.toFixed(2)} total=${data.total} ${ranked.join(' | ')}`);
    }
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { mode, ...summarize(rows), rows, latency: { median: Math.round(sorted[sorted.length >> 1]), p90: Math.round(sorted[Math.floor(sorted.length * 0.9)]), max: Math.round(sorted.at(-1)) } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'hybrid';
  const result = await runBenchmark({ mode, verbose: process.argv.includes('--verbose'), queries: process.argv.includes('--held-out') ? HELD_OUT : BENCHMARK });
  console.log(JSON.stringify({ mode: result.mode, all: result.all, byType: result.byType, latency: result.latency }, null, 1));
}
