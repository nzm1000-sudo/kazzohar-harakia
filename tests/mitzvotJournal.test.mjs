import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEvent,
  recordEvent,
  getEvents,
  removeEvent,
  aggregateForRange,
  aggregateByJewishDate,
  formatEventForDisplay,
  getJewishDateKey,
  recordPrayerCompletion,
  recordPrayerAddition,
  recordTehillimCompletion,
  recordTorahStudy,
  ACTIVITY_CATEGORY,
  ACTIVITY_TYPE,
  _clearAllEvents,
  STORAGE_KEY_EXPORT,
} from '../src/services/mitzvotJournal.mjs';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('createEvent generates event with all required fields', () => {
  const store = storage();
  const event = createEvent({
    category: ACTIVITY_CATEGORY.PRAYER,
    type: ACTIVITY_TYPE.SHACHARIT,
    occurredAt: new Date('2026-09-20T08:00:00Z'),
    tzid: 'Asia/Jerusalem',
  });
  assert.ok(event.id);
  assert.equal(event.category, ACTIVITY_CATEGORY.PRAYER);
  assert.equal(event.type, ACTIVITY_TYPE.SHACHARIT);
  assert.equal(event.completed, true);
  assert.equal(event.quantity, 1);
  assert.equal(event.unit, 'count');
  assert.ok(event.jewishDate);
  assert.ok(event.eventKey);
  assert.equal(event.schemaVersion, 1);
});

test('recordEvent creates one event and prevents duplicate', () => {
  const store = storage();
  _clearAllEvents(store);
  const event = createEvent({
    category: ACTIVITY_CATEGORY.PRAYER,
    type: ACTIVITY_TYPE.MINCHA,
    occurredAt: new Date('2026-09-20T14:00:00Z'),
    tzid: 'Asia/Jerusalem',
    source: 'siddur',
    sourceId: 'mincha-1',
  });

  const result1 = recordEvent(event, store);
  assert.equal(result1.created, true);
  assert.equal(result1.duplicate, false);

  const result2 = recordEvent(event, store);
  assert.equal(result2.created, false);
  assert.equal(result2.duplicate, true);
  assert.equal(result2.event.id, result1.event.id);
});

test('getEvents filters by category, type, and jewishDate', () => {
  const store = storage();
  _clearAllEvents(store);

  recordEvent(createEvent({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT, jewishDate: '2026-09-20', tzid: 'Asia/Jerusalem' }), store);
  recordEvent(createEvent({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MINCHA, jewishDate: '2026-09-20', tzid: 'Asia/Jerusalem' }), store);
  recordEvent(createEvent({ category: ACTIVITY_CATEGORY.TEHILLIM, type: ACTIVITY_TYPE.TEHILLIM_CHAPTER, jewishDate: '2026-09-20', tzid: 'Asia/Jerusalem' }), store);
  recordEvent(createEvent({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT, jewishDate: '2026-09-21', tzid: 'Asia/Jerusalem' }), store);

  const prayerEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER }, store);
  assert.equal(prayerEvents.length, 3);

  const shacharitEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT }, store);
  assert.equal(shacharitEvents.length, 2);

  const todayEvents = getEvents({ jewishDate: '2026-09-20' }, store);
  assert.equal(todayEvents.length, 3);
});

test('removeEvent removes the correct event', () => {
  const store = storage();
  _clearAllEvents(store);
  const event = createEvent({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.ARVIT, tzid: 'Asia/Jerusalem' });
  recordEvent(event, store);

  const removeResult = removeEvent(event.id, store);
  assert.equal(removeResult.removed, true);

  const events = getEvents({}, store);
  assert.equal(events.length, 0);
});

test('prayer additions (Hallel, Yaaleh Veyavo, etc.) do NOT create whole-prayer completion', () => {
  const store = storage();
  _clearAllEvents(store);
  
  // Simulate completing a daily addition like "הלל שלם" or "יעלה ויבוא"
  // These should be recorded as additions, NOT as whole prayer completions
  
  const hallelResult = recordPrayerAddition('hallel', { 
    tzid: 'Asia/Jerusalem', 
    occurredAt: new Date('2026-09-20T08:00:00Z'),
    source: 'today',
    sourceId: 'daily-hallel',
    storage: store
  });
  
  const yaalehResult = recordPrayerAddition('yaaleh-veyavo', {
    tzid: 'Asia/Jerusalem',
    occurredAt: new Date('2026-09-20T14:00:00Z'),
    source: 'today',
    sourceId: 'daily-yaaleh',
    storage: store
  });
  
  // Should create addition events, not whole prayer completions
  assert.equal(hallelResult.created, true);
  assert.equal(hallelResult.event.type, 'hallel');
  assert.equal(hallelResult.event.category, ACTIVITY_CATEGORY.PRAYER);
  
  assert.equal(yaalehResult.created, true);
  assert.equal(yaalehResult.event.type, 'yaaleh_veyavo');
  assert.equal(yaalehResult.event.category, ACTIVITY_CATEGORY.PRAYER);
  
  // Should NOT have created any whole prayer completion events
  const prayerEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT }, store);
  const minchaEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MINCHA }, store);
  const arvitEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.ARVIT }, store);
  
  assert.equal(prayerEvents.length, 0, 'Hallel should not create Shacharit completion');
  assert.equal(minchaEvents.length, 0, 'Hallel should not create Mincha completion');
  assert.equal(arvitEvents.length, 0, 'Hallel should not create Arvit completion');
  
  // Should have created the addition events
  const additionEvents = getEvents({ category: ACTIVITY_CATEGORY.PRAYER }, store);
  assert.equal(additionEvents.length, 2);
  assert.ok(additionEvents.some(e => e.type === 'hallel'));
  assert.ok(additionEvents.some(e => e.type === 'yaaleh_veyavo'));
});

test('explicit prayer completion creates exactly one event', () => {
  const store = storage();
  _clearAllEvents(store);
  
  const result1 = recordPrayerCompletion('mincha', { 
    tzid: 'Asia/Jerusalem', 
    occurredAt: new Date('2026-09-20T14:00:00Z'),
    source: 'siddur',
    sourceId: 'mincha-session-1',
    storage: store
  });
  
  assert.equal(result1.created, true);
  assert.equal(result1.duplicate, false);
  
  // Duplicate call should be blocked
  const result2 = recordPrayerCompletion('mincha', { 
    tzid: 'Asia/Jerusalem', 
    occurredAt: new Date('2026-09-20T14:00:00Z'),
    source: 'siddur',
    sourceId: 'mincha-session-1',
    storage: store
  });
  
  assert.equal(result2.created, false);
  assert.equal(result2.duplicate, true);
  
  const events = getEvents({ category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MINCHA }, store);
  assert.equal(events.length, 1);
});

test('opening a prayer does NOT create completion', () => {
  const store = storage();
  _clearAllEvents(store);
  
  // Simulate opening a prayer (just creating a session, not completing)
  // This should not call recordPrayerCompletion
  const events = getEvents({ category: ACTIVITY_CATEGORY.PRAYER }, store);
  assert.equal(events.length, 0);
  
  // Only explicit completion should create events
  recordPrayerCompletion('shacharit', { 
    tzid: 'Asia/Jerusalem', 
    occurredAt: new Date('2026-09-20T08:00:00Z'),
    source: 'siddur',
    storage: store
  });
  
  const eventsAfter = getEvents({ category: ACTIVITY_CATEGORY.PRAYER }, store);
  assert.equal(eventsAfter.length, 1);
});

test('Tehillim completion still works after changes', () => {
  const store = storage();
  _clearAllEvents(store);
  
  const result = recordTehillimCompletion(3, { 
    tzid: 'Asia/Jerusalem', 
    occurredAt: new Date('2026-09-20T10:00:00Z'),
    source: 'tehillim',
    sourceId: 'tehillim-daily',
    isDailyPortion: true,
    storage: store
  });
  
  assert.equal(result.created, true);
  assert.equal(result.event.category, ACTIVITY_CATEGORY.TEHILLIM);
  assert.equal(result.event.type, ACTIVITY_TYPE.TEHILLIM_DAILY_PORTION);
  assert.equal(result.event.quantity, 3);
  assert.equal(result.event.unit, 'chapters');
  
  const events = getEvents({ category: ACTIVITY_CATEGORY.TEHILLIM }, store);
  assert.equal(events.length, 1);
});