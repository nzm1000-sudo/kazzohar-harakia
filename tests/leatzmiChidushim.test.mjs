// לעצמי · חידושי התורה שלי — the local store, its migrations, privacy states, and "שליחה למאגר" (outbox + mailto).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIDUSHIM_KEY, STATUS, buildChidushIndex, createChidush, createFollowUp, deleteChidush, filterChidushim, followUpsOf, getChidush,
  hebrewDateLabel, loadChidushim, markSubmitted, searchChidushim, sortChidushim, toggleChidushFavorite, toggleChidushPinned, updateChidush,
} from '../src/services/leatzmi/chidushim.mjs';
import { OUTBOX_KEY, SUBMISSION_SUBJECT, attributionLine, createMailtoRepository, formatSubmission, readOutbox, MAX_MAIL_BODY } from '../src/services/leatzmi/sharedRepository.mjs';
import { CONTACT_EMAIL } from '../src/services/contact.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

const T0 = Date.parse('2026-10-01T09:00:00Z');

test('create, read, update and delete — all on the device, private by default', () => {
  const storage = memoryStorage();
  const item = createChidush({ title: 'אור ראשון', body: 'ויאמר אלהים יהי אור', category: 'torah', tags: 'אור, בריאה', sources: ['בראשית א, ג'] }, { storage, now: T0 });
  assert.equal(item.status, STATUS.PRIVATE);
  assert.deepEqual(item.tags, ['אור', 'בריאה']);
  assert.ok(item.hebrewDate.includes('תשרי'), item.hebrewDate);
  assert.equal(loadChidushim(storage).length, 1);
  const updated = updateChidush(item.id, { body: 'ויאמר אלהים יהי אור ויהי אור' }, { storage, now: T0 + 60_000 });
  assert.equal(updated.body, 'ויאמר אלהים יהי אור ויהי אור');
  assert.equal(updated.createdAt, item.createdAt, 'creation date never changes');
  assert.notEqual(updated.updatedAt, item.updatedAt);
  assert.equal(updated.revisions.length, 1, 'the earlier text is kept as a revision');
  assert.equal(updated.revisions[0].body, 'ויאמר אלהים יהי אור');
  // Autosave within ten minutes does not add a revision per keystroke.
  updateChidush(item.id, { body: 'ויאמר אלהים יהי אור ויהי אור.' }, { storage, now: T0 + 120_000 });
  assert.equal(getChidush(item.id, storage).revisions.length, 1);
  updateChidush(item.id, { body: 'שוב' }, { storage, now: T0 + 30 * 60_000 });
  assert.equal(getChidush(item.id, storage).revisions.length, 2);
  // Ids and dates cannot be edited.
  updateChidush(item.id, { id: 'other', createdAt: '2000-01-01T00:00:00Z' }, { storage, now: T0 });
  assert.ok(getChidush(item.id, storage));
  assert.equal(getChidush(item.id, storage).createdAt, item.createdAt);
  assert.equal(deleteChidush(item.id, storage), true);
  assert.equal(loadChidushim(storage).length, 0);
  assert.equal(deleteChidush('missing', storage), false);
});

test('favourite and pin do not change the text or the last-edited date; pinned ones stay on top', () => {
  const storage = memoryStorage();
  const a = createChidush({ title: 'א', body: 'x' }, { storage, now: T0 });
  const b = createChidush({ title: 'ב', body: 'y' }, { storage, now: T0 + 1000 });
  toggleChidushFavorite(a.id, { storage, now: T0 + 5000 });
  toggleChidushPinned(a.id, { storage, now: T0 + 5000 });
  const after = getChidush(a.id, storage);
  assert.equal(after.favorite, true);
  assert.equal(after.pinned, true);
  assert.equal(after.updatedAt, a.updatedAt);
  assert.deepEqual(sortChidushim(loadChidushim(storage), 'updated').map(item => item.id), [a.id, b.id]);
  assert.deepEqual(filterChidushim(loadChidushim(storage), { favorite: true }).map(item => item.id), [a.id]);
});

test('migration: nothing stored, an old bare array, broken JSON — never thrown, never wiped', () => {
  assert.deepEqual(loadChidushim(memoryStorage()), []);
  const legacy = memoryStorage({ [CHIDUSHIM_KEY]: JSON.stringify([{ id: 'old-1', title: 'ישן', body: 'טקסט', createdAt: '2025-09-20T10:00:00Z', extra: 'kept' }]) });
  const [item] = loadChidushim(legacy);
  assert.equal(item.id, 'old-1');
  assert.equal(item.status, STATUS.PRIVATE);
  assert.equal(item.category, 'other');
  assert.equal(item.extra, 'kept', 'unknown fields survive');
  assert.deepEqual(item.revisions, []);
  // Writing through the store upgrades the shape and keeps the item.
  createChidush({ title: 'חדש' }, { storage: legacy, now: T0 });
  const raw = JSON.parse(legacy.getItem(CHIDUSHIM_KEY));
  assert.equal(raw.v, 1);
  assert.equal(raw.items.length, 2);
  const broken = memoryStorage({ [CHIDUSHIM_KEY]: '{not json' });
  assert.deepEqual(loadChidushim(broken), []);
  assert.equal(broken.getItem(CHIDUSHIM_KEY), '{not json', 'a failed read does not overwrite the stored text');
});

test('offline persistence: a fresh reader of the same storage sees the same chidushim', () => {
  const storage = memoryStorage();
  createChidush({ title: 'נשמר', body: 'גם בלי רשת' }, { storage, now: T0 });
  const copy = memoryStorage(storage.dump());
  assert.equal(loadChidushim(copy)[0].title, 'נשמר');
});

test('"מה אני חושב על זה היום?" makes a linked note and leaves the original exactly as it was', () => {
  const storage = memoryStorage();
  const original = createChidush({ title: 'מקור', body: 'גוף', parasha: 'נח', category: 'torah' }, { storage, now: T0 });
  const before = JSON.stringify(getChidush(original.id, storage));
  const note = createFollowUp(original.id, {}, { storage, now: T0 + 86_400_000 });
  assert.equal(note.followUpOf, original.id);
  assert.equal(note.parasha, 'נח');
  assert.equal(JSON.stringify(getChidush(original.id, storage)), before);
  assert.deepEqual(followUpsOf(original.id, loadChidushim(storage)).map(item => item.id), [note.id]);
  assert.equal(createFollowUp('missing', {}, { storage }), null);
});

test('search is folded (nikud, final letters) and built once as an index', () => {
  const storage = memoryStorage();
  createChidush({ title: 'בְּרֵאשִׁית בָּרָא', body: 'על השמים', tags: ['ארץ'] }, { storage, now: T0 });
  createChidush({ title: 'שמות', body: 'הסנה', topic: 'ברכות' }, { storage, now: T0 });
  const index = buildChidushIndex(loadChidushim(storage));
  assert.equal(searchChidushim(index, ''), null);
  assert.equal(searchChidushim(index, 'בראשית').size, 1);
  assert.equal(searchChidushim(index, 'שמים').size, 1, 'a final mem matches its regular form');
  assert.equal(searchChidushim(index, 'ברכות').size, 1);
  assert.equal(searchChidushim(index, 'ארץ הסנה').size, 0, 'all terms must match');
});

test('privacy states: private → ready; sending marks "נשלח למאגר" without touching the content', () => {
  const storage = memoryStorage();
  const item = createChidush({ title: 'לשיתוף', body: 'תוכן' }, { storage, now: T0 });
  updateChidush(item.id, { status: STATUS.READY }, { storage, now: T0 });
  assert.equal(getChidush(item.id, storage).status, STATUS.READY);
  const sent = markSubmitted(item.id, { storage, now: T0 + 1000 });
  assert.equal(sent.status, STATUS.SUBMITTED);
  assert.equal(sent.body, 'תוכן');
  assert.equal(sent.title, 'לשיתוף');
  assert.equal(sent.updatedAt, getChidush(item.id, storage).updatedAt);
});

test('שליחה למאגר: the outbox records first, then hands a mailto to the mail app; failures stay queued and can be retried', () => {
  const storage = memoryStorage();
  const item = createChidush({ title: 'חידוש', body: 'שורה ראשונה\nשורה שנייה', parasha: 'בראשית' }, { storage, now: T0 });
  const opened = [];
  const repo = createMailtoRepository({ storage, now: () => T0, open: href => opened.push(href) });
  const result = repo.submit(item, { nameChoice: 'first', name: 'משה כהן' });
  assert.equal(result.ok, true);
  assert.equal(opened.length, 1);
  assert.ok(opened[0].startsWith(`mailto:${CONTACT_EMAIL}?subject=`), 'only the app\'s public contact address');
  assert.ok(decodeURIComponent(opened[0]).includes(SUBMISSION_SUBJECT));
  assert.ok(decodeURIComponent(opened[0]).includes('נכתב על ידי: משה'));
  assert.ok(!decodeURIComponent(opened[0]).includes('כהן'), 'first name only');
  assert.equal(repo.status(item.id), 'handed-off');
  assert.equal(getChidush(item.id, storage).status, STATUS.SUBMITTED);
  assert.equal(getChidush(item.id, storage).body, 'שורה ראשונה\nשורה שנייה');

  const other = createChidush({ title: 'שני', body: 'ב' }, { storage, now: T0 });
  let fail = true;
  const flaky = createMailtoRepository({ storage, now: () => T0, open: () => { if (fail) throw new Error('no mail app'); } });
  const queued = flaky.submit(other, { nameChoice: 'anonymous' });
  assert.equal(queued.ok, false);
  assert.equal(flaky.status(other.id), 'queued');
  assert.equal(getChidush(other.id, storage).status, STATUS.PRIVATE, 'not marked before it was handed off');
  fail = false;
  assert.equal(flaky.retry(queued.entry.id).ok, true);
  assert.equal(getChidush(other.id, storage).status, STATUS.SUBMITTED);
  assert.equal(readOutbox(storage).length, 2);
  assert.ok(JSON.parse(storage.getItem(OUTBOX_KEY)).v === 1);
  assert.equal(repo.submit(createChidush({}, { storage }), {}).reason, 'empty');
});

test('the attribution is exactly the user\'s choice; long texts are cut for the mail link only', () => {
  assert.equal(attributionLine('anonymous', 'משה כהן'), 'נכתב על ידי: בעילום שם');
  assert.equal(attributionLine('full', 'משה כהן'), 'נכתב על ידי: משה כהן');
  assert.equal(attributionLine('first', 'משה כהן'), 'נכתב על ידי: משה');
  assert.equal(attributionLine('full', '  '), 'נכתב על ידי: בעילום שם');
  const long = { id: 'x', title: 'ארוך', body: 'א'.repeat(MAX_MAIL_BODY + 500), sources: [], tags: [], parasha: '', topic: '' };
  const formatted = formatSubmission(long, { nameChoice: 'anonymous' });
  assert.equal(formatted.truncated, true);
  assert.ok(formatted.body.length < formatted.full.length);
  assert.ok(formatted.full.includes('א'.repeat(MAX_MAIL_BODY + 500)));
});

test('the Hebrew date label', () => {
  assert.equal(hebrewDateLabel('2026-10-01T09:00:00Z'), 'כ׳ בתשרי תשפ״ז');
});
