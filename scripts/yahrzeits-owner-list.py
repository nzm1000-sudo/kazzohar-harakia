# -*- coding: utf-8 -*-
"""נר ה' נשמת אדם — the owner's list (sources/yahrzeits/owner-list.txt, from הידברות and ישיבה.אורג): parse both
sections (name – date lines by month; the table of name / date+year), merge, drop duplicates inside the list and
against the researched records, and report date conflicts. Writes docs/yahrzeits/research/owner-list.json.
Usage: python3 scripts/yahrzeits-owner-list.py [--report]"""
import json, re, sys, os, glob, unicodedata
SRC = 'sources/yahrzeits/owner-list.txt'
OUT = 'docs/yahrzeits/research/owner-list.json'
MONTHS = [('תשרי', 'Tishrei'), ('חשוון', 'Cheshvan'), ('חשון', 'Cheshvan'), ('מרחשוון', 'Cheshvan'), ('כסלו', 'Kislev'), ('טבת', 'Tevet'),
          ('שבט', 'Shevat'), ('אדר', 'Adar'), ('ניסן', 'Nisan'), ('אייר', 'Iyar'), ('סיוון', 'Sivan'), ('סיון', 'Sivan'),
          ('תמוז', 'Tamuz'), ('אב', 'Av'), ('מנחם אב', 'Av'), ('אלול', 'Elul')]
GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,'ק':100,'ר':200,'ש':300,'ת':400}
Q = '"”״\'’׳'
def gem(s):
    return sum(GEM.get(c, 0) for c in s if c in GEM)
def norm_q(s): return re.sub(r'[”״]', '"', re.sub(r'[’׳]', "'", s))
DATE = re.compile(r'(?<![א-ת])([א-ת]{1,2}["\']?[א-ת]?)\s+(מרחשוון|חשוון|חשון|תשרי|כסלו|טבת|שבט|אדר|ניסן|אייר|סיוון|סיון|תמוז|מנחם אב|אב|אלול)(?![א-ת])(\s*(?:\(?\s*[אב]\'\s*\)?))?(?:\s+([א-ת"\']+))?')
def parse_date(text):
    m = DATE.search(norm_q(text))
    if not m: return None
    day = gem(m.group(1))
    month = dict(MONTHS)[m.group(2)]
    adar = (m.group(3) or '').strip(' ()')
    if month == 'Adar' and adar in ("א'", "ב'"): month = 'AdarI' if adar == "א'" else 'AdarII'
    year = m.group(4) if m.group(4) and m.group(4)[0] in 'תשרקצ' and '"' in m.group(4) or (m.group(4) or '') in ("ת'",) else None
    if not 1 <= day <= 30: return None
    return {'day': day, 'month': month, 'yearHe': year, 'end': m.end(), 'start': m.start()}
lines = [l.strip() for l in open(SRC, encoding='utf-8').read().split('\n')]
cands = []
# section A: "name - date" (until the table starts: a bare month name "תשרי")
table_at = next(i for i, l in enumerate(lines) if l == 'תשרי')
for l in lines[:table_at]:
    if not l or l.startswith('חודש'): continue
    parts = re.split(r'\s+[-–]\s+', norm_q(l))
    if len(parts) < 2: continue
    date_part = parts[-1]; name = ' – '.join(parts[:-1]) if len(parts) > 2 and not parse_date(parts[-2] or '') else parts[0]
    d = parse_date(date_part)
    if not d: continue
    alt = re.search(r'ויש אומרים\s+(.+)$', date_part)
    cands.append({'raw': l, 'name': name.strip(), 'date': d, 'alt': alt.group(1) if alt else None, 'section': 'A'})
# section B: name line then a date line
i = table_at
while i < len(lines) - 1:
    l = lines[i]
    if not l or l in ('תשרי','מרחשוון','חשוון','כסלו','טבת','שבט',"אדר א'","אדר ב'",'ניסן','אייר','סיוון','תמוז','מנחם אב','אב','אלול','כסלו'): i += 1; continue
    d = parse_date(lines[i + 1]) if lines[i + 1] else None
    if d and not parse_date(l):
        cands.append({'raw': l + ' | ' + lines[i + 1], 'name': norm_q(l), 'date': d, 'section': 'B'}); i += 2
    else: i += 1
STOP = set('רבי הרב ר\' ר ה התנא מרן רבינו רבנו זצ"ל זיע"א זצוק"ל הקדוש הגאון בעל ה של אבינו אמנו אימנו רבינו ע"ה בן בת'.split())
def display(name):
    n = re.sub(r'\s*[,–].*$', '', name).strip()
    n = re.sub(r'\bזצ"ל\b|\bזיע"א\b', '', n).strip()
    n = re.sub(r"^ר' ", 'רבי ', n)
    return n.strip(' -')
def toks(name):
    n = norm_q(name).replace('"', '').replace("'", '')
    n = re.sub(r'[(),–-]', ' ', n)
    words = [w for w in n.split() if w not in {x.replace('"','').replace("'",'') for x in STOP} and len(w) > 1]
    out = set()
    for w in words:
        w = w.replace('וו', 'ו').replace('יי', 'י')
        out.add(re.sub(r'^ה(?=[א-ת]{3,})', '', w) if w.startswith('ה') and len(w) > 4 else w)
    return out
def key_date(d): return ('Adar' if d['month'].startswith('Adar') else d['month'], d['day'])
def similar(a, b):
    if not a or not b: return 0
    inter = len(a & b)
    if a == b: return 1.0
    if min(len(a), len(b)) < 2: return 0.4 if inter else 0   # one shared word (חיים, יוסף) is never enough
    return inter / min(len(a), len(b))
# existing researched records (all research files except this one)
existing = []
for f in sorted(glob.glob('docs/yahrzeits/research/*.json')):
    if f.endswith('owner-list.json'): continue
    for r in json.load(open(f, encoding='utf-8')).get('accepted', []):
        if not r.get('hebrewDate'): continue
        names = [r.get('displayNameHe', ''), r.get('canonicalNameHe', '')] + (r.get('aliases') or [])
        existing.append({'id': r['id'], 'names': names, 'toks': [toks(n) for n in names if n], 'date': key_date(r['hebrewDate']), 'display': r['displayNameHe']})
merged, dups_in_list = [], []
for c in cands:
    c['toks'] = toks(c['name']); c['display'] = display(c['name'])
    same = next((m for m in merged if key_date(m['date']) == key_date(c['date']) and similar(m['toks'], c['toks']) >= 0.5), None)
    if same:
        dups_in_list.append((c['raw'], same['raw']))
        if not same['date'].get('yearHe') and c['date'].get('yearHe'): same['date']['yearHe'] = c['date']['yearHe']
        if same['date']['month'] == 'Adar' and c['date']['month'] in ('AdarI', 'AdarII'): same['date']['month'] = c['date']['month']
        continue
    merged.append(c)
new, dup_existing, conflicts = [], [], []
for c in merged:
    best = max(((e, max(similar(t, c['toks']) for t in e['toks'])) for e in existing), key=lambda x: x[1], default=(None, 0))
    e, s = best
    if e and s >= 0.5 and e['date'] == key_date(c['date']): dup_existing.append((c['display'], e['id'])); continue
    if e and s >= 0.99 and min(len(c['toks']), 1) and e['date'] != key_date(c['date']) and len(c['toks']) >= 1:
        conflicts.append({'list': c['raw'], 'existing': e['id'], 'existingDate': e['date']}); continue
    new.append(c)
if "--report" in sys.argv:
    print('candidates', len(cands), '| list-internal duplicates', len(dups_in_list), '| merged', len(merged), '| already in research', len(dup_existing), '| conflicts', len(conflicts), '| new', len(new))
    for x in conflicts: print('CONFLICT', x)
    for c in new: print('NEW', c['date']['day'], c['date']['month'], c['date'].get('yearHe') or '', '|', c['display'], '|', c['raw'][:70])
json.dump({'new': [{'display': c['display'], 'raw': c['raw'], 'date': {k: c['date'][k] for k in ('day', 'month', 'yearHe')}, 'alt': c.get('alt')} for c in new],
           'conflicts': conflicts, 'duplicatesInList': dups_in_list, 'alreadyResearched': dup_existing}, open('/tmp/_owner_parse.json', 'w'), ensure_ascii=False, indent=1)

# ── Curation: every decision the parser cannot make, with its reason ─────────────────────────────────────────────
DROP = {
    'הרב שטינמן': 'duplicate of aharon-leib-steinman', 'הריי"ץ': 'duplicate of rayatz', 'רבנו תם מבעלי התוספות': 'duplicate of rabbeinu-tam',
    'האדמו"ר מצאנז': 'duplicate of klausenburger-rebbe (9 Tamuz)', 'הרב יוסף קפאח': 'duplicate of yosef-kapach',
    'יום הקדיש הכללי': 'not a person (a day of communal kaddish)', 'אליהו הנביא עלה לשמים': 'not a yahrzeit — אליהו הנביא did not die',
    'רבי חיים ברלין': 'the list gives two dates (ג׳ and י״ג תשרי) — unresolved', 'יהודה בן יעקב': 'the list gives two dates (ט״ו ניסן and ט״ו סיוון) — unresolved',
    'רבי חיים אבולעפיה': 'two spellings on two dates (ו׳ ניסן / ו׳ סיוון) — unresolved', 'רבי חיים אבולעפיא': 'two spellings on two dates (ו׳ ניסן / ו׳ סיוון) — unresolved',
    'התנא אלעזר בן רשב"י': 'duplicate of rabbi-elazar-ben-shimon (כ״ה אלול)',
    'גדליה בן אחיקם': 'a fast day, not a hilula (editorial decision, as before)',
}
RENAME = {
    'חור בנו של כלב ומרים הנביאה': 'חור בן כלב ומרים', 'הרב הלורד יונתן זקס': 'הרב יונתן זקס', 'הרה"ג אליהו בקשי דורון': 'הרב אליהו בקשי־דורון',
    'יעקב חיים ישראל רפאל אלפייה': 'רבי יעקב חיים ישראל רפאל אלפייה', 'הרב דוד כהן - הנזיר': 'הרב דוד כהן (הנזיר)',
    'הרב זלמן נחמיה גולדברג - הגרז"ן': 'הרב זלמן נחמיה גולדברג', 'הרב יעקב כולי "ילקוט מעם לועז"': 'רבי יעקב כולי, בעל ה"מעם לועז"',
    'הרב שמשון חיים בן נחמן מיכאל': 'בעל ה"זרע שמשון"', 'אם הבנים שמחה': 'בעל ה"אם הבנים שמחה"', 'הגאון הרב משה לוי': 'הרב משה לוי',
    'מלאכי אחרון הנביאים': 'מלאכי הנביא', 'התנא רבי עקיבא': 'רבי עקיבא', 'רבי יוסף תאומים': 'רבי יוסף תאומים, בעל ה"פרי מגדים"',
    'הרב נתן צבי פינקל': 'הרב נתן צבי פינקל, ראש ישיבת מיר', 'הרב שלום מרדכי הכהן שבדרון (המהרש"ם מבערזן)': 'המהרש"ם מברז׳ן',
    'הרב אברהם שמואל בנימין סופר ה"דעת סופר"': 'ה"כתב סופר"', 'בעל ה"בת עין"': 'בעל ה"בת עין"',
}
# one person twice in the list: the date both sections agree on
FIX_DATE = {'בנימין בן יעקב': (11, 'Cheshvan'), 'בנימין בן יעקב אבינו': None, 'שמעון בן יעקב': (28, 'Tevet'), 'רבי שמואל סלנט': (29, 'Av')}
# names the researched records matched by mistake (a different person with the same name) — they are new
FROM_CONFLICTS = ['יעקב אבינו - ט"ו תשרי', 'הרב נתן צבי פינקל', 'הרב יצחק חי טייב', 'רבי אברהם בן החפץ חיים', 'רבי משה תורג\'מן',
                  'ה"דעת סופר"', 'אשר בן יעקב', 'הרב יצחק אבוחצירא', 'המהרש"ם מבערזן', 'נדב ואביהו', 'הרב יעקב יוסף - ב\' אייר']
parsed = json.load(open('/tmp/_owner_parse.json', encoding='utf-8'))
links = json.load(open('/tmp/_owner_links.json', encoding='utf-8'))
def link_for(raw):
    r = norm_q(raw)
    return next((u for t, u in links if norm_q(t) and norm_q(t) in r), None)
items = list(parsed['new'])
for c in parsed['conflicts']:
    if any(k in norm_q(c['list']) for k in map(norm_q, FROM_CONFLICTS)):
        d = parse_date(c['list'].split('|')[-1]); raw = c['list']
        nm = norm_q(re.split(r'\s+[-–]\s+', raw)[0])
        if 'דעת סופר' in raw: nm = 'ה"כתב סופר"'  # the list's "דעת סופר" line names R' Avraham Shmuel Binyamin Sofer, the Ksav Sofer
        items.append({'display': display(nm) if nm not in RENAME else RENAME[nm], 'raw': raw, 'date': {k: d[k] for k in ('day', 'month', 'yearHe')}, 'alt': None})
dropped = []
accepted, seen = [], set()
BIBLE = re.compile(r'אבינו|אמנו|אימנו|הנביא|בן יעקב|בן חנוך|בן בארי|בן חכליה|נדב ואביהו|חור בן')
for it in items:
    name = it['display'].strip()
    if name in DROP: dropped.append({'name': name, 'reason': DROP[name].split(' — ')[0] if 'duplicate' in DROP[name] else ('not a person' if 'not a' in DROP[name] else 'conflict unresolved'), 'notes': DROP[name]}); continue
    name = RENAME.get(name, name)
    if name in FIX_DATE:
        if FIX_DATE[name] is None: continue
        it['date']['day'], it['date']['month'] = FIX_DATE[name]
    key = (name.replace(' אבינו', ''), it['date']['month'], it['date']['day'])
    if key in seen: continue
    seen.add(key)
    female = bool(re.search(r'הרבנית|אמנו|אימנו|^שרה', name))
    honor = 'ע״ה' if female or BIBLE.search(name) else ('זצ״ל' if name.startswith('הרב ') else 'זיע״א')
    month = it['date']['month']
    policy = 'adar2' if month == 'Adar' else None
    src = link_for(it['raw'])
    rid = 'owner-' + re.sub(r'[^a-z0-9]+', '-', str(abs(hash(name + month + str(it['date']['day']))) % 10**10))
    accepted.append({
        'id': rid, 'displayNameHe': name.replace('"', '״'), 'canonicalNameHe': name, 'aliases': [], 'gender': 'f' if female else 'm', 'honorific': honor,
        'hebrewDate': {'day': it['date']['day'], 'month': month, 'leapYearPolicy': policy}, 'deathYearHebrew': it['date'].get('yearHe'),
        'dateType': 'traditional_yahrzeit' if not it['date'].get('yearHe') else 'documented_death', 'tradition': '', 'region': '', 'famousTier': 'B',
        'sources': [{'name': 'רשימת בעל האפליקציה (הידברות / ישיבה)', 'url': src or '', 'says': it['raw']}],
        'verificationStatus': 'OWNER_LIST', 'conflictingDates': ([{'date': it['alt'], 'source': 'the owner list: "ויש אומרים"'}] if it.get('alt') else []),
        'notes': 'from the owner list' + ('; honorific by rule (not verified per person)' if honor != 'ע״ה' else '')})
json.dump({'group': 'owner-list', 'note': 'The owner\'s list (sources/yahrzeits/owner-list.rtf). Names already researched, list-internal repeats and unresolved dates are left out; see rejected.',
           'accepted': accepted, 'rejected': dropped + [{'name': c['list'], 'reason': 'date conflict with a researched record', 'notes': f"kept the researched date {c['existingDate']}"} for c in parsed['conflicts'] if not any(k in norm_q(c['list']) for k in map(norm_q, FROM_CONFLICTS)) and not re.search(r'משה רבנו|מלובביץ|מגן אברהם', c['list'])]},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('owner-list accepted', len(accepted), '| rejected', len(dropped))
