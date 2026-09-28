// accepted.json (already mechanically verified) → src/data/tradition/research.mjs in the app's record shape.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const OUT = '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/tradition/research.mjs';
const ROUND2 = process.env.ROUND === '2';
const accepted = JSON.parse(readFileSync(`${DIR}${ROUND2 ? 'accepted2' : 'accepted'}.json`, 'utf8'));
const communities = JSON.parse(readFileSync(`${DIR}${ROUND2 ? 'accepted2' : 'accepted'}-communities.json`, 'utf8'));
const wikiSources = (ROUND2 ? ['out-wiki2-cal-sources.json', 'out-wiki2-life-sources.json'] : ['out-wiki-sources.json']).flatMap(f => existsSync(`${DIR}${f}`) ? JSON.parse(readFileSync(`${DIR}${f}`, 'utf8')) : []);
// Round 2 adds to what is already in the app; round 1 wrote the file from scratch.
const previous = ROUND2 ? await import(OUT + '?v=' + Date.now()) : { RESEARCH_SOURCES: [], RESEARCH_COMMUNITIES: [], RESEARCH_RECORDS: [] };

const usedWiki = new Set([...accepted.map(r => r.sourceKey), ...communities.map(c => c.sourceId)].filter(id => /^wiki2?-/.test(String(id))));
const sources = [...new Map(wikiSources.map(s => [s.id, s])).values()].filter(s => usedWiki.has(s.id)).map(s => ({
  id: s.id,
  title: s.title.startsWith('ויקיפדיה') ? s.title : `ויקיפדיה: ${s.title}`,
  author: 'כותבי ויקיפדיה העברית',
  publisher: 'ויקיפדיה',
  sourceType: 'website',
  url: s.url,
  reference: `גרסה ${s.revisionId}`,
  license: 'CC_BY_SA',
  commercialReuseAllowed: true,
  attributionRequired: true,
  retrievedAt: s.retrievedAt || '2026-09-28',
  notes: 'מקור משני. הטקסט ברישיון CC BY-SA 4.0 — ציטוט עם ייחוס; נבדק מול גרסת הערך בוויקיפדיה עצמה.',
}));
const researchCommunities = communities.map(c => ({ id: c.id, nameHe: c.nameHe, nameEn: c.nameEn, type: c.type, ...(c.parentId ? { parentId: c.parentId } : {}), aliases: c.aliases || [], sourceIds: [c.sourceId] }));

const records = accepted.map(r => {
  const wiki = /^wiki2?-/.test(String(r.sourceKey));
  return {
    id: r.id,
    ...(r.topic ? { topic: r.topic } : {}),
    title: r.title,
    shortSummary: r.shortSummary,
    body: r.body,
    traditionType: r.traditionType,
    normativeType: r.normativeType,
    practicalHalacha: Boolean(r.practicalHalacha),
    communityIds: r.communityIds,
    ...(r.calendarTriggers?.length ? { calendarTriggers: r.calendarTriggers } : {}),
    ...(r.lifecycleTriggers?.length ? { lifecycleTriggers: r.lifecycleTriggers } : {}),
    tags: r.tags || [],
    citations: [{ sourceId: r.sourceKey, reference: wiki ? (sources.find(s => s.id === r.sourceKey)?.title || r.reference) : r.reference, excerpt: r.excerpt }],
    verificationStatus: wiki ? 'secondary_source' : r.verificationStatus,
    israelContinuity: r.israelContinuity || 'unknown',
    ...(r.historicalPeriod?.from ? { historicalPeriod: { from: r.historicalPeriod.from } } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    rightsStatus: wiki ? 'open_license' : 'public_domain',
    status: 'published',
  };
});

writeFileSync(OUT, `// Research import for "המסורת שלי". Every record below passed mechanical verification before import:
// its excerpt appears verbatim in the source (the Rema's gloss after "הגה:" at the cited siman and se'if; the Ben Ish
// Hai paragraph that names the community; or the live Wikipedia revision cited), its community exists, its fields and
// triggers are valid, and it duplicates no other record. Primary sources are public domain; Wikipedia is CC BY-SA 4.0.
export const RESEARCH_SOURCES = ${JSON.stringify([...previous.RESEARCH_SOURCES, ...sources], null, 1)};

export const RESEARCH_COMMUNITIES = ${JSON.stringify([...previous.RESEARCH_COMMUNITIES, ...researchCommunities], null, 1)};

export const RESEARCH_RECORDS = ${JSON.stringify([...previous.RESEARCH_RECORDS, ...records], null, 1)};
`);
console.log('added records', records.length, 'sources', sources.length, 'communities', researchCommunities.length, '| total records', previous.RESEARCH_RECORDS.length + records.length);
