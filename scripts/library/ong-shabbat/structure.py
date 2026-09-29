# Step 2 of the עונג שבת import (see extract.py): the book's structure from the visual-order lines.
#   pp. 12–18 פתח דבר · pp. 38–271 chapters א׳–כ״ד (Shabbat) · pp. 274–276 chapter כ״ה (blessings) ·
#   pp. 277–295 chapter כ״ו (the blessing table) · pp. 296–312 the subject index.
# Chapters → sections → numbered halachot; the footnotes ("מקורות וטעמים", numbered 1–958 through the whole book) are
# anchored to the halacha whose text carries their superscript marker. Text is kept as printed: lines are joined with
# a space and runs of justification spaces collapsed; 26 stray control characters (U+0007) are removed and listed.
# Every printed irregularity (a heading without its period, halachot numbered inline, index references that point to
# the wrong page) is recorded in "anomalies" / "indexErrata", never corrected in the text.
import json, re, sys, hashlib, collections
pages = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
HEB_NUM = re.compile(r'^([א-ת]{1,2}(?:["״][א-ת])?[\'׳]?)\.\s*(.*)$')
HEB_NUM2 = re.compile(r'^([א-ת]{1,2}(?:["״][א-ת])|[א-ת][\'׳])\s+(.*)$')
INLINE_NUM = re.compile(r'^([א-ת]{1,2}(?:["״][א-ת])?[\'׳]?)\.\s*(.*)$')
CTRL = re.compile(r'[\x00-\x08\x0b-\x1f\x7f]')
removed_ctrl = []

def clean(t, page):
    if CTRL.search(t): removed_ctrl.append({'page': page, 'text': t})
    return CTRL.sub('', t)

def classify(l):
    f, s, t = l['font'], l['size'], l['text'].strip()
    if l['y'] < 95: return 'header'
    if l['y'] > 638 and re.fullmatch(r'-\d+-', t): return 'pageno'
    if not t: return 'empty'
    if f.startswith('LotusBook'):
        if t == 'מקורות וטעמים': return 'fnlabel'
        return 'fn'
    if s >= 20: return 'chapter' if t.startswith('פרק') else 'section'
    if s >= 15 and (HEB_NUM.match(t) or (f in ('Caligraph-Medium','Caligraph-Bold') and HEB_NUM2.match(t))): return 'halacha'
    if f == 'Caligraph-Bold' and s >= 15: return 'subsection'
    if s >= 12.9 and s < 20: return 'subhead'
    return 'body'

HEB = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,'ק':100,'ר':200,'ש':300,'ת':400}
def heb_value(label):
    return sum(HEB.get(ch, 0) for ch in label)

chapters = []
cur_ch = None; cur_sec = None; cur_sub = None; cur_unit = None
footnotes = collections.OrderedDict()  # n -> {n, page, text}
last_fn = None
last_body_y = None; last_body_page = None
anomalies = []

def new_unit(label, title, page):
    global cur_unit
    cur_unit = {'label': label, 'title': title, 'pages': [page], 'paras': [], 'section': cur_sec, 'subsection': cur_sub}
    cur_ch['units'].append(cur_unit)
    return cur_unit

# Paragraph breaks are measured on the glyphs' baselines (the line boxes shift when a line carries a superscript): the
# book's line step is 14pt whatever the type size; a step of more than 15.6pt starts a new paragraph — except that a line
# carrying a raised footnote number gets about 3pt of extra leading above it, so there the limit is 18.8pt.
def expected_step(a, b):
    return 14.0
last_body_size = None
def add_body(text, page, y, kind='p', size=12.0):
    global cur_unit, last_body_y, last_body_page, last_body_size
    if cur_unit is None:
        # text before the first numbered halacha of a section: an unnumbered opening paragraph
        new_unit(None, None, page)
    if page not in cur_unit['pages']: cur_unit['pages'].append(page)
    prev_kind = cur_unit['paras'][-1]['kind'] if cur_unit['paras'] else None
    new_para = kind == 'sub' or prev_kind in (None, 'sub') or prev_kind != kind
    if not new_para and last_body_page == page and last_body_y is not None and y - last_body_y > expected_step(last_body_size, size) + (4.8 if '⟦' in text else 1.6): new_para = True
    if new_para: cur_unit['paras'].append({'kind': kind, 'lines': [text], 'page': page})
    else: cur_unit['paras'][-1]['lines'].append(text)
    last_body_y = y if kind != 'sub' else None; last_body_page = page; last_body_size = size

BODY_PAGES = list(range(38, 272)) + list(range(274, 277))
for p in pages:
    pno = p['page']
    if pno not in BODY_PAGES: continue
    last_body_y = None
    for l in p['lines']:
        k = classify(l); t = clean(l['text'], pno).strip()
        if k in ('header', 'pageno', 'empty', 'fnlabel'): continue
        if k == 'chapter':
            m = re.match(r'^פרק\s*([א-ת"\'׳״]+)', t)
            label = m.group(1).replace('ֿ', '')
            cur_ch = {'label': label.strip(), 'title': None, 'firstPage': pno, 'units': [], 'sections': []}
            chapters.append(cur_ch); cur_sec = None; cur_sub = None; cur_unit = None
            continue
        if k == 'section':
            if cur_ch['title'] is None and not cur_ch['units']: cur_ch['title'] = t
            cur_sec = t; cur_sub = None; cur_unit = None
            cur_ch['sections'].append({'title': t, 'page': pno})
            continue
        if k == 'subsection':
            m = HEB_NUM.match(t)
            cur_sub = t; cur_unit = None
            cur_ch['sections'].append({'title': t, 'page': pno, 'level': 2})
            continue
        if k == 'halacha':
            m = HEB_NUM.match(t) or HEB_NUM2.match(t)
            if not HEB_NUM.match(t): anomalies.append({'page': pno, 'issue': 'halacha heading printed without the period after its number', 'text': t})
            new_unit(m.group(1), m.group(2).strip(), pno); last_body_y = None
            continue
        if k == 'subhead':
            add_body(t, pno, l['base'], 'sub', l['size']); continue
        if k == 'body' and l['font'] == 'Caligraph-Medium':
            add_body(t, pno, l['base'], 'em', l['size']); continue
        if k == 'body':
            m = INLINE_NUM.match(t)
            starts_para = cur_unit is None or last_body_y is None or l['base'] - last_body_y > expected_step(last_body_size or 12.0, l['size']) + (4.8 if '⟦' in t else 1.6)
            if m and starts_para and cur_unit is not None and cur_unit['label'] and heb_value(m.group(1).replace('"','').replace("'", '')) == heb_value(cur_unit['label'].replace('"','').replace("'", '')) + 1:
                new_unit(m.group(1), None, pno); last_body_y = None
                anomalies.append({'page': pno, 'issue': 'numbered halacha printed inline, without a title line', 'label': m.group(1)})
                add_body(m.group(2), pno, l['base'], 'p', l['size']); continue
            if m and starts_para and cur_unit is not None and cur_unit['label'] is None and cur_ch['units'] and len(cur_ch['units']) >= 2:
                prev = [u for u in cur_ch['units'] if u['label']][-1]
                if heb_value(m.group(1).replace('"','').replace("'", '')) == heb_value(prev['label'].replace('"','').replace("'", '')) + 1:
                    cur_ch['units'].pop(); cur_unit = None
            if m and starts_para and cur_unit is None and cur_ch['units']:
                prev = [u for u in cur_ch['units'] if u['label']][-1]
                if heb_value(m.group(1).replace('"','').replace("'", '')) == heb_value(prev['label'].replace('"','').replace("'", '')) + 1:
                    new_unit(m.group(1), None, pno); last_body_y = None
                    anomalies.append({'page': pno, 'issue': 'numbered halacha printed inline, without a title line', 'label': m.group(1)})
                    add_body(m.group(2), pno, l['base'], 'p', l['size']); continue
            add_body(t, pno, l['base'], 'p', l['size']); continue
        if k == 'fn':
            m = re.match(r'^⟦(\d+)⟧\s*(.*)$', t)
            if m:
                n = int(m.group(1))
                if n in footnotes: anomalies.append({'page': pno, 'issue': f'footnote {n} twice'})
                footnotes[n] = {'n': n, 'pages': [pno], 'lines': [m.group(2)]}
                last_fn = n
            else:
                footnotes[last_fn]['lines'].append(t)
                if pno not in footnotes[last_fn]['pages']: footnotes[last_fn]['pages'].append(pno)
            continue

def join(lines):
    return re.sub(r'[  ]{2,}', ' ', ' '.join(x.strip() for x in lines)).strip()

MARK = re.compile(r'⟦(\d+)⟧')
out_ch = []
for ci, ch in enumerate(chapters, 1):
    units = []
    for ui, u in enumerate(ch['units'], 1):
        paras = []
        for para in u['paras']:
            paras.append({'kind': para['kind'], 'text': join(para['lines'])})
        raw = '\n'.join(pp['text'] for pp in paras)
        refs = []
        clean_text = ''
        pos = 0
        for m in MARK.finditer(raw):
            clean_text += raw[pos:m.start()]
            refs.append({'n': int(m.group(1)), 'at': len(clean_text)})
            pos = m.end()
        clean_text += raw[pos:]
        subs = [i for i, pp in enumerate(paras) if pp['kind'] == 'sub']
        ems = [i for i, pp in enumerate(paras) if pp['kind'] == 'em']
        units.append({'n': ui, 'label': u['label'], 'value': heb_value(u['label'].replace('"', '').replace("'", '')) if u['label'] else None,
                      'title': u['title'], 'section': u['section'], 'subsection': u['subsection'], 'pages': u['pages'],
                      'text': clean_text, 'subs': subs, 'ems': ems, 'refs': refs})
    out_ch.append({'n': ci, 'label': ch['label'], 'title': ch['title'], 'firstPage': ch['firstPage'], 'sections': ch['sections'], 'units': units})

fns = []
for n, f in footnotes.items():
    fns.append({'n': n, 'pages': f['pages'], 'text': join(f['lines'])})
json.dump({'chapters': out_ch, 'footnotes': fns, 'removedControlChars': removed_ctrl, 'anomalies': anomalies}, open(OUT, 'w'), ensure_ascii=False, indent=0)
print('chapters', len(out_ch), 'units', sum(len(c['units']) for c in out_ch), 'footnotes', len(fns), 'anomalies', anomalies[:5], 'ctrl', len(removed_ctrl))
for c in out_ch: print(c['n'], c['label'], c['title'], c['firstPage'], len(c['units']), [s['title'] for s in c['sections']][:8])

# ---------- chapter 26: the blessing table (pp. 277–295) ----------
table = {'intro': None, 'entries': []}
intro_lines = []; letter = None; cur = None; prev_end = True
for p in pages:
    pno = p['page']
    if not (277 <= pno <= 295): continue
    for l in p['lines']:
        k = classify(l); t = clean(l['text'], pno).strip()
        if k in ('header', 'pageno', 'empty'): continue
        if l['size'] >= 20 and (t.startswith('פרק') or t == 'לוח ברכות'): continue
        if l['size'] >= 15:
            letter = t; cur = None; prev_end = True; continue
        if letter is None: intro_lines.append(t); continue
        starts = prev_end and re.search(r'\s[–-]\s', t[:60]) is not None
        if starts or cur is None:
            cur = {'letter': letter, 'lines': [t], 'pages': [pno], 'em': l['font'] == 'Caligraph-Medium'}
            table['entries'].append(cur)
        else:
            cur['lines'].append(t)
            if pno not in cur['pages']: cur['pages'].append(pno)
        prev_end = t.rstrip().endswith('.')
table['intro'] = join(intro_lines)
for e in table['entries']:
    e['text'] = join(e['lines']); del e['lines']
    m = re.match(r'^(.*?)\s[–-]\s(.*)$', e['text'])
    e['food'] = m.group(1).strip() if m else None
print('blessing table entries', len(table['entries']), 'letters', len(set(e['letter'] for e in table['entries'])))

# ---------- the subject index (pp. 296–312): term → page \ halacha ----------
index = []
carry = ''
ENTRY = re.compile(r'^(.*?)(?:-\s*(\d+)\s*)?\\\s*([א-ת"”\'’׳״]+)\.?\s*(.*)$')
for p in pages:
    pno = p['page']
    if not (296 <= pno <= 312): continue
    segs = [l for l in p['lines'] if 95 < l['y'] < 638 and l['size'] < 12]
    mid = 262 if pno % 2 == 0 else 228
    right = sorted([l for l in segs if l['x1'] > mid + 20], key=lambda l: l['y'])
    left = sorted([l for l in segs if l['x1'] <= mid + 20], key=lambda l: l['y'])
    for l in right + left:
        t = clean(l['text'], pno).strip()
        if carry: t = carry + ' ' + t; carry = ''
        while t:
            m = ENTRY.match(t)
            if not m: carry = t; break
            index.append({'term': re.sub(r'\s{2,}', ' ', m.group(1)).strip().rstrip('-').strip(), 'page': int(m.group(2)) if m.group(2) else None, 'label': m.group(3), 'indexPage': pno})
            t = m.group(4).strip()
if carry: anomalies.append({'page': 312, 'issue': 'index line not parsed', 'text': carry})
unit_by_page = collections.defaultdict(list)
all_units = [(c['n'], u) for c in out_ch for u in c['units']]
for cn, u in all_units:
    for pg in u['pages']: unit_by_page[pg].append((cn, u))
def overlap(term, u):
    words = [re.sub(r'["\'׳״”’]', '', w) for w in re.sub(r'[-,\[\]]', ' ', term).split() if len(w) > 1]
    title = re.sub(r'["\'׳״]', '', u['title'] or '')
    hay = re.sub(r'["\'׳״]', '', u['text'])
    return sum(2 if w[:4] in title else (1 if w[:4] in hay else 0) for w in words)
unresolved = []; errata = []
KEEP_PRINTED = {('כיבוס ביום שישי', 42)}  # checked by eye: the printed reference is right (הפעלת מכונת כביסה)
MANUAL = {  # printed page numbers that point nowhere; resolved by the halacha title the index entry names
    ('סעודה שלישית- לא אכל קודם השקיעה', 10): (7, 'ג\'', 'לא אכל קודם השקיעה'),
    ('ספריי למניעת ריח מהפה', 13): (13, 'ד\'', 'ספריי למניעת ריח מהפה'),
}
for e in index:
    v = heb_value(re.sub(r'["”\'’׳״]', '', e['label']))
    pool = unit_by_page.get(e['page'], []) if e['page'] else all_units
    exact = [(cn, u) for cn, u in pool if u['value'] == v]
    if not exact and e['page']: exact = [(cn, u) for pg in (e['page'] - 1, e['page'] + 1) for cn, u in unit_by_page.get(pg, []) if u['value'] == v]
    exact.sort(key=lambda cu: -overlap(e['term'], cu[1]))
    best = exact[0] if exact else None
    if (best is None or overlap(e['term'], best[1]) == 0) and (e['term'], e['page']) not in KEEP_PRINTED:
        near = [(cn, u) for pg in ([e['page'] - 1, e['page'], e['page'] + 1] if e['page'] else []) for cn, u in unit_by_page.get(pg, [])] if e['page'] else []
        near.sort(key=lambda cu: -overlap(e['term'], cu[1]))
        if near and overlap(e['term'], near[0][1]) >= 2 and (best is None or near[0][1] is not best[1]) and (best is None or overlap(e['term'], near[0][1]) >= overlap(e['term'], best[1]) + 2):
            errata.append({'term': e['term'], 'printed': f"{e['page']} \\ {e['label']}", 'resolvedTo': f"פרק {out_ch[near[0][0]-1]['label']} {near[0][1]['label']} ({near[0][1]['title']})"})
            best = near[0]
    key = (e['term'], e['page'])
    if key in MANUAL:
        cn, lab, title = MANUAL[key]
        best = next((c, u) for c, u in all_units if c == cn and u['title'] == title)
        errata.append({'term': e['term'], 'printed': f"{e['page']} \\ {e['label']}", 'resolvedTo': f"פרק {out_ch[cn-1]['label']} {best[1]['label']} ({best[1]['title']})", 'how': 'by the halacha title the entry names'})
    if best is None or (e['page'] is None and overlap(e['term'], best[1]) == 0): unresolved.append(e); continue
    e['chapter'] = best[0]; e['unit'] = best[1]['n']
print('index entries', len(index), 'unresolved', len(unresolved), 'errata', len(errata))
for e in unresolved: print('  U', e)
for e in errata: print('  E', e)
# ---------- front matter ----------
def page_text(pn, skip_big=False):
    out = []
    for l in pages[pn - 1]['lines']:
        if l['y'] < 95 or (l['y'] > 638 and re.fullmatch(r'-\d+-', l['text'].strip())): continue
        out.append(l)
    return out
intro = []
last_y = None
for pn in range(12, 19):
    for l in page_text(pn):
        t = clean(l['text'], pn).strip()
        if not t: continue
        big = l['size'] >= 14.5
        if big or not intro or intro[-1]['kind'] == 'head' or last_y is None or l['y'] - last_y > 16.5 or t in ('* * *',):
            intro.append({'kind': 'head' if big else 'p', 'lines': [t], 'page': pn})
        else:
            intro[-1]['lines'].append(t)
        last_y = l['y']
    last_y = None
approbations = [clean(l['text'], 3).strip() for l in pages[2]['lines'] if l['text'].strip().startswith('הסכמת')]
front = {'intro': [{'kind': x['kind'], 'page': x['page'], 'text': join(x['lines'])} for x in intro], 'approbations': approbations}
data = json.load(open(OUT))
data.update({'blessingTable': table, 'index': index, 'indexErrata': errata, 'indexUnresolved': unresolved, 'front': front, 'anomalies': anomalies, 'removedControlChars': removed_ctrl})
json.dump(data, open(OUT, 'w'), ensure_ascii=False, indent=0)
