# מנוע הברכות — step 1: the blessing table of עונג שבת (chapter כ״ו, pp. 277–295), one row per food, from the printed PDF.
#
# The words of each line come from the book's own visual-order extraction (scripts/library/ong-shabbat/extract.py, the
# same lines the library was built from). What that step does not keep is where one food ends and the next begins; the
# printed table marks it by type: every entry opens with the food's name set in bold (Caligraph-Medium). So:
#   - a line whose first letter (rightmost) is bold opens a new entry,
#   - unless the line before it ended in bold — then the bold name itself wrapped onto this line (pp. 279, 289).
# The bold letters of every entry are kept, so the build can check that the name it cuts at the first dash is the bold name.
# Every page was also rendered and compared by eye (docs/halacha/blessings-engine.md, "Verification").
#
# The PDF is NOT stored in the repository (rights: author-permission; sources/ong-shabbat/provenance.json).
# Run with a throwaway environment, outside the repo:
#   python3 -m venv /tmp/ong-venv && /tmp/ong-venv/bin/pip install pymupdf==1.26.5
#   /tmp/ong-venv/bin/python scripts/library/ong-shabbat/extract.py <book.pdf> <lines.json>
#   /tmp/ong-venv/bin/python scripts/halacha/blessings/extract_table.py <book.pdf> <lines.json> sources/ong-shabbat/blessing-table.json
import fitz, json, re, sys, hashlib

PDF, LINES, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
FIRST, LAST = 277, 295
HE = re.compile(r'[א-ת]')
doc = fitz.open(PDF)
lines_by_page = json.load(open(LINES))
sha = hashlib.sha256(open(PDF, 'rb').read()).hexdigest()

def bold_letters(page):
    out = []
    for block in page.get_text('rawdict')['blocks']:
        if block['type'] != 0: continue
        for line in block['lines']:
            for span in line['spans']:
                bold = 'Medium' in span['font'] or 'Bold' in span['font']
                for ch in span['chars']:
                    if HE.match(ch['c']):
                        out.append((ch['c'], (ch['bbox'][1] + ch['bbox'][3]) / 2, (ch['bbox'][0] + ch['bbox'][2]) / 2, bold))
    return out

intro, rows, current, letter = None, [], None, None
for pno in range(FIRST - 1, LAST):
    page = doc[pno]
    glyphs = bold_letters(page)
    for line in lines_by_page[pno]['lines']:
        text = line['text'].strip()
        if line['y'] < 100 or re.fullmatch(r'-\d+-', text) or text in ('פרק כ"ו', 'לוח ברכות'):
            continue  # running head, page number, chapter title
        if line['size'] >= 20:
            letter = text  # the letter box (א׳, ב׳ …)
            continue
        on_line = sorted((g for g in glyphs if abs(g[1] - line['y']) < 4), key=lambda g: -g[2])
        mask = ''.join('B' if g[3] else '.' for g in on_line)
        bold = ''.join(g[0] for g in on_line if g[3])
        if intro is None and text.startswith('המקור לכל הברכות'):
            intro = {'text': text, 'pages': [pno + 1]}; current = intro; continue
        if current is intro and not mask.startswith('B'):
            intro['text'] += ' ' + text; continue
        opens = mask.startswith('B') and not (current is not None and current is not intro and current['_endsBold'])
        if opens:
            current = {'letter': letter, 'text': text, 'bold': bold, 'pages': [pno + 1], '_endsBold': mask.endswith('B')}
            rows.append(current)
        else:
            current['text'] += ' ' + text
            current['bold'] += bold
            current['_endsBold'] = mask.endswith('B')
            if pno + 1 not in current['pages']: current['pages'].append(pno + 1)

for n, row in enumerate(rows, 1):
    row.pop('_endsBold')
    row['n'] = n
json.dump({
    'work': 'עונג שבת', 'chapter': 'כ״ו', 'title': 'לוח ברכות', 'pages': f'{FIRST}–{LAST}', 'pdfSha256': sha,
    'method': 'scripts/library/ong-shabbat/extract.py lines + bold-name row starts (scripts/halacha/blessings/extract_table.py, PyMuPDF 1.26.5)',
    'intro': intro, 'rows': rows,
}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('rows', len(rows))
