# -*- coding: utf-8 -*-
"""שלום רב — render one printed page of the book (or a vertical slice of it) for visual comparison.
Usage: python3 scripts/shalom-rav/render.py <printed page> [slices=3] [zoom=4] [outdir]
Writes <outdir>/page-<n>-<k>.png, top to bottom, each slice a readable strip of the printed page."""
import os, sys
import fitz
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
doc = fitz.open(os.path.join(ROOT, 'sources/shalom-rav/Sidur_16X11.pdf'))
n = int(sys.argv[1]); slices = int(sys.argv[2]) if len(sys.argv) > 2 else 3; zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 4
out = sys.argv[4] if len(sys.argv) > 4 else '.'
pdf = n // 2 + 1
page = doc[pdf - 1]; w, h = page.rect.width, page.rect.height
# even printed pages are the right half of the spread, odd pages the left (page 3 and 110 stand alone on the left)
x0, x1 = (w / 2, w) if n % 2 == 0 else (0, w / 2)
top, bottom = 15, h - 20
step = (bottom - top) / slices
os.makedirs(out, exist_ok=True)
for k in range(slices):
    clip = fitz.Rect(x0, top + k * step - (4 if k else 0), x1, top + (k + 1) * step + 4)
    page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip).save(os.path.join(out, 'page-%d-%d.png' % (n, k + 1)))
print('pdf page', pdf, '->', slices, 'slices in', out)
