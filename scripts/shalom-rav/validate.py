# -*- coding: utf-8 -*-
"""שלום רב — pointing sanity check over extracted text: every letter cluster whose marks cannot be Hebrew.
Usage: python3 scripts/shalom-rav/validate.py [pages.json|entries.json] -> prints the suspicious lines."""
import json, re, sys
VOW = set('ְֱֲֳִֵֶַָֻ')
CL = re.compile(r'([א-ת])([֑-ׇ]*)')
def problems(text):
    out = []
    for m in CL.finditer(text):
        ch, marks = m.group(1), m.group(2)
        v = [c for c in marks if c in VOW]
        if len(v) > 1 and not (ch == 'ו' and len(v) == 2): out.append('two vowels ' + ch + marks)
        if ('ׁ' in marks or 'ׂ' in marks) and ch != 'ש': out.append('dot on ' + ch)
        if 'ּ' in marks and ch in 'אחערםןץ': out.append('dagesh in ' + ch)
        if marks.count('ּ') > 1: out.append('double dagesh')
    for w in re.findall(r'\S+', text):
        if re.match(r'^[֑-ׇ]', w): out.append('word starts with a mark ' + w)
    return out
if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'sources/shalom-rav/extracted/pages.json'
    d = json.load(open(path, encoding='utf-8'))
    n = 0
    for p in d['pages']:
        for l in p['lines']:
            pr = problems(l['text'])
            if pr:
                n += 1
                if '-v' in sys.argv: print(p['printedPage'], pr[:3], l['text'])
    print('suspicious lines:', n)
