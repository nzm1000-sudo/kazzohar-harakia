// accepted.json (already mechanically verified) → src/data/tradition/research.mjs in the app's record shape.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const OUT = '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/tradition/research.mjs';
const accepted = JSON.parse(readFileSync(`${DIR}accepted.json`, 'utf8'));
const communities = JSON.parse(readFileSync(`${DIR}accepted-communities.json`, 'utf8'));
const wikiSources = existsSync(`${DIR}out-wiki-sources.json`) ? JSON.parse(readFileSync(`${DIR}out-wiki-sources.json`, 'utf8')) : [];

const usedWiki = new Set([...accepted.map(r => r.sourceKey), ...communities.map(c => c.sourceId)].filter(id => String(id).startsWith('wiki-')));
const sources = wikiSources.filter(s => usedWiki.has(s.id)).map(s => ({
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
  const wiki = String(r.sourceKey).startsWith('wiki-');
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
export const RESEARCH_SOURCES = ${JSON.stringify(sources, null, 1)};

export const RESEARCH_COMMUNITIES = ${JSON.stringify(researchCommunities, null, 1)};

export const RESEARCH_RECORDS = ${JSON.stringify(records, null, 1)};
`);
console.log('records', records.length, 'sources', sources.length, 'communities', researchCommunities.length);
