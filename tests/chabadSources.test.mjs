// The two open Chabad editions are complete and correctly mapped (docs/siddur/review-chabad.md, "Source audit"):
//   - Siddur Tehillat Hashem (Open Siddur, Shmuel Gonzales): the 18 archived files in sources/opensiddur-chabad/ are the
//     copies the README lists (SHA-256), every ✶ section became a leaf, and every Hebrew word and every <ref> footnote of
//     every file is in the pack — nothing dropped or truncated by the importer;
//   - Siddur Torah Or (Sefaria "Weekday Siddur Chabad", Wikisource): 47 leaves, one version, vouched for by the manifest;
//   - every section of the Chabad composition points at a leaf of one of the two editions and resolves;
//   - the reader's source line credits exactly the editions a composed service uses, with the right licence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import chabad from '../src/data/nusach/compositions/chabad.mjs';
import torahOr from '../src/data/nusach/siddurChabad.mjs';
import tehillat from '../src/data/nusach/siddurChabadTehillatHashem.mjs';
import { SIDDUR_SOURCES, licenseAllowed } from '../src/data/nusach/manifest.mjs';
import { NUSACH_INDEX } from '../src/data/nusach/registry.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, resolveService } from '../src/services/prayer/riteServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';

const SOURCES = new URL('../sources/opensiddur-chabad/', import.meta.url);
const README = readFileSync(new URL('README.md', SOURCES), 'utf8');
const sourceFiles = readdirSync(SOURCES).filter(name => name.endsWith('.txt'));
const nfc = text => text.normalize('NFC');
const rawOf = name => readFileSync(new URL(encodeURIComponent(sourceFiles.find(file => nfc(file) === nfc(name))), SOURCES), 'utf8');

// Hebrew words, letters only: no points, no wiki quote marks, no markup (bold/underline joined, other tags split).
const hebrewWords = text => text.normalize('NFD')
  .replace(/[֑-ׇ‍]/g, '')
  .replace(/'{2,}/g, '')
  .replace(/<\/?(b|u)>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .match(/[א-ת]+/g) || [];
const counts = words => words.reduce((map, word) => map.set(word, (map.get(word) || 0) + 1), new Map());
const difference = (a, b) => [...a].filter(([word, n]) => n > (b.get(word) || 0)).map(([word, n]) => `${word}×${n - (b.get(word) || 0)}`);
// The only word changes of the import: misspelt ✶ headings, corrected in the schema titles (import doc §3).
const TITLE_FIXES = { 'The Shabbat Book': [['סעורת', 'לליל'], ['סעודת', 'ליל']], 'Shacharit and Musaf for Shabbat and Festivals': [['התור'], ['התורה']],
  'The Afternoon Prayers for Shabbat': [['התור'], ['התורה']], 'Prayers for the Three Festivals': [['בירכת', 'קרבנ'], ['ברכת', 'קרבן']],
  'The Blessings Book': [['ברכת', 'מיל'], ['ברכות', 'מילה']] };

test('the archive holds the 18 files the README lists, byte for byte', () => {
  assert.equal(sourceFiles.length, 18);
  for (const name of sourceFiles) {
    const sha = createHash('sha256').update(readFileSync(new URL(encodeURIComponent(name), SOURCES))).digest('hex');
    assert.ok(README.normalize('NFC').includes(`| ${nfc(name)} | ${sha} |`), `${nfc(name)}: SHA-256 ${sha} not in the README`);
  }
});

test('every file is a node, every ✶ section a leaf with text; 18 files, 72 leaves, 3,851 paragraphs', () => {
  const nodes = tehillat.schema.nodes;
  assert.equal(nodes.length, 18);
  let leaves = 0; let paragraphs = 0;
  for (const node of nodes) {
    const file = tehillat.source.files.find(item => item.title === node.title);
    const raw = rawOf(file.file);
    assert.equal(node.nodes.length, raw.split('\n').filter(line => line.includes('✶')).length, `${node.title}: one leaf per ✶ heading`);
    for (const leaf of node.nodes) {
      const text = tehillat.texts[`Siddur Tehillat Hashem, ${node.title}, ${leaf.key}`];
      assert.ok(text?.he?.length, `${node.title} › ${leaf.key}: text`);
      leaves += 1; paragraphs += text.he.length;
    }
  }
  assert.equal(leaves, 72);
  assert.equal(paragraphs, 3851);
  assert.equal(Object.keys(tehillat.texts).length, 72);
});

test('no Hebrew word of any source file is lost or added by the import (title corrections aside)', () => {
  for (const node of tehillat.schema.nodes) {
    const file = tehillat.source.files.find(item => item.title === node.title);
    const lines = rawOf(file.file).replace(/\r\n?/g, '\n').split('\n');
    const first = lines.findIndex(line => line.includes('✶'));
    const licence = lines.findIndex(line => /am the original transcriber/.test(line));
    assert.ok(first >= 0 && licence > first, node.title);
    // Nothing but the licence line and wiki furniture follows the licence statement.
    assert.deepEqual(lines.slice(licence + 1).filter(line => line.trim() && !/^(----|<references\/>)$/.test(line.trim())), [], `${node.title}: back matter`);
    const body = lines.slice(first, licence).join('\n').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
    const source = counts(hebrewWords(body));
    const packWords = [];
    for (const leaf of node.nodes) {
      packWords.push(...hebrewWords(leaf.heTitle));
      for (const paragraph of tehillat.texts[`Siddur Tehillat Hashem, ${node.title}, ${leaf.key}`].he) packWords.push(...hebrewWords(paragraph.replace(/<small class="en note">[\s\S]*?<\/small>/g, '')));
    }
    const pack = counts(packWords);
    const [before, after] = TITLE_FIXES[node.title] || [[], []];
    assert.deepEqual(difference(source, pack).sort(), before.map(word => `${word}×1`).sort(), `${node.title}: words lost`);
    assert.deepEqual(difference(pack, source).sort(), after.map(word => `${word}×1`).sort(), `${node.title}: words added`);
  }
});

test('every <ref> footnote of the wiki files is kept, after its paragraph', () => {
  const notes = Object.values(tehillat.texts).flatMap(text => text.he).join(' ').match(/<small class="en note">[\s\S]*?<\/small>/g).join(' ').normalize('NFC');
  let refs = 0;
  for (const name of sourceFiles) {
    for (const [, inner] of rawOf(name).matchAll(/<ref[^>]*>([\s\S]*?)<\/ref>/g)) {
      refs += 1;
      const text = inner.replace(/'{2,}|<[^>]+>/g, '').replace(/\s+/g, ' ').trim().normalize('NFC');
      assert.ok(notes.includes(text), `${nfc(name)}: footnote «${text}»`);
    }
  }
  assert.equal(refs, 247);
});

test('Tehillat Hashem licence and provenance: every file says CC0 transcription / CC BY instructions; the pack and manifest agree', () => {
  const LICENSE = 'CC0 (Hebrew) / CC BY 4.0 (instructions)';
  assert.equal(tehillat.source.license, LICENSE);
  assert.equal(tehillat.source.url, 'https://opensiddur.org/?p=1260');
  for (const file of tehillat.source.files) {
    assert.match(file.licenceStatement, /Creative Commons Zero License/, file.file);
    assert.match(file.licenceStatement, /instructions with the Creative Commons By Attribution license/, file.file);
    assert.match(file.licenceStatement, /Shmuel?i? Gonzales/, file.file);
    assert.match(file.version, /^Version 3\.\d+/, file.file);
  }
  for (const text of Object.values(tehillat.texts)) {
    assert.equal(text.license, LICENSE, text.ref);
    assert.equal(text.heVersionSource, 'https://opensiddur.org/?p=1260', text.ref);
  }
  const extra = SIDDUR_SOURCES.chabad.extraEditions.find(item => item.index === 'Siddur Tehillat Hashem');
  assert.equal(extra.license, LICENSE);
  assert.equal(extra.sourceUrl, tehillat.source.url);
  assert.match(extra.attribution, /Open Siddur Project/);
  assert.match(extra.attribution, /Shmuel Gonzales/);
  assert.match(extra.attribution, /CC0/);
  assert.match(extra.attribution, /CC BY/);
  assert.ok(NUSACH_INDEX.chabad.extras.some(item => item.index === tehillat.source.index));
  // The Chanukah file of the post is recorded as missing, with where it can be had.
  assert.equal(tehillat.source.missing.length, 1);
  assert.match(tehillat.source.missing[0].file, /anukkah-Blessings/);
  assert.match(tehillat.source.missing[0].archivedAt, /^https:\/\/web\.archive\.org\/web\/20150507155325id_\//);
});

test('Siddur Torah Or: 47 leaves, all Sefaria\'s "Wikisource" version, CC BY-SA as vouched by the manifest', () => {
  const entry = SIDDUR_SOURCES.chabad;
  assert.equal(torahOr.source.index, entry.index);
  assert.deepEqual(torahOr.source.excludedLeaves, []);
  const leaves = [];
  const walk = (node, path) => (node.nodes ? node.nodes.forEach(child => walk(child, [...path, child.title])) : leaves.push([entry.index, ...path].join(', ')));
  torahOr.schema.nodes.forEach(node => walk(node, [node.title]));
  assert.equal(leaves.length, 47);
  assert.deepEqual(leaves.filter(ref => !torahOr.texts[ref]?.he?.some(p => p.trim())), []);
  for (const text of Object.values(torahOr.texts)) {
    assert.equal(text.heVersionTitle, 'Wikisource', text.ref);
    assert.equal(text.heLicense, 'CC-BY-SA', text.ref);
    assert.ok(licenseAllowed(entry, text.heVersionTitle, 'unknown').ok, text.ref);
  }
  assert.equal(entry.license, 'CC-BY-SA');
  assert.match(entry.attribution, /CC BY-SA/);
  assert.match(entry.provenanceUrl, /he\.wikisource\.org\/wiki\/סידור_תורה_אור/);
  // Torah Or's own Chanukah leaf holds the candle-lighting blessings (the Tehillat Hashem Chanukah file is not imported).
  assert.ok(torahOr.texts['Weekday Siddur Chabad, Chanukah'].he.some(p => hebrewWords(p).join(' ').includes('להדליק נר חנוכה')));
});

const pack = await loadSiddur('chabad');
const INDEXES = { 'Weekday Siddur Chabad': SIDDUR_SOURCES.chabad, 'Siddur Tehillat Hashem': SIDDUR_SOURCES.chabad.extraEditions[0] };

test('every section of every Chabad service points at a leaf of one of its two editions, and resolves', () => {
  for (const [serviceId, service] of Object.entries(chabad.services)) {
    for (const section of resolveService(service, pack.texts)) {
      const index = section.ref.split(', ')[0];
      assert.ok(INDEXES[index], `${serviceId}/${section.id}: ${section.ref}`);
      assert.equal(section.error, undefined, `${serviceId}/${section.id}: ${section.error}`);
      assert.ok(pack.texts[section.ref], `${serviceId}/${section.id}: ${section.ref}`);
    }
  }
});

// The reader (components/RiteServiceReader.jsx) credits each edition the composed page uses.
const credits = doc => {
  const all = Object.values(SIDDUR_SOURCES).flatMap(item => [item, ...(item.extraEditions || [])]);
  return [...new Set(doc.sections.map(section => section.ref?.split(', ')[0]).filter(Boolean))].map(index => all.find(item => item.index === index)?.attribution).filter(Boolean);
};
const context = (date, prayer) => {
  const hour = prayer === 'maariv' ? '21:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: 'israel' };
  return { ...JewishContextEngine({ now: new Date(`${date}T${hour}:00+03:00`), settings, times: { sunset: new Date(`${date}T18:00:00+03:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
};

test('the reader\'s source line names exactly the edition(s) of each service, with its licence', () => {
  const TO = SIDDUR_SOURCES.chabad.attribution;
  const TH = SIDDUR_SOURCES.chabad.extraEditions[0].attribution;
  const torahOrServices = ['weekday-shacharit', 'weekday-mincha', 'weekday-maariv', 'bedtime-shema', 'birkat-hamazon', 'hallel', 'rosh-chodesh-musaf', 'omer'];
  const prayerOf = { 'weekday-mincha': 'mincha', 'shabbat-mincha': 'mincha', 'weekday-maariv': 'maariv', 'shabbat-maariv': 'maariv', 'kabbalat-shabbat': 'maariv', omer: 'maariv', 'shabbat-musaf': 'mussaf', 'festival-musaf': 'mussaf', 'rosh-chodesh-musaf': 'mussaf' };
  for (const serviceId of Object.keys(chabad.services)) {
    const expected = torahOrServices.includes(serviceId) ? [TO] : [TH];
    for (const [date, mode] of [['2026-11-02', 'edition'], ['2026-10-17', 'prayer'], ['2026-11-11', 'prayer'], ['2026-10-03', 'prayer']]) {
      const doc = composeRiteService({ composition: chabad, serviceId, texts: pack.texts, context: context(date, prayerOf[serviceId] || 'shacharit'), mode });
      assert.deepEqual(credits(doc), expected, `${serviceId} ${date} ${mode}`);
    }
  }
  assert.match(TO, /CC BY-SA 3\.0/);
  assert.match(TH, /CC0/);
});
