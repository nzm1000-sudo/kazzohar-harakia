# -*- coding: utf-8 -*-
"""שלום רב — stage 1: extract the supplied book (sources/shalom-rav/Sidur_16X11.pdf) into ordered, styled lines.

The PDF is an InDesign export of two-page spreads (the right half is the earlier printed page). Plain text extraction
breaks the pointed Hebrew, so this works from the glyphs, their glyph ids and their positions:

  * the glyphs of each printed page are grouped into visual lines by baseline and read right to left;
  * the font draws a pointed letter as its own glyph (ב and בּ, ש and שׁ are different glyphs) and emits every point as
    an invisible placeholder at the pen position — sometimes on the seam between two touching letters. A point is
    attached to the letter it sits inside; a point on a seam goes to the neighbour whose glyph carries that point, as
    learned from all the unambiguous occurrences in the book (then Hebrew validity, then the line's convention);
  * the font emits a space after every vowel, ending exactly at that vowel: those are dropped; the real spaces lie
    between the letters; letter-spaced (force-justified) lines are split by their wider gaps;
  * digit and Latin runs are put back in logical order;
  * each line keeps its font and size, which carry the book's own structure (Oskar headings, Reforma explanations
    and instructions, Real Belet pointed text).

Nothing is corrected from memory: the characters are the PDF's own. Requires PyMuPDF (pip install pymupdf).
Usage: python3 scripts/shalom-rav/extract.py  ->  sources/shalom-rav/extracted/pages.json
"""
import json, os, re, unicodedata
from collections import defaultdict
import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF = os.path.join(ROOT, 'sources/shalom-rav/Sidur_16X11.pdf')
OUT = os.path.join(ROOT, 'sources/shalom-rav/extracted/pages.json')

VOWELS = set('ְֱֲֳִֵֶַָֻ')
LTR = re.compile(r'[0-9A-Za-z.,/%:\-]')

def is_mark(ch): return 0x0591 <= ord(ch) <= 0x05C7 and ch not in '־׀׃׆'
def is_space(ch): return ch in '    '
def is_letter(ch): return 'א' <= ch <= 'ת'

def font_class(font):
    if 'Oskar' in font: return 'heading'
    if 'Reforma' in font: return 'prose'
    if 'Bold' in font: return 'bold'
    return 'pointed'

def collect(page):
    """Glyphs of each half of a spread: dict(x0, x1, y, ch, font, size, gid)."""
    mid = page.rect.width / 2
    halves = {'right': [], 'left': []}
    for span in page.get_texttrace():
        for (u, gid, origin, bbox) in span['chars']:
            if u < 32: continue
            x0, x1 = bbox[0], bbox[2]
            if is_mark(chr(u)): x0 = x1 = origin[0]
            side = 'right' if (x0 + x1) / 2 >= mid else 'left'
            halves[side].append({'x0': x0, 'x1': x1, 'y': origin[1], 'ch': chr(u), 'font': span['font'],
                                 'size': round(span['size'], 1), 'gid': gid})
    return halves

def cluster_lines(glyphs):
    rows = []
    for g in sorted(glyphs, key=lambda g: g['y']):
        if rows and abs(rows[-1][0]['y'] - g['y']) <= 2.2: rows[-1].append(g)
        else: rows.append([g])
    return rows

def split_marks(row):
    bases = sorted([g for g in row if not is_mark(g['ch']) and not is_space(g['ch'])], key=lambda g: -(g['x0'] + g['x1']) / 2)
    marks = [g for g in row if is_mark(g['ch'])]
    spaces = [g for g in row if is_space(g['ch'])]
    letters = [b for b in bases if is_letter(b['ch'])] or bases
    return bases, marks, spaces, letters

def locate(m, letters):
    """('one', letter) | ('seam', letter_on_its_right_edge, letter_on_its_left_edge) | None."""
    x = m['x0']
    at_right = [b for b in letters if abs(b['x1'] - x) <= 0.15]
    at_left = [b for b in letters if abs(b['x0'] - x) <= 0.15]
    if at_right and at_left and at_right[0] is not at_left[0]:
        return ('seam', at_right[0], at_left[0])
    if at_right or at_left: return ('one', (at_right or at_left)[0])
    inside = [b for b in letters if b['x0'] < x < b['x1']]
    near = inside or [b for b in letters if b['x0'] - 0.8 <= x <= b['x1'] + 0.8]
    if not near: return None
    return ('one', min(near, key=lambda b: abs((b['x0'] + b['x1']) / 2 - x)))

def learn(doc):
    """For every letter glyph, how often each point is attached to it where the attachment is unambiguous."""
    occ, has = defaultdict(int), defaultdict(lambda: defaultdict(int))
    for page in doc:
        for glyphs in collect(page).values():
            for row in cluster_lines(glyphs):
                bases, marks, spaces, letters = split_marks(row)
                for b in letters: occ[(b['font'], b['gid'])] += 1
                for m in marks:
                    loc = locate(m, letters)
                    if loc and loc[0] == 'one': has[(loc[1]['font'], loc[1]['gid'])][m['ch']] += 1
    return occ, has

def build_line(row, stats, mode):
    occ, has = stats
    bases, marks, spaces, letters = split_marks(row)
    if not bases: return None
    order = {id(b): i for i, b in enumerate(bases)}
    attached = {id(b): [] for b in bases}
    orphans, seams = [], []
    for m in marks:
        loc = locate(m, letters)
        if loc is None: orphans.append(m['ch'])
        elif loc[0] == 'one': attached[id(loc[1])].append(m['ch'])
        else: seams.append((m, loc[1], loc[2]))
    def carries(mark, b):
        key = (b['font'], b['gid'])
        return has[key][mark] / occ[key] if occ[key] else 0.0
    def word_final(b):
        i = order[id(b)]
        return i == len(bases) - 1 or not is_letter(bases[i + 1]['ch']) or (b['x0'] - bases[i + 1]['x1']) > 2.0
    def valid(mark, b):
        ch, own = b['ch'], attached[id(b)]
        if mark in 'ׁׂ': return ch == 'ש' and 'ׁ' not in own and 'ׂ' not in own
        if mark == 'ּ':
            if ch in 'אחערםןץ' or 'ּ' in own: return False
            return word_final(b) if ch == 'ה' else True
        if mark in VOWELS: return not any(v in VOWELS for v in own)
        return True
    counts = {'byGlyph': 0, 'byHebrew': 0, 'byConvention': 0}
    pending = []
    seams.sort(key=lambda t: -abs(carries(t[0]['ch'], t[1]) - carries(t[0]['ch'], t[2])))
    for m, lft, rgt in seams:   # lft: the seam is its right edge (point typed before it); rgt: the seam is its left edge
        cl, cr = carries(m['ch'], lft), carries(m['ch'], rgt)
        if abs(cl - cr) >= 0.3:
            pick, other = (lft, rgt) if cl > cr else (rgt, lft)
            if m['ch'] in attached[id(pick)] and m['ch'] not in attached[id(other)]: pick = other  # never twice on one letter
            attached[id(pick)].append(m['ch']); counts['byGlyph'] += 1
        else: pending.append((m, lft, rgt))
    decided = []
    for m, lft, rgt in pending:
        vl, vr = valid(m['ch'], lft), valid(m['ch'], rgt)
        if vl != vr:
            attached[id(lft if vl else rgt)].append(m['ch']); counts['byHebrew'] += 1; decided.append(vl)
        else: decided.append(None)
    votes = [d for d in decided if d is not None]
    line_mode = (sum(votes) * 2 > len(votes)) if votes and sum(votes) * 2 != len(votes) else mode['left']
    for (m, lft, rgt), d in zip(pending, decided):
        if d is None:
            attached[id(lft if line_mode else rgt)].append(m['ch']); counts['byConvention'] += 1
    mark_xs = [m['x0'] for m in marks]
    def fake(s):  # ends exactly at a vowel and lies on a letter (a real space lies between letters)
        c = (s['x0'] + s['x1']) / 2
        return any(abs(s['x1'] - mx) <= 0.25 for mx in mark_xs) and any(b['x0'] + 0.3 < c < b['x1'] - 0.3 for b in letters)
    real = [s for s in spaces if not fake(s)]
    centers = [(s['x0'] + s['x1']) / 2 for s in real]
    gaps = sorted(bases[i - 1]['x0'] - bases[i]['x1'] for i in range(1, len(bases)))
    median = gaps[len(gaps) // 2] if gaps else 0
    spread = median > 1.6 and not any('Oskar' in b['font'] for b in bases)  # headings are letter-spaced by design, words by real spaces
    out = []
    for i, b in enumerate(bases):
        if i:
            prev = bases[i - 1]
            gap = prev['x0'] - b['x1']
            if spread: boundary = gap > max(2.3 * median, median + 3)
            else:
                lc, rc = (b['x0'] + b['x1']) / 2, (prev['x0'] + prev['x1']) / 2
                boundary = any(lc < c < rc for c in centers) or gap > 6
            if boundary: out.append(' ')
        out.append(b['ch'] + ''.join(attached[id(b)]))
    text = ''.join(out)
    # Numbers (and Latin) were read right to left: every run of digits — with the separators inside it — is turned back.
    text = re.sub(r'[0-9A-Za-z](?:[0-9A-Za-z.,/%:\-]*[0-9A-Za-z])?', lambda m: m.group(0)[::-1], text)
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r'[  ]{2,}', ' ', text).strip()
    fonts = defaultdict(int)
    for b in bases: fonts[(b['font'], b['size'])] += 1
    font, size = max(fonts, key=fonts.get)
    cls = font_class(font)
    heb = [b for b in bases if is_letter(b['ch'])]
    pointed = sum(1 for b in heb if attached[id(b)])
    if cls == 'prose' and heb and pointed / len(heb) > 0.45: cls = 'pointed'
    line = {'text': text, 'font': font, 'size': size, 'cls': cls,
            'x0': round(min(b['x0'] for b in bases), 1), 'x1': round(max(b['x1'] for b in bases), 1),
            'y': round(row[0]['y'], 1), 'orphanMarks': orphans, 'seams': counts}
    return line, votes

def main():
    doc = fitz.open(PDF)
    stats = learn(doc)
    pages, mode = [], {'left': True}
    for i, page in enumerate(doc):
        halves = collect(page)
        for side in ('right', 'left'):
            rows = cluster_lines(halves[side])
            page_votes = []
            for r in rows:
                res = build_line(r, stats, mode)
                if res: page_votes += res[1]
            if page_votes and sum(page_votes) * 2 != len(page_votes): mode['left'] = sum(page_votes) * 2 > len(page_votes)
            lines = [res[0] for res in (build_line(r, stats, mode) for r in rows) if res]
            printed, body = None, []
            for ln in lines:
                if ln['y'] < 30 and ln['text'].replace('”', '"') in ('בס"ד', 'בס״ד'): continue
                if ln['y'] > 415 and re.fullmatch(r'\d{1,3}', ln['text']): printed = int(ln['text']); continue
                body.append(ln)
            if body: pages.append({'pdfPage': i + 1, 'side': side, 'printedPage': printed, 'lines': body})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'source': 'sources/shalom-rav/Sidur_16X11.pdf', 'pdfPages': doc.page_count, 'pages': pages}, f, ensure_ascii=False, indent=1)
    seams = defaultdict(int)
    for p in pages:
        for l in p['lines']:
            for k, v in l['seams'].items(): seams[k] += v
    print('pdf pages', doc.page_count, '| printed pages', len(pages), '| lines', sum(len(p['lines']) for p in pages),
          '| orphan marks', sum(len(l['orphanMarks']) for p in pages for l in p['lines']), '| seam points', dict(seams))

if __name__ == '__main__':
    main()
