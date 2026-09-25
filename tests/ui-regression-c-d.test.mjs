import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

// REGRESSION TEST: Task C - Remove פרטי מקור UI
// REGRESSION TEST: Task D - Unify back-link components

const SRC_DIR = new URL('../src', import.meta.url).pathname;

function getJsxFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...getJsxFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith('.jsx')) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

test('REGRESSION C: No פרטי מקור UI labels in user-facing components', () => {
  const jsxFiles = getJsxFiles(SRC_DIR);
  const criticalFiles = ['LibraryPage.jsx', 'PersonalTools.jsx'];
  
  for (const file of jsxFiles) {
    const filename = file.split('/').pop();
    if (criticalFiles.includes(filename)) {
      const content = readFileSync(file, 'utf-8');
      
      // Check that SourceDetails component in LibraryPage doesn't render פרטי מקור
      if (filename === 'LibraryPage.jsx') {
        // SourceDetails should return null (no user-facing source details)
        assert(content.includes('return null;') && content.includes('SourceDetails'), 
          `${filename} SourceDetails must return null to hide פרטי מקור from users`);
      }
      
      // Check that PersonalTools doesn't have the baby-details פרטי מקור section
      if (filename === 'PersonalTools.jsx') {
        assert(!content.includes('<details className="baby-details"><summary>פרטי מקור</summary>'), 
          `${filename} should not have פרטי מקור in baby-details`);
      }
    }
  }
});

test('REGRESSION D: No anchor-based back-link elements remain', () => {
  const jsxFiles = getJsxFiles(SRC_DIR);
  const pagesDir = jsxFiles.filter(f => f.includes('/pages/'));
  
  for (const file of pagesDir) {
    const content = readFileSync(file, 'utf-8');
    const filename = file.split('/').pop();
    
    // Check for legacy anchor-based back links with class "link back-link"
    const legacyAnchorPattern = /<a\s+className="link\s+back-link"/;
    assert(!legacyAnchorPattern.test(content), 
      `${filename} still contains legacy <a className="link back-link"> anchor tag - use unified BackLink component instead`);
    
    // Check for legacy button-based back links with class "link back-link"
    const legacyButtonPattern = /<button[^>]*className="link\s+back-link"/;
    assert(!legacyButtonPattern.test(content), 
      `${filename} still contains legacy button with className="link back-link" - use unified BackLink component instead`);
  }
});

test('REGRESSION D: All back-link implementations use unified BackLink component', () => {
  const jsxFiles = getJsxFiles(SRC_DIR);
  const pagesWithBackLinks = ['PreparationHub.jsx', 'ShabbatPage.jsx', 'ShabbatTable.jsx', 'TravelMode.jsx', 'PersonalTools.jsx', 'ForgottenAddition.jsx'];
  
  for (const file of jsxFiles) {
    const filename = file.split('/').pop();
    if (pagesWithBackLinks.includes(filename)) {
      const content = readFileSync(file, 'utf-8');
      
      // These files should either:
      // 1. Import BackLink from LocalNavigation, OR
      // 2. Use BackNavigation from LocalNavigation (for compatibility)
      const hasBackLinkImport = content.includes('import { BackLink }') || content.includes('import { BackNavigation }');
      assert(hasBackLinkImport, 
        `${filename} should import BackLink or BackNavigation from LocalNavigation for unified styling`);
      
      // Verify that they use the imported component (not legacy anchor tags)
      if (filename !== 'ForgottenAddition.jsx') { // ForgottenAddition uses onClick so it's OK
        const hasLegacyAnchors = /<a\s+className="link\s+back-link"/.test(content);
        const hasLegacyButtons = /<button[^>]*className="link\s+back-link"/.test(content);
        const hasPersonalBack = /<a\s+className="personal-back"/.test(content);
        
        assert(!(hasLegacyAnchors || hasLegacyButtons || hasPersonalBack), 
          `${filename} should not have legacy back-link implementations`);
      }
    }
  }
});

test('REGRESSION: LocalNavigation exports unified BackLink component', () => {
  const navFile = join(SRC_DIR, 'components/LocalNavigation.jsx');
  const content = readFileSync(navFile, 'utf-8');
  
  // Verify BackLink component exists
  assert(content.includes('export function BackLink'), 
    'LocalNavigation.jsx must export BackLink component for unified styling');
  
  // Verify it has proper styling with local-back class (no browser defaults)
  assert(content.includes('className="local-back"'), 
    'BackLink must use local-back class for consistent styling (no underline, no browser-blue)');
  
  // Verify arrow is hidden from screen readers
  assert(content.includes('aria-hidden="true"'), 
    'BackLink arrow should be hidden from screen readers');
});

test('REGRESSION: Unified BackLink has no browser-default styling (no underline, no blue)', () => {
  const cssFile = join(SRC_DIR, 'styles/base.css');
  const content = readFileSync(cssFile, 'utf-8');
  
  // Verify local-back class is defined with styling
  assert(content.includes('.local-back'), 
    'base.css should define .local-back class for consistent styling');
  
  // Verify it doesn't have text-decoration underline
  const underlineMatch = content.match(/\.local-back\s*{[^}]*text-decoration:\s*underline/);
  assert(!underlineMatch, 
    'local-back should not have text-decoration underline (browser default removed)');
});
