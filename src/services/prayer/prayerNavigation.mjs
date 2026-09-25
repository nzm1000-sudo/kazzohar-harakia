// Smart prayer navigation — table of contents generator for all composed prayers
// Reusable for Mincha, Maariv, Shacharit, and any PrayerDocument

/**
 * Generates a navigation structure from a PrayerDocument.
 * Only includes sections that have content (blocks) in the document.
 * 
 * @param {Object} document - PrayerDocument from composer
 * @returns {Array} Navigation items with section metadata
 */
export function generatePrayerNavigation(document) {
  if (!document || !document.sections) return [];
  
  return document.sections
    .filter(section => section.blocks && section.blocks.length > 0)
    .map(section => ({
      id: section.id,
      title: section.title || section.ref,
      ref: section.ref,
      blockCount: section.blocks.length,
      blockIds: section.blocks.map(block => block.id),
    }));
}

/**
 * Determines the current section based on currently visible blocks during prayer.
 * 
 * @param {Array} navigationItems - From generatePrayerNavigation()
 * @param {string|Array} currentBlockId - Currently displayed block ID(s)
 * @returns {Object|null} Current navigation item or null if not found
 */
export function getCurrentNavigationItem(navigationItems, currentBlockId) {
  if (!currentBlockId || !navigationItems) return null;
  
  const blockIds = Array.isArray(currentBlockId) ? currentBlockId : [currentBlockId];
  const currentId = blockIds[0];
  
  for (const item of navigationItems) {
    if (item.blockIds.includes(currentId)) {
      return { ...item, currentBlockId };
    }
  }
  return null;
}

/**
 * Finds the stable anchor/reference for a navigation item.
 * Used for scrolling or section-by-section navigation.
 * 
 * @param {Object} navItem - Navigation item from generatePrayerNavigation()
 * @returns {string} Section ID for anchor
 */
export function getNavigationAnchor(navItem) {
  return navItem?.id || null;
}

/**
 * Validates navigation integrity against the session.
 * Ensures all referenced blocks exist and are in correct order.
 * 
 * @param {Array} navigationItems - Generated navigation
 * @param {Array} sessionBlockIds - Frozen blockIds from PrayerSession
 * @returns {Object} Validation result
 */
export function validateNavigationIntegrity(navigationItems, sessionBlockIds) {
  const errors = [];
  
  // Collect all block IDs from navigation
  const navBlockIds = navigationItems.flatMap(item => item.blockIds);
  
  // Check that all nav blocks exist in session
  navBlockIds.forEach(blockId => {
    if (!sessionBlockIds.includes(blockId)) {
      errors.push(`navigation-block-missing:${blockId}`);
    }
  });
  
  // Check that nav preserves session block order
  let lastIndex = -1;
  navBlockIds.forEach(blockId => {
    const index = sessionBlockIds.indexOf(blockId);
    if (index !== -1 && index <= lastIndex) {
      errors.push(`navigation-order-invalid:${blockId}`);
    }
    if (index !== -1) lastIndex = index;
  });
  
  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Generates hierarchical navigation for complex prayers.
 * Groups optional subsections where applicable.
 * 
 * Example:
 * - קריאת שמע (main)
 *   - ברכה ראשונה (included, required)
 *   - קריאת שמע יומי (included, required)
 *   - ברכה שנייה (included, required)
 * - עמידה (main)
 * 
 * For Smart Maariv Stage 2:
 * Primary sections are returned. Subsections only when needed for complex compositions.
 * 
 * @param {Object} document - PrayerDocument
 * @returns {Array} Hierarchical navigation items
 */
export function generateHierarchicalNavigation(document) {
  if (!document || !document.sections) return [];
  
  const navigation = generatePrayerNavigation(document);
  
  // For Stage 2, return flat structure. Hierarchy added only if multiple compositions occur.
  return navigation.map(item => ({
    ...item,
    level: 0,
    children: [],
  }));
}

/**
 * Computes the next/previous navigation item for sequential navigation.
 * Separate from the new direct-jump TOC.
 * 
 * @param {Array} navigationItems - Generated navigation
 * @param {Object} currentItem - Current navigation item
 * @param {string} direction - 'next' or 'previous'
 * @returns {Object|null} Next/previous item or null if at boundary
 */
export function getSequentialNavigationItem(navigationItems, currentItem, direction = 'next') {
  if (!navigationItems || !currentItem) return null;
  
  const index = navigationItems.findIndex(item => item.id === currentItem.id);
  if (index === -1) return null;
  
  if (direction === 'next' && index < navigationItems.length - 1) {
    return navigationItems[index + 1];
  }
  if (direction === 'previous' && index > 0) {
    return navigationItems[index - 1];
  }
  
  return null;
}

/**
 * Stable navigation state tied to a PrayerSession.
 * Frozen together with the session to prevent mutation during prayer.
 * 
 * @param {Object} prayerSession - From createPrayerSession()
 * @param {Object} prayerDocument - Current document for session
 * @returns {Object} Navigation state
 */
export function createNavigationState(prayerSession, prayerDocument) {
  const navigationItems = generatePrayerNavigation(prayerDocument);
  const integrity = validateNavigationIntegrity(navigationItems, prayerSession.blockIds);
  
  return {
    sessionId: prayerSession.id,
    items: navigationItems,
    createdAt: new Date().toISOString(),
    integrity: integrity.ok,
    integrityErrors: integrity.errors,
  };
}
