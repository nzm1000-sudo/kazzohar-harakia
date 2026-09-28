# -*- coding: utf-8 -*-
"""שלום רב — stage 2: the extracted lines (stage 1) become the book's entries, in the book's order.

  * corrections (sources/shalom-rav/corrections.json, each checked against the page image) are applied to the lines;
  * lines join into paragraphs by the book's own layout: line spacing, a short last line, a change of font;
  * paragraphs split into entries at the book's headings, as listed in scripts/shalom-rav/spec.json, and each block
    takes its role — the author's explanation, an instruction, the text itself — from the spec and the fonts;
  * every block keeps the printed page it comes from.
Usage: python3 scripts/shalom-rav/segment.py [--dump]  ->  sources/shalom-rav/extracted/book.json
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGES = os.path.join(ROOT, 'sources/shalom-rav/extracted/pages.json')
CORR = os.path.join(ROOT, 'sources/shalom-rav/corrections.json')
SPEC = os.path.join(ROOT, 'scripts/shalom-rav/spec.json')
OUT = os.path.join(ROOT, 'sources/shalom-rav/extracted/book.json')

def load_lines():
    pages = json.load(open(PAGES, encoding='utf-8'))['pages']
    corrections = json.load(open(CORR, encoding='utf-8'))['corrections']
    # the visual review's corrections (sources/shalom-rav/review/review-*.json), each tied to its page and line
    review_dir = os.path.join(ROOT, 'sources/shalom-rav/review')
    reviewed = []
    for name in sorted(os.listdir(review_dir)):
        if name.startswith('review-') and name.endswith('.json'):
            for pg in json.load(open(os.path.join(review_dir, name), encoding='utf-8'))['pages']:
                for c in pg.get('corrections', []):
                    reviewed.append({**c, 'page': pg['page'], 'file': name})
    used = [0] * len(corrections)
    used_review = [0] * len(reviewed)
    lines = []
    for p in pages:
        printed = p['printedPage']
        if printed is None or printed < 2: continue          # the table of contents is kept by hand in spec.json
        width = max((l['x1'] - l['x0']) for l in p['lines'])
        page_lines = []
        for l in p['lines']:
            text = l['text']
            for i, c in enumerate(corrections):
                if c['page'] == printed and c['find'] in text:
                    text = text.replace(c['find'], c['replace']); used[i] += 1
            page_lines.append({**l, 'text': text, 'page': printed, 'pdfPage': p['pdfPage'], 'colWidth': width})
        for i, c in enumerate(reviewed):
            if c['page'] != printed: continue
            n = c.get('line')
            order = ([n - 1] if isinstance(n, int) and 0 < n <= len(page_lines) else []) + list(range(len(page_lines)))
            for k in order:
                if c['find'] in page_lines[k]['text']:
                    page_lines[k]['text'] = page_lines[k]['text'].replace(c['find'], c['replace'], 1); used_review[i] += 1
                    break
        lines += page_lines
    missing = [c for c, n in zip(corrections, used) if not n] + [c for c, n in zip(reviewed, used_review) if not n]
    if missing: raise SystemExit('corrections not found: %s' % json.dumps(missing, ensure_ascii=False))
    return lines

def kind(l):
    if l['cls'] == 'heading': return 'heading'
    return 'prose' if l['cls'] == 'prose' else 'text'

def paragraphs(lines, spec):
    section_titles = set(spec['sectionTitles'])
    joins = tuple(spec.get('joinPrev', []))
    paras, cur = [], None
    for l in lines:
        k = kind(l)
        width = l['x1'] - l['x0']
        forced = l['text'].strip() in section_titles
        if cur and not forced and k != 'heading' and cur['kind'] == k and not cur['closed']:
            same_page = cur['lastPage'] == l['page']
            gap = l['y'] - cur['lastY']
            if (same_page and gap <= 1.6 * max(l['size'], cur['lastSize'])) or (not same_page):
                cur['lines'].append(l['text']); cur['lastY'] = l['y']; cur['lastSize'] = l['size']; cur['lastPage'] = l['page']
                cur['pages'].add(l['page'])
                cur['closed'] = width < 0.8 * l['colWidth']
                continue
        if cur and l['text'].startswith(joins):
            cur['lines'].append(l['text']); cur['pages'].add(l['page']); cur['lastY'] = l['y']; cur['lastPage'] = l['page']
            cur['closed'] = width < 0.8 * l['colWidth']
            continue
        cur = {'kind': 'section' if forced else k, 'lines': [l['text']], 'lastY': l['y'], 'lastSize': l['size'], 'lastPage': l['page'],
               'pages': {l['page']}, 'closed': forced or k == 'heading' or width < 0.8 * l['colWidth']}
        paras.append(cur)
    out = []
    for p in paras:
        text = ''
        for t in p['lines']:
            if not text: text = t
            elif text.endswith(('-', '־')): text += t
            else: text += ' ' + t
        out.append({'kind': p['kind'], 'text': re.sub(r'\s{2,}', ' ', text).strip(), 'pages': sorted(p['pages'])})
    return out

def wrapped(t):
    t = t.strip()
    if not (t.startswith('(') and t.endswith(')')): return False
    depth = 0
    for i, ch in enumerate(t):
        depth += ch == '('; depth -= ch == ')'
        if depth == 0 and i < len(t) - 1: return False
    return True

def pdf_page(printed): return printed // 2 + 1

def build(spec, paras):
    parts = {title: eid for title, eid in spec['parts']}
    part_titles = set(parts)
    starts, k = [], 0
    for e in spec['entries']:
        while k < len(paras) and paras[k]['text'].strip(' :') != e['start']: k += 1
        if k == len(paras): raise SystemExit('start not found: ' + e['id'])
        starts.append(k); k += 1
    ranges = [(starts[n], starts[n + 1] if n + 1 < len(starts) else len(paras)) for n in range(len(starts))]
    # a paragraph that opens the next entry although it is printed before its heading (e.g. the note on עין הרע)
    moved = {}
    for n, e in enumerate(spec['entries']):
        if e.get('explanationBefore') and n:
            a, b = ranges[n - 1]
            for i in range(a, b):
                if paras[i]['text'].startswith(e['explanationBefore']): moved[i] = n
    entries = []
    for n, e in enumerate(spec['entries']):
        a, b = ranges[n]
        idx = [i for i in range(a + 1, b) if moved.get(i, n) == n] + [i for i, m in moved.items() if m == n and not (a <= i < b)]
        idx = sorted(set(idx), key=lambda i: (0 if moved.get(i) == n and i < a else 1, i))
        blocks, seen_text = [], False
        mode = None                     # after an 'authorInstructionsAfter' / 'sourceTextAfter' section
        section_origin = None
        for i in idx:
            p = paras[i]; t = p['text']
            if t in e.get('frontMatter', []) or t in e.get('dropParas', []) or t.strip(' :') in part_titles: continue
            pieces = [(p['kind'], t)]
            for sp in e.get('splits', []):
                if sp['find'] in t:
                    head, tail = t.split(sp['find'], 1)
                    pieces = [('prose', (head + sp['find']).strip()), ('text', tail.strip())]
            for kind_, text in pieces:
                blk = {'pages': p['pages']}
                if kind_ in ('heading', 'section'):
                    blk.update(type='section', title=text)
                    anchor = e.get('anchors', {}).get(text)
                    if anchor: blk['anchor'] = anchor
                    so = e.get('sectionOrigins', {}).get(text)
                    if so: blk.update(so)
                    mode = 'instruction' if text == e.get('authorInstructionsAfter') else 'source' if text == e.get('sourceTextAfter') else None
                elif text in e.get('signatures', []): blk.update(type='signature', text=text)
                elif text in e.get('mottos', []): blk.update(type='motto', text=text)
                elif any(text.startswith(x) for x in e.get('explanations', [])) or (e.get('explanationBefore') and text.startswith(e['explanationBefore'])):
                    blk.update(type='explanation', text=text)
                elif kind_ == 'prose':
                    if e.get('explanationAll'): blk.update(type='explanation', text=text)
                    elif wrapped(text) or text.startswith('('): blk.update(type='instruction', text=text)
                    elif mode == 'source': blk.update(type='source', text=text)
                    elif mode == 'instruction': blk.update(type='instruction', text=text, byAuthor=True)
                    elif not seen_text: blk.update(type='explanation', text=text)
                    else: blk.update(type='instruction', text=text)
                else:
                    if wrapped(text): blk.update(type='instruction', text=text)
                    else: blk.update(type='text', text=text); seen_text = True
                blocks.append(blk)
        pages = sorted({pg for blk in blocks for pg in blk['pages']} | set(paras[a]['pages']))
        entry = {k2: v for k2, v in e.items() if k2 not in ('start', 'frontMatter', 'dropParas', 'splits', 'explanations', 'explanationBefore', 'authorInstructionsAfter', 'sourceTextAfter', 'signatures', 'mottos', 'explanationAll', 'anchors', 'sectionOrigins')}
        entry.update(order=n + 1, printedPages=[pages[0], pages[-1]], pdfPages=[pdf_page(pages[0]), pdf_page(pages[-1])], blocks=blocks,
                     part=next((title for title, eid in spec['parts'] if eid == e['id']), e.get('part')))
        entries.append(entry)
    return entries

def main():
    spec = json.load(open(SPEC, encoding='utf-8'))
    lines = load_lines()
    paras = paragraphs(lines, spec)
    if '--dump' in sys.argv:
        for i, p in enumerate(paras):
            print('%4d %-7s p%s %s' % (i, p['kind'], ','.join(map(str, p['pages'])), p['text'][:110]))
        return
    entries = build(spec, paras)
    toc = [{'title': t, 'page': pg, 'target': target} for t, pg, target in spec['toc']]
    out = {'book': spec['book'], 'categories': spec['categories'], 'needs': spec['needs'], 'toc': toc, 'entries': entries}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    types = {}
    for e in entries:
        for b in e['blocks']: types[b['type']] = types.get(b['type'], 0) + 1
    print('entries', len(entries), '| paragraphs', len(paras), '| blocks', types)

if __name__ == '__main__':
    main()
