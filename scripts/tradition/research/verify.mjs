// Mechanical verification of drafted tradition records. Nothing enters the app unless it passes.
// Usage: node verify.mjs  (reads out-*.json next to this file; writes accepted.json and rejected.json)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hebrewNumeral } from '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/services/hebrewNumerals.mjs';
import { COMMUNITIES } from '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/tradition/communities.mjs';
import { TRADITION_RECORDS } from '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/tradition/records.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const REPO = '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/';
const norm = s => String(s || '').replace(/<[^>]+>/g, '').replace(/[֑-ׇ]/g, '').replace(/[״“”„]/g, '"').replace(/[׳‘’`]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const TYPES = new Set('halacha halachic_custom prayer_custom prayer_text_variant piyut melody torah_reading pronunciation holiday_custom shabbat_custom food_custom life_cycle wedding birth brit_milah bar_mitzvah mourning synagogue clothing language judeo_language folk_custom community_history family_custom oral_tradition'.split(' '));
const NORMS = new Set('law halachic_custom community_custom liturgical_custom cultural_tradition oral_tradition'.split(' '));
const LIFE = new Set('birth brit_milah zeved_habat education bar_mitzvah engagement wedding new_home mourning yahrzeit'.split(' '));
const VERIF = new Set(['primary_verified', 'single_reliable_source', 'multi_source_verified', 'oral_documented']);

// Sources
const remaUnits = JSON.parse(readFileSync(`${DIR}rema.json`, 'utf8'));
const bihParas = JSON.parse(readFileSync(`${DIR}bih.json`, 'utf8'));
const wikiSources = existsSync(`${DIR}out-wiki-sources.json`) ? JSON.parse(readFileSync(`${DIR}out-wiki-sources.json`, 'utf8')) : [];
const wikiCommunities = existsSync(`${DIR}out-wiki-communities.json`) ? JSON.parse(readFileSync(`${DIR}out-wiki-communities.json`, 'utf8')) : [];
const wikiLive = {};
// Each article is fetched again from Wikipedia at the exact cited revision (parse&oldid), stripped of markup.
const decode = h => h.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<sup[^>]*class="reference"[\s\S]*?<\/sup>/g, '').replace(/<\/?(p|div|li|ul|ol|br|h[1-6]|tr|td|th|table|dd|dt|dl|blockquote)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'");
import { mkdirSync } from 'node:fs';
mkdirSync(`${DIR}live`, { recursive: true });
for (const source of wikiSources) {
  const cache = `${DIR}live/${source.revisionId}.html`;
  let text = existsSync(cache) ? readFileSync(cache, 'utf8') : '';
  for (let attempt = 0; attempt < 4 && !text; attempt++) {
    try {
      const j = await (await fetch(`https://he.wikipedia.org/w/api.php?action=parse&oldid=${source.revisionId}&prop=text&formatversion=2&format=json`, { headers: { 'User-Agent': 'kazzohar-harakia-verifier/1.0 (tradition corpus check)' } })).json();
      if (j.parse?.text && j.parse.revid === source.revisionId) { text = j.parse.text; writeFileSync(cache, text); }
    } catch { /* retry */ }
    if (!text) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  text = text ? decode(text) : '';
  wikiLive[source.id] = norm(text);
  if (!existsSync(cache)) await new Promise(r => setTimeout(r, 1200));
}
console.log('wikipedia revisions fetched', Object.values(wikiLive).filter(Boolean).length, 'of', wikiSources.length);

const communityIds = new Set(COMMUNITIES.map(c => c.id));
const acceptedCommunities = [];
for (const c of wikiCommunities) {
  const text = wikiLive[c.sourceId];
  if (text && norm(c.evidence).length >= 10 && text.includes(norm(c.evidence)) && !communityIds.has(c.id) && (!c.parentId || communityIds.has(c.parentId) || wikiCommunities.some(o => o.id === c.parentId))) { acceptedCommunities.push(c); communityIds.add(c.id); }
}

const existingExcerpts = TRADITION_RECORDS.flatMap(r => (r.citations || []).map(c => norm(c.excerpt)));
const seen = [];
const accepted = [];
const rejected = [];
const reject = (record, why) => rejected.push({ id: record.id, file: record._file, why, title: record.title });

const validTrigger = t => t && (t.weekday !== undefined ? Number.isInteger(t.weekday) && t.weekday >= 0 && t.weekday <= 6
  : t.dayFrom !== undefined ? Number.isInteger(t.dayFrom) && Number.isInteger(t.dayTo) && t.dayFrom >= 1 && t.dayTo <= 30 && t.dayFrom <= t.dayTo
  : (t.month === 'adar' || (Number.isInteger(t.month) && t.month >= 1 && t.month <= 13)) && Number.isInteger(t.from) && Number.isInteger(t.to) && t.from >= 1 && t.to <= 30 && t.from <= t.to);

const files = ['out-rema-oc-1.json', 'out-rema-oc-2.json', 'out-rema-yd.json', 'out-rema-eh.json', 'out-bih-1.json', 'out-bih-2.json', 'out-wiki.json'].filter(f => existsSync(`${DIR}${f}`));
for (const file of files) {
  let list = [];
  try { list = JSON.parse(readFileSync(`${DIR}${file}`, 'utf8')); } catch (e) { console.log(`${file}: invalid JSON (${e.message})`); continue; }
  for (const raw of list) {
    const record = { ...raw, _file: file };
    const excerpt = norm(record.excerpt);
    if (!record.id || !record.title || !record.shortSummary || !record.body) { reject(record, 'missing text fields'); continue; }
    if (String(record.title).length > 70) { reject(record, 'title too long'); continue; }
    if (!TYPES.has(record.traditionType) || !NORMS.has(record.normativeType)) { reject(record, 'bad type'); continue; }
    if (record.normativeType === 'law') { reject(record, 'law is not a custom'); continue; }
    if (!VERIF.has(record.verificationStatus)) { reject(record, 'bad verification'); continue; }
    if (!Array.isArray(record.communityIds) || !record.communityIds.length || record.communityIds.some(id => !communityIds.has(id))) { reject(record, `unknown community ${record.communityIds}`); continue; }
    if ((record.calendarTriggers || []).some(t => !validTrigger(t))) { reject(record, 'bad trigger'); continue; }
    if ((record.lifecycleTriggers || []).some(t => !LIFE.has(t))) { reject(record, 'bad lifecycle'); continue; }
    if (excerpt.length < 15 || excerpt.includes('...') || excerpt.includes('…')) { reject(record, 'excerpt too short or elided'); continue; }

    let sourceId;
    if (file.startsWith('out-rema')) {
      sourceId = 'shulchan-arukh-oc';
      const part = file.includes('-yd') ? 'יורה דעה' : file.includes('-eh') ? 'אבן העזר' : 'אורח חיים';
      const unit = remaUnits.find(u => u.part === part && norm(u.text.slice(u.text.lastIndexOf('הגה:'))).includes(excerpt));
      if (!unit) { reject(record, 'excerpt not after the last הגה (may be the Mechaber)'); continue; }
      const expected = `${hebrewNumeral(unit.siman)}, ${hebrewNumeral(unit.seif)}`.replace(/[׳״'"]/g, '');
      if (!norm(record.reference).replace(/[׳״'"]/g, '').includes(expected)) { reject(record, `reference ≠ ${part} ${expected}`); continue; }
      record.reference = `שולחן ערוך, ${part} ${hebrewNumeral(unit.siman)}, ${hebrewNumeral(unit.seif)} (הגה)`;
      record.sourceKey = part === 'אורח חיים' ? 'shulchan-arukh-oc' : part === 'יורה דעה' ? 'shulchan-arukh-yd' : 'shulchan-arukh-eh';
      if (record.communityIds.join() !== 'ashkenaz') { reject(record, 'Rema records are Ashkenaz'); continue; }
    } else if (file.startsWith('out-bih')) {
      sourceId = 'ben-ish-hai';
      const para = bihParas.find(p => norm(p.text).includes(excerpt));
      if (!para) { reject(record, 'excerpt not in the Ben Ish Hai'); continue; }
      const t = norm(para.text);
      const need = { 'iraq-baghdad': /בגדאד|עירנו|עירינו|עיר בגדאד|עינינו/, 'jerusalem-sephardi': /ירושל|ערי הקודש|עיה"ק|עיר הקודש/, 'jerusalem-beit-el': /בית אל/ };
      if (record.communityIds.some(id => need[id] && !need[id].test(t))) { reject(record, 'community not named in the paragraph'); continue; }
      record.sourceKey = 'ben-ish-hai';
      record._para = para.ref;
    } else {
      sourceId = record.sourceId;
      const text = wikiLive[sourceId];
      if (!text) { reject(record, `wiki source not verifiable: ${sourceId}`); continue; }
      if (!text.includes(excerpt)) { reject(record, 'excerpt not in the live Wikipedia article'); continue; }
      record.sourceKey = sourceId;
      if (record.practicalHalacha) record.practicalHalacha = false;
    }
    if (existingExcerpts.some(e => e && (e.includes(excerpt) || excerpt.includes(e)))) { reject(record, 'duplicate of an existing record'); continue; }
    if (seen.some(e => e.includes(excerpt) || excerpt.includes(e))) { reject(record, 'duplicate excerpt'); continue; }
    seen.push(excerpt);
    accepted.push(record);
  }
}
const ids = new Set();
for (const record of accepted) { let id = record.id; let n = 2; while (ids.has(id)) id = `${record.id}-${n++}`; record.id = id; ids.add(id); }
writeFileSync(`${DIR}accepted.json`, JSON.stringify(accepted, null, 1));
writeFileSync(`${DIR}accepted-communities.json`, JSON.stringify(acceptedCommunities, null, 1));
writeFileSync(`${DIR}rejected.json`, JSON.stringify(rejected, null, 1));
const byFile = {};
for (const r of accepted) byFile[r._file] = (byFile[r._file] || 0) + 1;
const rejByWhy = {};
for (const r of rejected) rejByWhy[r.why.replace(/ ≠.*| \S+$/, '')] = (rejByWhy[r.why.replace(/ ≠.*| \S+$/, '')] || 0) + 1;
console.log('accepted', accepted.length, byFile); console.log('rejected', rejected.length, rejByWhy); console.log('new communities', acceptedCommunities.map(c => c.id));
