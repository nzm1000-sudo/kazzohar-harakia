# -*- coding: utf-8 -*-
"""שלום רב — an independent check of the extraction's pointing: the book quotes whole chapters of Tanakh (Tehillim,
Shir HaShirim); every pointed word found in the chapter by its letters must also match its points.
A difference is either an extraction error or the book's own reading — each is listed for the visual review."""
import json, re, sys, unicodedata
from collections import defaultdict
TEH = json.load(open('src/data/tehillim.json', encoding='utf-8'))['chapters']
PAGES = json.load(open('sources/shalom-rav/extracted/pages.json', encoding='utf-8'))['pages']
def canon(w):
    w = unicodedata.normalize('NFC', w)
    w = re.sub(r'[֑-ֽֿׅ֯ׄ]', '', w)           # cantillation, meteg, rafe
    w = re.sub(r'([א-ת])([ְ-ּׁׂ]*)ֹו(?![ְ-ּ])', r'\1\2וֹ', w)  # holam before vav
    w = re.sub(r'[^א-תְ-ׂ]', '', w)
    return unicodedata.normalize('NFC', w)
def letters(w): return re.sub(r'[^א-ת]', '', w)
def words(text): return [x for x in re.split(r'[\s־\-־]+', text) if letters(x)]
def check(ranges, chapters):
    bag = defaultdict(set)
    for ch in chapters:
        for v in ch:
            for w in words(v): bag[letters(canon(w))].add(canon(w))
    total = same = 0; diff = []
    for p in PAGES:
        if not any(a <= (p['printedPage'] or 0) <= b for a, b in ranges): continue
        for l in p['lines']:
            if l['cls'] == 'prose' or l['cls'] == 'heading': continue
            for w in words(l['text']):
                c = canon(w); k = letters(c)
                if len(k) < 3 or k not in bag or not re.search(r'[\u05b0-\u05bc]', c): continue
                total += 1
                if c in bag[k]: same += 1
                else: diff.append((p['printedPage'], w, sorted(bag[k])[:2]))
    return total, same, diff
if __name__ == '__main__':
    psalms = [TEH[n - 1] for n in (16, 32, 41, 42, 59, 77, 90, 105, 137, 150)]
    t, s, d = check([(100, 109)], psalms)
    print('Tikkun Klali psalms: %d words, %d identical (%.1f%%)' % (t, s, 100 * s / max(t, 1)))
    for x in d[:int(sys.argv[1]) if len(sys.argv) > 1 else 30]: print(' ', x)
    t2, s2, d2 = check([(47, 50)], [TEH[n - 1] for n in (20, 91, 83, 121, 130, 142)])
    print('Soldiers prayer psalms: %d words, %d identical (%.1f%%)' % (t2, s2, 100 * s2 / max(t2, 1)))
    for x in d2[:15]: print(' ', x)
