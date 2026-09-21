import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = process.argv[2] || '/tmp/yalkut-parts';
const outputFile = process.argv[3] || path.resolve(scriptDir, '../src/data/yalkutYosef.mjs');

const decode = bytes => new TextDecoder('windows-1255').decode(bytes);
const decodeEntities = value => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const plainText = html => decodeEntities(String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<hr\s*\/?>/gi, '\n')
  .replace(/<p\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\r/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim());

const heading = fragment => {
  const candidates = [...fragment.matchAll(/<u[^>]*>([\s\S]*?)<\/u>/gi)]
    .map(match => plainText(match[1]))
    .filter(Boolean);
  return candidates.at(-1) || '';
};

const files = fs.readdirSync(sourceDir)
  .filter(name => /^f_01355_part_\d+\.html$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

const sections = [];
for (const file of files) {
  const part = Number(file.match(/part_(\d+)/)[1]);
  const html = decode(fs.readFileSync(path.join(sourceDir, file)));
  const chapterMatches = [...html.matchAll(/<!--\$@-->([\s\S]*?)(?=<!--\$@-->|$)/g)];
  if (chapterMatches.length !== 1) throw new Error(`${file}: expected one chapter marker, got ${chapterMatches.length}`);
  const chapterHtml = chapterMatches[0][1];
  const chapterTitle = heading(chapterHtml);
  const sectionMatches = [...chapterHtml.matchAll(/<!--\$~-->([\s\S]*?)(?=<!--\$~-->|$)/g)];
  for (let sectionIndex = 0; sectionIndex < sectionMatches.length; sectionIndex += 1) {
    const sectionHtml = sectionMatches[sectionIndex][1];
    const sectionTitle = heading(sectionHtml);
    const halachot = [...sectionHtml.matchAll(/<!--\$!-->([\s\S]*?)(?=<!--\$!-->|$)/g)];
    if (!sectionTitle) throw new Error(`${file}: malformed section ${sectionIndex}`);
    const records = halachot.length > 0 ? halachot.map(match => ({ html: match[1], anchor: match[1].match(/<a\s+name=['"]([^'"]+)['"]/i)?.[1] || '' })) : [{ html: sectionHtml, anchor: '' }];
    for (let halachaIndex = 0; halachaIndex < records.length; halachaIndex += 1) {
      const text = plainText(records[halachaIndex].html);
      if (!text || !/[\u0590-\u05ff]/.test(text) || text.includes('\ufffd') || (halachot.length > 0 && !records[halachaIndex].anchor)) throw new Error(`${file}: malformed halacha ${sectionIndex}/${halachaIndex}`);
      sections.push({
        id: `yalkut-yosef-${part}-${sectionIndex + 1}-${halachaIndex + 1}`,
        part,
        sectionIndex: sectionIndex + 1,
        halachaIndex: halachaIndex + 1,
        chapter: chapterTitle,
        section: sectionTitle,
        label: `${sectionTitle} · הלכה ${halachaIndex + 1}`,
        text,
        source: `f_01355_part_${part}.html#${records[halachaIndex].anchor || `section-${part}-${sectionIndex + 1}`}`,
      });
    }
  }
}

const ids = new Set(sections.map(section => section.id));
if (ids.size !== sections.length || sections.length !== 14305) throw new Error(`Unexpected section count: ${sections.length}`);

const pack = {
  id: 'yalkut-yosef-tashz',
  title: 'קיצור שולחן ערוך ילקוט יוסף',
  author: 'הרב יצחק יוסף',
  edition: 'מהדורת תשס"ז',
  provider: 'תורת אמת',
  sourceUrl: 'https://www.toratemetfreeware.com/online/f_01355.html',
  license: 'CC BY-NC-SA 2.5',
  distributionModel: 'free-noncommercial',
  rightsNotice: 'כל הזכויות שמורות (c) למו"ר הרב יצחק יוסף שליט"א',
  attribution: 'קיצור שולחן ערוך ילקוט יוסף, הרב יצחק יוסף, מהדורת תשס"ז. מקור: תורת אמת.',
  parts: files.length,
  sections,
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `// Generated from the official Torat Emet f_01355 corpus.\nexport const YALKUT_YOSEF = ${JSON.stringify(pack)};\n`);
console.log(`Wrote ${sections.length} halachot from ${files.length} parts to ${outputFile}`);