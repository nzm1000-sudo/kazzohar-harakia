import test from 'node:test';
import * as assert from 'node:assert/strict';
import {
  generatePrayerNavigation,
  getCurrentNavigationItem,
  getNavigationAnchor,
  validateNavigationIntegrity,
  createNavigationState,
} from '../src/services/prayer/prayerNavigation.mjs';
import { composeWeekdayMincha } from '../src/services/prayer/weekdayMinchaComposer.mjs';
import { createPrayerSession, documentForSession } from '../src/services/prayer/prayerSession.mjs';
import { sessionInputs } from '../src/services/prayer/prayerSession.mjs';

// Test 1: Navigation generation from PrayerDocument
test('Smart Prayer Navigation: generate from document with included sections', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  
  assert.ok(Array.isArray(nav));
  assert.ok(nav.length > 0);
  assert.ok(nav.every(item => item.id && item.title && Array.isArray(item.blockIds)));
  assert.ok(nav.every(item => item.blockIds.length > 0));
});

// Test 2: Navigation excludes sections with no blocks
test('Smart Prayer Navigation: omit sections without included blocks', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  const allSectionIds = new Set(nav.map(item => item.id));
  
  // Verify that empty sections are not in navigation
  composed.document.sections.forEach(section => {
    if (section.blocks.length === 0) {
      assert.ok(!allSectionIds.has(section.id));
    } else {
      assert.ok(allSectionIds.has(section.id));
    }
  });
});

// Test 3: Current section highlighting
test('Smart Prayer Navigation: identify current section by block ID', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  
  // Get first block ID from first section
  const firstBlockId = nav[0]?.blockIds[0];
  assert.ok(firstBlockId);
  
  const current = getCurrentNavigationItem(nav, firstBlockId);
  assert.ok(current);
  assert.equal(current.id, nav[0].id);
  assert.equal(current.currentBlockId, firstBlockId);
});

// Test 4: Anchor generation for section navigation
test('Smart Prayer Navigation: generate anchors for direct section jumps', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  
  nav.forEach(item => {
    const anchor = getNavigationAnchor(item);
    assert.equal(anchor, item.id);
  });
});

// Test 5: Navigation integrity validation
test('Smart Prayer Navigation: validate integrity against session blocks', async (t) => {
  const inputs = sessionInputs({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });
  
  const session = createPrayerSession(inputs);
  const composed = documentForSession(session);
  const nav = generatePrayerNavigation(composed);
  
  const integrity = validateNavigationIntegrity(nav, session.blockIds);
  assert.ok(integrity.ok);
  assert.equal(integrity.errors.length, 0);
});

// Test 6: Navigation state creation with session stability
test('Smart Prayer Navigation: create stable navigation state from session', async (t) => {
  const inputs = sessionInputs({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });
  
  const session = createPrayerSession(inputs);
  const composed = documentForSession(session);
  
  const navState = createNavigationState(session, composed);
  
  assert.equal(navState.sessionId, session.id);
  assert.ok(Array.isArray(navState.items));
  assert.ok(navState.integrity === true);
  assert.equal(navState.integrityErrors.length, 0);
});

// Test 7: Navigation handles multiple blocks in section
test('Smart Prayer Navigation: section with multiple blocks includes all', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  
  // Find a section with multiple blocks
  const multiBlockSection = nav.find(item => item.blockCount > 1);
  if (multiBlockSection) {
    assert.ok(multiBlockSection.blockIds.length > 1);
  }
});

// Test 8: Navigation preserves section order
test('Smart Prayer Navigation: preserves section order from document', async (t) => {
  const composed = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const nav = generatePrayerNavigation(composed.document);
  const sectionIds = nav.map(item => item.id);
  
  // Verify that sections appear in same order as document
  let lastDocIndex = -1;
  composed.document.sections.forEach(docSection => {
    const navIndex = sectionIds.indexOf(docSection.id);
    if (navIndex !== -1) {
      assert.ok(navIndex > lastDocIndex);
      lastDocIndex = navIndex;
    }
  });
});

// Test 9: Empty document returns empty navigation
test('Smart Prayer Navigation: handle empty or null documents', async (t) => {
  const nav1 = generatePrayerNavigation(null);
  assert.deepEqual(nav1, []);
  
  const nav2 = generatePrayerNavigation({});
  assert.deepEqual(nav2, []);
  
  const nav3 = generatePrayerNavigation({ sections: [] });
  assert.deepEqual(nav3, []);
});

// Test 10: Navigation reusable across different prayers
test('Smart Prayer Navigation: reusable for any prayer with sections and blocks', async (t) => {
  // Test with Mincha (the existing prayer)
  const mincha = composeWeekdayMincha({
    now: new Date('2025-01-15T14:00:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
    preferences: { setting: 'minyan' },
  });

  const minchaNav = generatePrayerNavigation(mincha.document);
  assert.ok(Array.isArray(minchaNav));
  assert.ok(minchaNav.length > 0);
  
  // Verify the service works with any document shape
  const genericDoc = {
    id: 'generic-prayer',
    sections: [
      {
        id: 'section-1',
        title: 'Section One',
        blocks: [{ id: 'block-1' }],
      },
      {
        id: 'section-2',
        title: 'Section Two',
        blocks: [{ id: 'block-2-a' }, { id: 'block-2-b' }],
      },
      {
        id: 'section-3-empty',
        title: 'Section Three (Empty)',
        blocks: [],
      },
    ],
  };
  
  const genericNav = generatePrayerNavigation(genericDoc);
  assert.equal(genericNav.length, 2);
  assert.equal(genericNav[0].id, 'section-1');
  assert.equal(genericNav[1].id, 'section-2');
});
