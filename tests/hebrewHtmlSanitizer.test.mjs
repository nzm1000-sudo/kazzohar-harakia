import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHebrewHtml } from '../src/hebrewHtml.mjs';

test('allow-listed inline tags survive with only a safe class attribute', () => {
  assert.equal(sanitizeHebrewHtml('טקסט <span class="x">רגיל</span> ועוד'), 'טקסט <span class="x">רגיל</span> ועוד');
  assert.equal(sanitizeHebrewHtml('<B CLASS="big">גדול</B>'), '<b>גדול</b>');
  assert.equal(sanitizeHebrewHtml('<br/><br>'), '<br><br>');
  assert.equal(sanitizeHebrewHtml('<span onclick="x()">y</span>'), '<span>y</span>');
});

test('disallowed tags, scripts and javascript: links are removed entirely', () => {
  assert.equal(sanitizeHebrewHtml('<script>alert(1)</script><i data-commentator="x"></i>רש"י'), 'רש"י');
  assert.equal(sanitizeHebrewHtml('<a href="javascript:alert(1)">קליק</a>'), 'קליק');
  assert.equal(sanitizeHebrewHtml('<img src=x onerror=alert(1)>'), '');
});

test('an unterminated tag cannot be completed by later markup insertion (XSS via <mark>)', () => {
  const out = sanitizeHebrewHtml('<b>שלום</b> <img src=x onerror=alert(1)');
  assert.equal(out, '<b>שלום</b> &lt;img src=x onerror=alert(1)');
  assert.ok(!/<img/.test(out));
});

test('prose angle brackets are preserved as text instead of being parsed as tags', () => {
  assert.equal(sanitizeHebrewHtml('a < b ו־ 3 > 2'), 'a &lt; b ו־ 3 > 2');
  assert.equal(sanitizeHebrewHtml('שבר <'), 'שבר &lt;');
  assert.equal(sanitizeHebrewHtml('< b>לא תגית</ b>'), '&lt; b>לא תגית&lt;/ b>');
});
