// Stage 1 — ingestion. Reads the archive's manifest, leaves out the administrative appendix (04_נספחים_אחרים), and dumps
// every glyph of every PDF (pdf_glyphs.py) into the scratch folder. The PDFs themselves are never modified or shipped.
// Usage: node scripts/bnei-zion/ingest.mjs [--pilot]        (the pilot: בראשית, יתרו, פסח, שבועות)
//        node scripts/bnei-zion/ingest.mjs --all-stages [--pilot] [--force]
//          (ingest → extract → segment → classify → dedupe → validate → build-index → coverage)
// Needs: BNEI_ZION_SRC, BNEI_ZION_WORK (see lib.mjs); poppler + tesseract (heb) for OCR; a python with pymupdf + fonttools.
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { exists, paths, readJson, writeJson } from './lib.mjs';

const run = promisify(execFile);
export const PILOT_FOLDERS = ['01_פרשות_השבוע/בראשית', '01_פרשות_השבוע/יתרו', '02_מועדים_ושבתות_מיוחדות/פסח', '02_מועדים_ושבתות_מיוחדות/שבועות'];
const EXCLUDED_FOLDER = '04_נספחים_אחרים';

export async function ingest({ pilotOnly = false } = {}) {
  const P = paths();
  const manifest = readJson(join(P.src, 'manifest.json'));
  const items = [];
  const excluded = [];
  for (const m of manifest.items) {
    if (m.file_path.startsWith(EXCLUDED_FOLDER) || m.category === 'other') { excluded.push({ path: m.file_path, reason: 'administrative appendix' }); continue; }
    const folder = m.file_path.split('/').slice(0, -1).join('/');
    items.push({
      id: m.id, path: m.file_path, folder, category: m.category, parasha: m.parasha, holiday: m.holiday,
      hebrewYear: m.hebrew_year, editionNote: m.edition_note, pages: m.page_count, sha256: m.sha256, title: m.display_title,
      pilot: PILOT_FOLDERS.includes(folder),
    });
  }
  const todo = items.filter(i => (!pilotOnly || i.pilot) && !exists(join(P.work, 'glyphs', `${i.id}.json`)));
  const script = new URL('./pdf_glyphs.py', import.meta.url).pathname;
  let next = 0;
  const failed = [];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < todo.length) {
      const item = todo[next++];
      try {
        const { stdout } = await run(P.py, [script, join(P.src, item.path)], { maxBuffer: 1 << 30 });
        writeFileSync(join(P.work, 'glyphs', `${item.id}.json`), stdout);
      } catch (error) { failed.push({ id: item.id, path: item.path, error: String(error.message).slice(0, 200) }); }
    }
  }));
  for (const item of items) item.dumped = exists(join(P.work, 'glyphs', `${item.id}.json`));
  writeJson(P.stage('ingest'), { generatedAt: new Date().toISOString(), pilotOnly, totalInManifest: manifest.items.length, items, excluded, failed });
  return { items: items.length, pilot: items.filter(i => i.pilot).length, dumped: items.filter(i => i.dumped).length, excluded: excluded.length, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pilotOnly = process.argv.includes('--pilot');
  const result = await ingest({ pilotOnly });
  console.log('ingest:', JSON.stringify(result));
  if (process.argv.includes('--all-stages')) {
    const { extractAll } = await import('./extract.mjs');
    const { segmentAll } = await import('./segment.mjs');
    const { classifyAll } = await import('./classify.mjs');
    const { dedupeAll } = await import('./dedupe.mjs');
    const { validateAll } = await import('./validate.mjs');
    const { buildIndex } = await import('./build-index.mjs');
    const ex = extractAll({ pilotOnly, force: process.argv.includes('--force') });
    console.log(`extract: ${ex.length} files`);
    console.log('segment:', JSON.stringify(segmentAll({ pilotOnly })));
    console.log('classify:', JSON.stringify(classifyAll()));
    console.log('dedupe:', JSON.stringify(dedupeAll()));
    console.log('validate:', JSON.stringify(validateAll()));
    console.log('build:', JSON.stringify(buildIndex({ pilotOnly })));
    const { coverage } = await import('./coverage.mjs');
    console.log('coverage:', JSON.stringify(coverage({ pilotOnly })));
  }
}
