import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDafInput, neighborAmud, findTractate, amudLabel, dafYomiTarget, TRACTATES, loadAmud, hebrewToNumber } from '../src/services/talmud.mjs';
import { sanitizeHebrewHtml } from '../src/hebrewHtml.mjs';

test('catalog exposes Bavli tractates with Steinsaltz Hebrew only', () => {
  assert.ok(TRACTATES.length >= 36);
  for (const t of TRACTATES) { assert.ok(t.steinsaltz?.index.startsWith('Steinsaltz on '), t.title); assert.equal(t.steinsaltz.license, 'CC-BY-NC'); }
  assert.ok(!TRACTATES.some(t => /Tzitzit|Kallah|Soferim/.test(t.title)));
});

test('daf input parsing handles Hebrew, Latin and side variants', () => {
  assert.equal(parseDafInput('ברכות ב ע״א').amud, '2a');
  assert.equal(parseDafInput('ברכות 2a').amud, '2a');
  assert.equal(parseDafInput('שבת לא ב').amud, '31b');
  assert.equal(parseDafInput('בבא מציעא נט').needsSide, true);
  assert.equal(parseDafInput('בבא מציעא נט').daf, 59);
  assert.match(parseDafInput('מסכת שלא קיימת ב').error, /לא נמצאה/);
  assert.match(parseDafInput('ברכות תק א').error, /אינו קיים/);
  assert.equal(hebrewToNumber('קכ"א'), 121);
});

test('prev/next follow the real tractate range, not arithmetic', () => {
  const b = findTractate('Berakhot');
  assert.equal(neighborAmud(b, '2a', -1), null);
  assert.equal(neighborAmud(b, '2a', 1), '2b');
  assert.equal(neighborAmud(b, '2b', 1), '3a');
  assert.equal(b.lastAmud, '64a');
  assert.equal(neighborAmud(b, '64a', 1), null);
  const tamid = findTractate('Tamid');
  assert.equal(tamid.firstAmud, '25b');
  assert.equal(amudLabel('2a'), 'ב׳ ע״א');
  assert.equal(amudLabel('64a'), 'ס״ד ע״א');
  assert.equal(amudLabel('15b'), 'ט״ו ע״ב');
});

test('daf yomi Shekalim is flagged as Yerushalmi, not Bavli', () => {
  assert.equal(dafYomiTarget('Berakhot 2').amud, '2a');
  const s = dafYomiTarget('Jerusalem Talmud Shekalim 5');
  assert.equal(s.unsupported, true);
  assert.match(s.note, /ירושלמי/);
});

test('sanitizer keeps emphasis, drops scripts, handlers and commentator markers', () => {
  const dirty = '<big><strong>מֵאֵימָתַי</strong></big> <i data-commentator="X" data-label="a"></i>קורין <script>alert(1)</script><a href="javascript:x" onclick="y">קישור</a><span style="color:red" class="ok">x</span>';
  const clean = sanitizeHebrewHtml(dirty);
  assert.equal(clean, '<big><strong>מֵאֵימָתַי</strong></big> קורין קישור<span class="ok">x</span>');
});

test('live: Berakhot 2a loads base, Steinsaltz Hebrew, and Rashi/Tosafot links per segment', { timeout: 30000 }, async () => {
  const b = findTractate('ברכות');
  const amud = await loadAmud(b, '2a');
  assert.equal(amud.ref, 'Berakhot 2a');
  assert.ok(amud.segments.length >= 10);
  assert.match(amud.segments[0].gemara, /מֵאֵימָתַי/);
  assert.equal(amud.steinsaltzVersion.title, 'William Davidson Edition - Hebrew');
  assert.equal(amud.steinsaltzAligned, true);
  assert.match(amud.segments[0].steinsaltz, /קריאת שמע/);
  const seg1 = amud.segments[0].commentaries;
  assert.ok(seg1.some(c => c.commentator === 'רש"י' && c.ref.startsWith('Rashi on Berakhot 2a:1:')));
  assert.ok(seg1.some(c => c.commentator === 'תוספות' && c.ref.startsWith('Tosafot on Berakhot 2a:1:')));
  assert.equal(amud.next, '2b'); assert.equal(amud.prev, null);
});
