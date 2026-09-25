import { mkdir, writeFile } from 'node:fs/promises';
import { BOOK_CATALOG } from '../src/data/bookCatalog.mjs';
import existingBooks from '../src/data/booksOffline.mjs';

const API = 'https://www.sefaria.org/api';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let response;
    try {
      response = await fetch(`${API}${path}`, { signal: controller.signal });
    } catch {
      response = null;
    } finally {
      clearTimeout(timer);
    }
    if (!response) {
      return null;
    }
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) return null;
    await delay(350 * (attempt + 1));
  }
  return null;
}

function refsFromShape(shape, fallbackReference) {
  const refs = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.title === 'string' && typeof node.chapters === 'number') {
      refs.push(`${node.title} 1-${node.chapters}`);
      return;
    }
    if (typeof node.title === 'string' && Array.isArray(node.chapters)) {
      if (node.chapters.every(Array.isArray) && node.chapters.length > 10) refs.push(`${node.title} 1-${node.chapters.length}`);
      else if (node.chapters.every(Array.isArray)) node.chapters.forEach((chapter, index) => refs.push(`${node.title} ${index + 1}:1-${chapter.length}`));
      else if (node.chapters.every(item => typeof item === 'number')) node.chapters.forEach((_, index) => refs.push(`${node.title} ${index + 1}`));
      else refs.push(node.title);
      return;
    }
    if (typeof node.title === 'string') refs.push(node.title);
    if (Array.isArray(node.chapters)) node.chapters.forEach(visit);
  };
  shape.forEach(visit);
  if (!refs.length && shape[0]?.length) {
    const length = Number(shape[0].length);
    if (length > 1) refs.push(`${shape[0].book || fallbackReference} 1-${length}`.trim());
  }
  return [...new Set(refs)];
}

function refsFromIndexSchema(node, refs = []) {
  if (!node || typeof node !== 'object') return refs;
  node.headwordMap?.forEach(([, ref]) => refs.push(ref));
  if (node.nodeType === 'JaggedArrayNode' && node.key) refs.push(node.key);
  node.nodes?.forEach(child => refsFromIndexSchema(child, refs));
  return refs;
}

function flattenHebrew(value) {
  if (Array.isArray(value)) return value.flatMap(flattenHebrew);
  return typeof value === 'string' ? [value] : [];
}

async function fetchBook(book) {
  const shape = await fetchJson(`/shape/${encodeURIComponent(book.reference)}`);
  const index = !Array.isArray(shape) ? await fetchJson(`/v2/raw/index/${encodeURIComponent(book.reference)}`) : null;
  const refs = Array.isArray(shape) ? refsFromShape(shape, book.reference) : refsFromIndexSchema(index?.schema).map(ref => ref.includes(',') ? ref : `${book.reference}, ${ref}`);
  const targets = refs.length ? refs : [book.reference];
  console.log(`ענפים: ${targets.length}`);
  const hebrew = [];
  let metadata = null;
  for (let index = 0; index < targets.length; index += 4) {
    const batch = await Promise.all(targets.slice(index, index + 4).map(ref => fetchJson(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`)));
    batch.forEach(data => {
      if (!data?.he) return;
      metadata ||= data;
      hebrew.push(...flattenHebrew(data.he));
    });
    await delay(25);
  }
  if (!hebrew.length) return null;
  return {
    ref: book.reference,
    heRef: book.title,
    hebrew,
    indexes: hebrew.map((_, index) => index),
    policy: 'source',
    version: metadata.heVersionTitle || null,
    license: metadata.heLicense || null,
    sourceUrl: `https://www.sefaria.org/${encodeURIComponent(book.reference)}?lang=he`,
    bundledOffline: true,
  };
}

const books = { ...existingBooks };
const outputPath = 'src/data/booksOffline.mjs';
const refresh = process.argv.includes('--refresh');
const save = async () => {
  await mkdir('src/data', { recursive: true });
  await writeFile(outputPath, `// Generated from licensed/public-domain Sefaria Hebrew editions.\nexport default ${JSON.stringify(books)};\n`);
};
for (const book of BOOK_CATALOG) {
  const references = book.reference.split(/\s*;\s*/).filter(Boolean);
  if (!refresh && references.length > 1 && references.every(reference => books[reference]?.hebrew.length > 10)) {
    console.log(`כבר קיים ${book.title}`);
    continue;
  }
  if (!refresh && references.length === 1 && books[book.reference] && books[book.reference].hebrew.length > 10) {
    console.log(`כבר קיים ${book.title}`);
    continue;
  }
  process.stdout.write(`מוריד ${book.title}… `);
  const downloaded = await Promise.all(references.map(reference => fetchBook({ ...book, reference })));
  const data = downloaded.filter(Boolean);
  if (data.length) {
    data.forEach(item => { books[item.ref] = item; });
    console.log(`${data.reduce((total, item) => total + item.hebrew.length, 0)} פסקאות`);
    await save();
  } else {
    console.log('לא נמצא טקסט');
  }
}

await save();
console.log(`נשמרו ${Object.keys(books).length} ספרים מקומיים`);