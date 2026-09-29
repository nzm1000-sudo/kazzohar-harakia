# Step 1 of the עונג שבת import: visual-order extraction of the printed PDF (Adobe InDesign CS4, 2013).
# The PDF stores each line's glyphs out of logical order (line-final punctuation first, digit runs reversed, niqqud
# after the next letter), so the text is rebuilt from where every glyph sits on the page: right to left, LTR runs
# (digits, Latin) restored, niqqud attached to its letter, spaces that sit inside a letter's box (InDesign artefacts)
# dropped, superscript footnote numbers kept as ⟦n⟧. On the index pages (296–312) lines are split into their two
# columns. Nothing is corrected.
#
# The PDF is NOT stored in the repository (rights: author-permission; see sources/ong-shabbat/provenance.json).
# Run with a throwaway environment, outside the repo:
#   python3 -m venv /tmp/ong-venv && /tmp/ong-venv/bin/pip install pymupdf==1.26.5
#   /tmp/ong-venv/bin/python scripts/library/ong-shabbat/extract.py <book.pdf> <lines.json>
#   /tmp/ong-venv/bin/python scripts/library/ong-shabbat/structure.py <lines.json> <book.json>
#   node scripts/library/build-ong-shabbat.mjs --book <book.json> --lines <lines.json> --pdf-sha256 <sha256 of the PDF>
import fitz, json, sys, re, unicodedata
PDF = sys.argv[1]; OUT = sys.argv[2]
doc = fitz.open(PDF)
SPLIT_PAGES = set(range(296, 313))
MARK = lambda ch: '֑' <= ch <= 'ׇ' and ch not in '־׀׃׆'
LTR = re.compile(r'[0-9A-Za-z]')
def kind(font, size):
    f = font.replace('Fb', '')
    return f, round(size, 1)

def page_lines(pno):
    page = doc[pno]
    raw = page.get_text('rawdict')
    spans = []
    for b in raw['blocks']:
        if b['type'] != 0: continue
        for l in b['lines']:
            for s in l['spans']:
                if not s['chars']: continue
                spans.append(s)
    # glyph clusters: a base char followed (in storage order) by its marks
    glyphs = []
    for s in spans:
        f, size = kind(s['font'], s['size'])
        for c in s['chars']:
            ch = c['c']; x0, y0, x1, y1 = c['bbox']
            g = {'c': ch, 'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'yc': (y0 + y1) / 2, 'oy': c['origin'][1], 'size': size, 'font': f, 'marks': []}
            glyphs.append(g)
    # attach marks to a base letter: the letter whose box holds the mark's x (shin/sin dots only to ש), else the previous letter
    bases = [g for g in glyphs if not MARK(g['c'])]
    marks = [g for g in glyphs if MARK(g['c'])]
    for m in marks:
        cands = [g for g in bases if abs(g['yc'] - m['yc']) < 3 and g['c'] not in ' ' and g['x0'] - 0.3 <= m['x0'] <= g['x1'] + 0.3]
        if m['c'] in 'ׁׂ':
            cands = [g for g in cands if g['c'] == 'ש'] or [g for g in bases if g['c'] == 'ש' and abs(g['yc'] - m['yc']) < 3 and abs((g['x0'] + g['x1']) / 2 - m['x0']) < 8]
        else:
            cands = [g for g in cands if 'א' <= g['c'] <= 'ת'] or cands
        if cands:
            best = min(cands, key=lambda g: abs((g['x0'] + g['x1']) / 2 - m['x0']))
            best['marks'].append(m['c'])
        else:
            print('orphan mark', pno + 1, hex(ord(m['c'])), file=sys.stderr)
    # drop spaces that sit inside a letter's box (InDesign artefacts around niqqud)
    letters = [g for g in bases if g['c'] != ' ']
    def inside(sp):
        w = sp['x1'] - sp['x0']
        return any(abs(g['yc'] - sp['yc']) < 3 and g['x0'] - 0.2 <= sp['x0'] and sp['x1'] <= g['x1'] + 0.2 and w < (g['x1'] - g['x0']) for g in letters)
    bases = [g for g in bases if not (g['c'] == ' ' and inside(g))]
    # cluster into lines by vertical centre (superscripts join the line they sit on)
    bases.sort(key=lambda g: g['yc'])
    lines = []
    for g in bases:
        tol = 4.2
        target = None
        for ln in lines[-6:]:
            if abs(ln['yc'] - g['yc']) < tol and (g['size'] < 8.6 or ln['size'] < 8.6 or abs(ln['size'] - g['size']) < 3.5 or True):
                target = ln; break
        if target is None:
            target = {'yc': g['yc'], 'glyphs': [], 'size': g['size']}
            lines.append(target)
        target['glyphs'].append(g)
    out = []
    split_lines = []
    for ln in lines:
        gs = sorted(ln['glyphs'], key=lambda g: -(g['x0'] + g['x1']) / 2)
        if pno + 1 in SPLIT_PAGES:
            seg = [gs[0]]
            for a, b in zip(gs, gs[1:]):
                if a['x0'] - b['x1'] > 14: split_lines.append({'yc': ln['yc'], 'glyphs': seg, 'size': ln['size']}); seg = []
                seg.append(b)
            split_lines.append({'yc': ln['yc'], 'glyphs': seg, 'size': ln['size']})
        else: split_lines.append(ln)
    for ln in split_lines:
        gs = sorted(ln['glyphs'], key=lambda g: -(g['x0'] + g['x1']) / 2)
        sizes = {}
        for g in gs:
            if g['c'] != ' ': sizes[(g['font'], g['size'])] = sizes.get((g['font'], g['size']), 0) + 1
        main = max(sizes.items(), key=lambda kv: kv[1])[0] if sizes else ('?', 0)
        # superscript = markedly smaller than the line's main size
        tokens = []
        for g in gs:
            sup = g['size'] <= main[1] * 0.7 and re.match(r'[0-9]', g['c'])
            tokens.append({'c': g['c'] + ''.join(g['marks']), 'sup': bool(sup), 'ltr': bool(LTR.match(g['c'])), 'x0': g['x0'], 'x1': g['x1'], 'font': g['font'], 'size': g['size']})
        # restore LTR runs: maximal runs of LTR chars joined by . , : / - % (only between LTR chars), same sup-state
        i = 0; res = []
        while i < len(tokens):
            t = tokens[i]
            if t['ltr']:
                j = i
                while j + 1 < len(tokens):
                    n = tokens[j + 1]
                    if n['ltr'] and n['sup'] == t['sup']: j += 1; continue
                    if n['c'] in '.,:/-%' and j + 2 < len(tokens) and tokens[j + 2]['ltr'] and tokens[j + 2]['sup'] == t['sup'] and not n['sup']: j += 2; continue
                    break
                run = tokens[i:j + 1][::-1]
                res.extend(run); i = j + 1
            else:
                res.append(t); i += 1
        # text with markers
        text = ''; k = 0
        while k < len(res):
            t = res[k]
            if t['sup']:
                num = ''
                while k < len(res) and res[k]['sup']: num += res[k]['c']; k += 1
                text += '⟦' + num + '⟧'; continue
            text += t['c']; k += 1
        x0 = min(g['x0'] for g in gs); x1 = max(g['x1'] for g in gs)
        mains = sorted(g['oy'] for g in gs if (g['font'], g['size']) == main and g['c'] != ' ')
        base = mains[len(mains) // 2] if mains else ln['yc']
        out.append({'y': round(ln['yc'], 1), 'base': round(base, 1), 'x0': round(x0, 1), 'x1': round(x1, 1), 'font': main[0], 'size': main[1], 'text': text})
    return out

pages = []
for p in range(doc.page_count):
    pages.append({'page': p + 1, 'lines': page_lines(p)})
json.dump(pages, open(OUT, 'w'), ensure_ascii=False)
print('ok', len(pages))
