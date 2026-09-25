import { useState, useCallback } from 'react';
import { generatePrayerNavigation, getCurrentNavigationItem, getNavigationAnchor } from '../services/prayer/prayerNavigation.mjs';
// CSS is included in main stylesheet; no direct import needed for test compatibility

/**
 * Smart Prayer Table of Contents
 * 
 * Reusable for Mincha, Maariv, Shacharit.
 * Shows only included sections from the composed PrayerDocument.
 * Allows direct jump to any section.
 * Maintains current-section highlighting.
 * Mobile-friendly, RTL-correct.
 */
export default function PrayerTableOfContents({ 
  prayerDocument, 
  currentBlockId, 
  onNavigate, 
  isOpen = false, 
  onToggle,
  style = {},
}) {
  if (!prayerDocument || !prayerDocument.sections) {
    return null;
  }

  const navigationItems = generatePrayerNavigation(prayerDocument);
  const currentItem = getCurrentNavigationItem(navigationItems, currentBlockId);
  
  const handleSectionTap = useCallback((navItem) => {
    if (onNavigate) {
      onNavigate({
        sectionId: navItem.id,
        anchor: getNavigationAnchor(navItem),
        firstBlockId: navItem.blockIds[0],
      });
    }
    // Close drawer after selection on mobile
    if (onToggle) {
      onToggle(false);
    }
  }, [onNavigate, onToggle]);

  return (
    <>
      {/* TOC Toggle Button — compact, always reachable */}
      <button 
        className="prayer-toc-toggle" 
        onClick={() => onToggle?.(!isOpen)}
        aria-label="תוכן עניינים"
        aria-pressed={isOpen}
      >
        <span className="toc-icon">☰</span>
        <span className="toc-label">תוכן</span>
      </button>

      {/* TOC Drawer/Sheet */}
      {isOpen && (
        <div className="prayer-toc-drawer" style={style}>
          <div className="prayer-toc-header">
            <h2>תוכן עניינים</h2>
            <button 
              className="prayer-toc-close" 
              onClick={() => onToggle?.(false)}
              aria-label="סגור"
            >
              ✕
            </button>
          </div>

          <nav className="prayer-toc-list" role="navigation">
            {navigationItems.map((item) => {
              const isCurrent = currentItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  className={`prayer-toc-item ${isCurrent ? 'current' : ''}`}
                  onClick={() => handleSectionTap(item)}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {isCurrent && <span className="toc-current-marker">→</span>}
                  <span className="toc-item-text">{item.title}</span>
                </button>
              );
            })}
          </nav>

          {navigationItems.length === 0 && (
            <p className="prayer-toc-empty">אין סעיפים להצגה</p>
          )}
        </div>
      )}

      {/* Drawer Overlay (for mobile) */}
      {isOpen && (
        <div 
          className="prayer-toc-overlay" 
          onClick={() => onToggle?.(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
