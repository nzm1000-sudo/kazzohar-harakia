import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOK_CATEGORIES } from '../src/data/bookCatalog.mjs';
import { TANAKH_SECTIONS } from '../src/data/tanakhCatalog.mjs';
import { normalizeHebrew } from '../src/content.mjs';

const booksSource = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
const halachaSource = readFileSync(fileURLToPath(new URL('../src/pages/HalachaLibrary.jsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

// Reproduces the exact category-level filter used in BooksCatalog, so this test
// fails again if the special-casing regresses without touching React internals.
function categoryBooksFor(query) {
  const normalized = query.trim();
  return BOOK_CATEGORIES.map(category => ({
    id: category.id,
    books: category.books
      .map(([id, title, reference]) => ({ id, title, reference }))
      .filter(book => book.id === 'mishnah' || book.id === 'tanakh' || !normalized || normalizeHebrew(`${book.title} ${book.reference}`).includes(normalizeHebrew(normalized))),
  }));
}

test('REGRESSION: searching ויקרא (a real Tanakh book, not the umbrella "כל התנ״ך" title) still surfaces the Tanakh category', () => {
  assert.ok(TANAKH_SECTIONS.some(section => section.books.some(([, title]) => title === 'ויקרא')), 'ground truth: ויקרא is a real Tanakh book title in the data');
  const categories = categoryBooksFor('ויקרא');
  const referenceCategory = categories.find(c => c.books.some(b => b.id === 'tanakh'));
  assert.ok(referenceCategory, 'the category containing the Tanakh umbrella entry must not be filtered out for a real book-name query');
});

test('the outer category filter no longer relies on the umbrella title matching an individual book name', () => {
  assert.match(booksSource, /book\.id === 'mishnah' \|\| book\.id === 'tanakh' \|\| !normalized \|\| normalizeHebrew/);
});

test('Books and Halacha searches use the shared one-tap clearable input', () => {
  assert.match(booksSource, /<ClearableInput value=\{query\}[\s\S]*?clearLabel="נקה חיפוש בספרים"/);
  assert.match(halachaSource, /<ClearableInput id="halacha-search"[\s\S]*?clearLabel="נקה חיפוש בהלכה"/);
  assert.match(cssSource, /\.clearable-input-button\{/);
});
