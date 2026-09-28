// "המסורת שלי": hierarchy, aliases, matching, calendar, the publication and copyright gates, conflicts, mixed
// families, private family customs, search, and offline data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLISHED_RECORDS, addFamilyCustom, allowsVerbatim, ancestorsOf, canPublish, communityLabel, compareTopics, hebrewDayOf,
  loadFamilyCustoms, matchLevel, publicationErrors, recordMatchesDay, recordsForProfile, resolveCommunities, searchTraditions,
  todaysRecords, traditionStats, variantsOf,
} from '../src/services/tradition.mjs';
import { TRADITION_RECORDS } from '../src/data/tradition/records.mjs';
import { TRADITION_SOURCES } from '../src/data/tradition/sources.mjs';
import { COMMUNITIES } from '../src/data/tradition/communities.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) }; };

test('community hierarchy: parents resolve, paths read top-down, and every parent exists', () => {
  assert.deepEqual(ancestorsOf('iraq-baghdad').map(c => c.id), ['iraq']);
  assert.equal(communityLabel('iraq-baghdad'), 'יהדות בבל (עיראק) · בגדאד');
  assert.equal(communityLabel('tunisia-djerba'), 'יהדות תוניסיה · ג׳רבה');
  for (const community of COMMUNITIES) if (community.parentId) assert.ok(COMMUNITIES.some(c => c.id === community.parentId), community.id);
  assert.equal(new Set(COMMUNITIES.map(c => c.id)).size, COMMUNITIES.length);
});

test('aliases: Babylon and Iraq, Persia and Iran reach the same tradition', () => {
  for (const name of ['בבל', 'עיראק', 'Babylonian', 'Baghdad Jewish']) assert.ok(resolveCommunities(name).some(c => c.id === 'iraq'), name);
  for (const name of ['פרס', 'איראן', 'Persia', 'Iran']) assert.ok(resolveCommunities(name).some(c => c.id === 'iran'), name);
  assert.ok(resolveCommunities('ג\'רבה').some(c => c.id === 'tunisia-djerba'));
});

test('matching: the exact city comes before the country and the family', () => {
  assert.equal(matchLevel('iraq-baghdad', 'iraq-baghdad'), 0);
  assert.equal(matchLevel('iraq', 'iraq-baghdad'), 1, 'a record for the whole family, for a user in the city');
  assert.equal(matchLevel('iraq-baghdad', 'iraq'), 10, 'a city record for a user who chose only the country — after the others');
  assert.equal(matchLevel('ashkenaz', 'iraq-baghdad'), null);
  const general = { id: 'x-general', communityIds: ['iraq'], title: 'כללי' };
  const city = { id: 'x-city', communityIds: ['iraq-baghdad'], title: 'עירוני' };
  assert.deepEqual(recordsForProfile({ roots: { central: 'iraq-baghdad' } }, [general, city]).map(m => m.record.id), ['x-city', 'x-general']);
});

test('calendar: a holiday custom appears on its days only', () => {
  const purim = PUBLISHED_RECORDS.find(r => r.id === 'baghdad-purim-15-megillah');
  assert.equal(recordMatchesDay(purim, hebrewDayOf('2027-03-23')), true, '14 Adar II 5787 (a leap year)');
  assert.equal(recordMatchesDay(purim, hebrewDayOf('2027-02-21')), false, '14 Adar I is not Purim');
  assert.equal(recordMatchesDay(purim, hebrewDayOf('2026-10-04')), false);
  const baghdad = { roots: { central: 'iraq-baghdad' } };
  assert.ok(todaysRecords(baghdad, '2027-03-23').some(m => m.record.id === 'baghdad-purim-15-megillah'));
  assert.ok(!todaysRecords(baghdad, '2026-11-11').some(m => m.record.id === 'baghdad-purim-15-megillah'));
  assert.deepEqual(todaysRecords({ roots: {} }, '2027-03-23'), [], 'no roots, nothing shown');
  assert.ok(todaysRecords(baghdad, '2026-11-11').every(m => (m.record.calendarTriggers || []).length > 0), 'undated customs never fill the day');
});

test('source requirement: a record without a source, community or verification cannot be published', () => {
  const base = PUBLISHED_RECORDS[0];
  assert.ok(publicationErrors({ ...base, citations: [] }).includes('אין מקור'));
  assert.ok(publicationErrors({ ...base, communityIds: ['nowhere'] }).includes('קהילה לא מזוהה'));
  assert.ok(publicationErrors({ ...base, verificationStatus: 'needs_review' }).includes('דרוש אימות'));
  assert.ok(publicationErrors({ ...base, citations: [{ sourceId: 'missing', reference: 'x' }] }).some(e => e.startsWith('מקור לא מוכר')));
  for (const record of TRADITION_RECORDS.filter(r => r.status === 'published')) assert.equal(canPublish(record), true, `${record.id}: ${publicationErrors(record).join('; ')}`);
  assert.ok(TRADITION_RECORDS.some(r => r.status === 'review') && !PUBLISHED_RECORDS.some(r => r.status === 'review'), 'the app reads published only');
});

test('an AI is never a source, and practical halacha needs a halachic source', () => {
  const sources = new Map([['ai', { id: 'ai', title: 'ChatGPT research', sourceType: 'website', license: 'unknown' }], ['site', { id: 'site', title: 'אתר', sourceType: 'website', license: 'CC_BY' }]]);
  const record = { ...PUBLISHED_RECORDS[0], citations: [{ sourceId: 'ai', reference: 'x' }] };
  assert.ok(publicationErrors(record, { sources }).some(e => e.includes('בינה מלאכותית')));
  assert.ok(publicationErrors({ ...record, practicalHalacha: true, citations: [{ sourceId: 'site', reference: 'x' }] }, { sources }).includes('הלכה למעשה דורשת מקור הלכתי'));
});

test('copyright gate: only public-domain and open sources may lend their words verbatim', () => {
  assert.equal(allowsVerbatim({ license: 'public_domain' }), true);
  assert.equal(allowsVerbatim({ license: 'CC_BY' }), true);
  for (const license of ['copyright', 'unknown', 'CC_BY_NC', undefined]) assert.equal(allowsVerbatim({ license }), false, String(license));
  const sources = new Map([['closed', { id: 'closed', title: 'ספר', sourceType: 'rabbinic_work', license: 'copyright' }]]);
  assert.ok(publicationErrors({ ...PUBLISHED_RECORDS[0], citations: [{ sourceId: 'closed', reference: 'עמ׳ 1', excerpt: 'פסקה שלמה' }] }, { sources }).some(e => e.startsWith('ציטוט מלא אסור')));
  // Every source that lends words verbatim is public domain or openly licensed (Wikipedia: CC BY-SA, with attribution).
  assert.ok(TRADITION_SOURCES.every(source => allowsVerbatim(source)), 'no quotation from a closed or unknown-licence source');
  assert.ok(TRADITION_SOURCES.filter(source => source.license === 'CC_BY_SA').every(source => source.attributionRequired && /^https:\/\/he\.wikipedia\.org\//.test(source.url) && /גרסה \d+/.test(source.reference)), 'Wikipedia sources carry attribution, link and the exact revision');
});

test('conflicts are kept side by side, never merged or ranked', () => {
  const kohanim = compareTopics().find(t => t.topic === 'birkat-kohanim-frequency');
  const ids = kohanim.records.map(r => r.id);
  assert.ok(ids.includes('ashkenaz-birkat-kohanim-yom-tov') && ids.includes('baghdad-birkat-kohanim-daily'), 'both communities, each with its own record');
  assert.deepEqual(variantsOf(PUBLISHED_RECORDS.find(r => r.id === 'baghdad-havdalah-standing')).map(r => r.id), ['jerusalem-havdalah-either']);
  assert.ok(compareTopics().every(t => new Set(t.records.flatMap(r => r.communityIds)).size > 1));
});

test('a mixed family: father and mother from different communities both count, the central one first', () => {
  const profile = { roots: { central: 'iraq-baghdad', mother: 'ashkenaz' } };
  const ids = recordsForProfile(profile).map(m => m.record.id);
  assert.ok(ids.includes('baghdad-birkat-kohanim-daily') && ids.includes('ashkenaz-birkat-kohanim-yom-tov'));
  const roles = recordsForProfile(profile).map(m => m.role);
  assert.ok(roles.indexOf('central') < roles.indexOf('mother'));
});

test('family customs are private, stored apart, and never enter the public records', () => {
  const store = memory();
  addFamilyCustom({ title: 'ליל פסח אצל סבא', practice: 'כך היה נוהג סבא יעקב' }, store);
  const [item] = loadFamilyCustoms(store);
  assert.equal(item.private, true);
  assert.deepEqual(item.media, [], 'ready for photos and recordings later, apart from the public data');
  assert.ok(!PUBLISHED_RECORDS.some(r => r.title === 'ליל פסח אצל סבא'));
  assert.equal(addFamilyCustom({ title: '' }, store).length, 1, 'a title and a practice are required');
});

test('search works in Hebrew, across nikud, and by alias', () => {
  assert.ok(searchTraditions('מגילה').some(r => r.id === 'baghdad-purim-15-megillah'));
  assert.ok(searchTraditions('בן איש חי').length >= 20, 'by book');
  const babylon = searchTraditions('בבל');
  const firstOther = babylon.findIndex(r => !r.communityIds.some(id => id.startsWith('iraq')));
  assert.ok(babylon.slice(0, firstOther < 0 ? babylon.length : firstOther).length >= 20, 'the community\'s own customs come first');
  assert.ok(firstOther < 0 || babylon.slice(firstOther).every(r => !r.communityIds.some(id => id.startsWith('iraq'))));
  assert.ok(searchTraditions('הבדלה').length >= 2);
  assert.deepEqual(searchTraditions('א'), []);
});

test('offline: the published data is bundled in the app — no network, no model', () => {
  const service = read('../src/services/tradition.mjs');
  assert.doesNotMatch(service, /fetch\(|https?:\/\/(?!www\.sefaria)/);
  assert.equal(traditionStats().published, PUBLISHED_RECORDS.length);
  assert.ok(PUBLISHED_RECORDS.length >= 25);
});

test('it lives in personal tools and feeds "מה חשוב היום" through the existing section', () => {
  const tools = read('../src/pages/PersonalTools.jsx');
  assert.match(tools, /const TraditionPage = lazy\(\(\) => import\('\.\/TraditionPage\.jsx'\)\);/, 'the archive loads only when opened');
  assert.match(tools, /<TraditionPage route=\{route\} todayKey=\{todayKey\} \/><\/Suspense>/);
  const today = read('../src/pages/TodayPage.jsx');
  assert.match(today, /traditionForToday\(context\?\.key\)/);
  assert.doesNotMatch(today, /from '\.\.\/services\/tradition\.mjs'/, 'Today never pulls the archive into the main bundle');
  assert.match(read('../src/services/traditionToday.mjs'), /if \(!key \|\| !hasTraditionProfile\(\)\) return null;\n  const tradition = await import\('\.\/tradition\.mjs'\);/);
  assert.match(today, /<span>מנהג במסורת שלך · /);
  assert.doesNotMatch(read('../src/pages/TraditionPage.jsx'), /streak|%|נקודות|בוצע/, 'no gamification');
});

test('the research corpus: hundreds of customs, each quoting its source, across many communities', () => {
  assert.ok(PUBLISHED_RECORDS.length >= 900);
  const communities = new Set(PUBLISHED_RECORDS.flatMap(record => record.communityIds));
  for (const id of ['iraq-baghdad', 'jerusalem-sephardi', 'ashkenaz', 'morocco', 'yemen', 'tunisia-djerba', 'libya', 'bukhara', 'kurdistan', 'italy', 'chabad', 'ethiopia']) assert.ok(communities.has(id), id);
  assert.ok(PUBLISHED_RECORDS.every(record => record.citations.every(citation => citation.excerpt && citation.reference)));
  assert.ok(PUBLISHED_RECORDS.filter(record => /^wiki2?-/.test(record.id)).every(record => record.verificationStatus === 'secondary_source' && !record.practicalHalacha), 'encyclopedia records are secondary and never practical halacha');
  assert.ok(!PUBLISHED_RECORDS.some(record => record.normativeType === 'law'), 'no custom presented as law');
});
