#!/usr/bin/env python3
# Build-time helper of the Bnei Zion ingestion pipeline (never shipped, never run by the app).
# Dumps every glyph a PDF page draws, with the ORIGINAL character code of its font, so the Node side can decode the
# legacy Hebrew font encodings (QFrank / QDavid / QMiriam: Windows-1255 letters + Latin code points for dagesh letters
# and vowel points, drawn in visual order) without trusting the PDF's ToUnicode maps, which are missing or broken for
# most of the bold faces in this archive.
#
# Usage: pdf_glyphs.py <file.pdf> [firstPage lastPage]   → JSON on stdout:
#   { pages: [ { w, h, glyphs: [[code, fontIdx, size, x0, x1, y0, y1, oy, color, flags, inkX0?, inkX1?], …] } ], fonts: [ {name, kind} ] }
#   code: the legacy byte (kind 'legacy') or a Unicode code point (kind 'unicode'); x0/x1 the advance box; inkX0/inkX1
#   where the glyph's outline is actually drawn (from the embedded font's glyf table) — what places a vowel point.
# Requires PyMuPDF and fontTools (install into a local venv: python3 -m venv venv && venv/bin/pip install pymupdf fonttools).
import io, json, re, sys

import fitz
from fontTools import agl
from fontTools.ttLib import TTFont


def font_code_table(doc, xref):
    """gid → (code, glyphName) for one embedded simple TrueType font, via its /Differences and embedded cmap."""
    obj = doc.xref_object(xref)
    names = {}
    m = re.search(r'/Encoding\s+(\d+)\s+0\s+R', obj)
    enc = doc.xref_object(int(m.group(1))) if m else obj
    d = re.search(r'/Differences\s*\[(.*?)\]', enc, re.S)
    if d:
        code = 0
        for tok in re.findall(r'/[^\s/\[\]]+|\d+', d.group(1)):
            if tok.startswith('/'):
                names[code] = tok[1:]
                code += 1
            else:
                code = int(tok)
    gid_to_code = {}
    ink = {}
    try:
        _, _, _, buf = doc.extract_font(xref)
        tt = TTFont(io.BytesIO(buf), lazy=True)
        for table in tt['cmap'].tables:
            for c, gname in table.cmap.items():
                c &= 0xFF if table.platformID == 3 and table.platEncID == 0 else 0xFFFF
                gid_to_code.setdefault(tt.getGlyphID(gname), c)
        # Ink extents of every glyph (font units → em): a vowel point's drawn position, independent of its advance box.
        if 'glyf' in tt:
            upm = tt['head'].unitsPerEm
            glyf = tt['glyf']
            for gname in tt.getGlyphOrder():
                g = glyf[gname]
                if getattr(g, 'numberOfContours', 0):
                    ink[tt.getGlyphID(gname)] = (g.xMin / upm, g.xMax / upm)
    except Exception:
        pass
    return names, gid_to_code, ink


def legacy_code(name):
    """Glyph name from /Differences → the legacy single-byte code the author typed (Windows code page position)."""
    m = re.fullmatch(r'c(\d+)', name)
    if m:
        return int(m.group(1)) - 272  # PrimoPDF names the bold faces c<code+272>
    m = re.fullmatch(r'(?:uni|u)([0-9A-Fa-f]{4,6})', name)
    if m:
        return int(m.group(1), 16)
    u = agl.toUnicode(name)
    if len(u) == 1:
        return ord(u)
    return None


def main():
    path = sys.argv[1]
    doc = fitz.open(path)
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    last = int(sys.argv[3]) if len(sys.argv) > 3 else doc.page_count
    fonts, font_index, tables = [], {}, {}
    pages = []
    for pno in range(first - 1, min(last, doc.page_count)):
        page = doc[pno]
        xref_by_name = {}
        for f in page.get_fonts(full=True):
            xref, _ext, _typ, base = f[0], f[1], f[2], f[3]
            xref_by_name.setdefault(re.sub(r'^[A-Z]{6}\+', '', base), xref)
        glyphs = []
        for span in page.get_texttrace():
            fname = span['font']
            xref = xref_by_name.get(fname)
            key = (xref, fname)
            if key not in font_index:
                font_index[key] = len(fonts)
                hebrew_unicode = False
                if xref and xref not in tables:
                    tables[xref] = font_code_table(doc, xref)
                names = tables.get(xref, ({}, {}, {}))[0]
                if any(re.fullmatch(r'afii57\d{3}|uni05[9-F][0-9A-F]', n) for n in names.values()):
                    hebrew_unicode = True
                fonts.append({'name': fname, 'kind': 'unicode' if hebrew_unicode else 'legacy'})
            fi = font_index[key]
            names, gid_to_code, ink = tables.get(xref, ({}, {}, {}))
            size = round(span['size'], 2)
            color = span.get('color')
            if isinstance(color, (list, tuple)):
                color = '%02x%02x%02x' % tuple(int(round(c * 255)) for c in (list(color) + [0, 0, 0])[:3])
            flags = span.get('flags', 0)
            for ch in span['chars']:
                ucs, gid, origin, bbox = ch[0], ch[1], ch[2], ch[3]
                code = None
                c = gid_to_code.get(gid)
                if c is not None and c in names:
                    code = legacy_code(names[c])
                if code is None and c is not None and c >= 32:
                    code = c
                if code is None:
                    code = ucs
                x0, y0, x1, y1 = bbox
                row = [code, fi, size, round(x0, 2), round(x1, 2), round(y0, 2), round(y1, 2), round(origin[1], 2), color, flags]
                if gid in ink:
                    row += [round(origin[0] + ink[gid][0] * size, 2), round(origin[0] + ink[gid][1] * size, 2)]
                glyphs.append(row)
        pages.append({'n': pno + 1, 'w': round(page.rect.width, 2), 'h': round(page.rect.height, 2), 'glyphs': glyphs})
    json.dump({'file': path, 'pageCount': doc.page_count, 'fonts': fonts, 'pages': pages}, sys.stdout, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
