# שלום רב — visual verification brief (for each reviewer)

The book `sources/shalom-rav/Sidur_16X11.pdf` is the source of truth. Its text was extracted from the PDF's glyphs
(`scripts/shalom-rav/extract.py`) and is almost entirely right; your job is to prove every line against the printed page
and to fix only what the page image contradicts.

## Material
- `sources/shalom-rav/review/pages/pNNN.txt` — the extracted text of printed page NNN, one printed line per numbered row:
  `NN [class] text`. Classes: heading (large title font), prose (the author's sans-serif explanations and instructions),
  pointed / bold (the prayer font). Lines are in reading order, top to bottom.
- Page images: `<python> scripts/shalom-rav/render.py <page> 3 4 <your scratch dir>` writes
  `page-<page>-1.png … page-<page>-3.png` (top, middle, bottom thirds at 4×). If anything is small or unclear, render
  again with more slices and a larger zoom, e.g. `render.py <page> 6 6 <dir>`, and read the crops.
  `<python>` = `/private/tmp/claude-501/-Users-nitz--cline-data-workspaces-chat-kazzohar-harakia-src/1be6d280-f805-440b-b73c-99040e1cd3e0/scratchpad/sr-venv/bin/python`
  (it has PyMuPDF). Run it from the repository root `/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia`.
- `sources/shalom-rav/review/flagged-words.txt` — words an automatic check could not confirm (`<page> <word> ~ <known
  spellings elsewhere>`). Check each one on your pages: does the extraction match the print?

## What to check, line by line
Letters; every point (vowels, dagesh, shin/sin dot, holam, hataf, meteg); punctuation (: , . ; — -); parentheses and
square brackets; geresh/gershayim (the file writes them ’ and ”) and quotation marks; numbers; word spacing (two words
glued, one word split); divine names (יְהֹוָה, יְיָ, ה’, and the pointed permutations such as יַהַוַהַ — character by
character); kabbalistic names and acronyms; Aramaic; that no printed line is missing, duplicated or out of order.

## Rules
1. Fix only what the image shows. Never "correct" the book to a standard text, a siddur, or memory. If the book itself
   has an apparent typo or an unusual pointing, it stays — record it under `bookNotes`, not as a correction.
2. A correction is an exact substring of that page's file text (`find`) and what the print shows (`replace`). Keep `find`
   short but unique on the page (a whole word or two). Use the same quote characters as the file (’ ”).
3. The order of points inside a letter does not matter (it is normalized); what matters is which letter carries them.
4. If you cannot read something with certainty even at high zoom, do not guess: mark the page `REVIEW_REQUIRED` and
   say exactly what and where.
5. Do not edit any other file in the repository. Write only your output file.

## Output
Write `sources/shalom-rav/review/review-<first>-<last>.json`:
```json
{ "pages": [ { "page": 21, "status": "VISUALLY_VERIFIED", "linesChecked": 23, "notes": "",
    "corrections": [ { "line": 7, "find": "…", "replace": "…", "reason": "print shows …" } ],
    "bookNotes": [ { "line": 12, "text": "…", "note": "as printed: …" } ] } ] }
```
`status` is `VISUALLY_VERIFIED` when every line was compared and is right after your corrections, else `REVIEW_REQUIRED`
with the reason in `notes`. Finish with a short summary: pages verified, corrections, book notes, anything unresolved.
