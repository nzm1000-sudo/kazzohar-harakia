# Hebrew Wikisource — Birnbaum, *HaSiddur HaShalem* (1949, Nusach Ashkenaz), page transcription

The files in `raw/` are the **unaltered** API responses for the Hebrew Wikisource pages this app uses, one JSON file
per page. `scripts/build-birnbaum-ashkenaz.mjs` reads them offline and writes `src/data/nusach/siddurAshkenazBirnbaum.mjs`
and `provenance.json`. The import notes and every change made on the way are in `docs/siddur/birnbaum-ashkenaz-import.md`.

- **Work:** הַסִּדּוּר הַשָּׁלֵם — *Daily Prayer Book: Ha-Siddur ha-Shalem*, translated and annotated by Paltiel (Philip)
  Birnbaum, Hebrew Publishing Company, New York, 1949. Nusach Ashkenaz.
- **Source:** Hebrew Wikisource (ויקיטקסט העברי), the Index
  [מפתח:Philip Birnbaum - ha-Siddur ha-Shalem (The Daily Prayer Book,1949).pdf](https://he.wikisource.org/wiki/%D7%9E%D7%A4%D7%AA%D7%97:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_(The_Daily_Prayer_Book,1949).pdf)
  (revision 2904888). Only the `עמוד:` (Page:) namespace is read — each page rendered at its pinned revision
  (`action=parse&oldid=…`), as the proofreaders checked it against the scan. Wikisource's assembled edition
  (`הסידור השלם (בירנבוים)/אשכנז`) is **not** used: it translates the directions, adds Land of Israel customs and edits
  the text.
- **Licence:** Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
  (Wikisource terms of use). The 1949 book is in the US public domain (copyright not renewed; Open Siddur's statement).
  **Attribution and share-alike apply** to these files, to the generated pack, and to the app sections that show it —
  nothing else in the app.
- **Attribution:** "הסידור השלם, פלטיאל בירנבוים (ניו יורק: בית ההוצאה העברי, 1949), נוסח אשכנז — העתקת ויקיטקסט העברי
  (עמודי ההגהה), CC BY-SA 4.0". Each page's contributors are in its history (`…&action=history`).
- **Fetched:** 2026-09-28/29 with `node scripts/build-birnbaum-ashkenaz.mjs --fetch` (MediaWiki API, descriptive
  User-Agent, `maxlag`, 2.5–3 s between requests and back-off on "too many requests").

## Files

- `index.json` — the Index page (wikitext, revision).
- `status.json` — the proofreading level of all 815 pages of the book: 133 validated, 274 proofread, 408 "without text"
  (the English facing pages). Every Hebrew page is proofread or validated.
- `page-<printed page>.json` — one per imported page: title, URL, page id, revision id and time, proofreading level,
  the wikitext, the rendered HTML, and the base pages (דפי יסוד) it transcludes with their revision ids.
- `base-*.json` — the four base pages whose sections the pages transclude (wikitext and revision): kaddish,
  kenisat-shabbat, keriat-hatorah, sof-hatefilah. They record the Wikisource editors' textual notes (`{{נוסח}}`,
  including Birnbaum's printed reading where the transcription differs); the text itself is taken from the rendered pages.
- `../provenance.json` — machine-readable: page → URL, revision, status, the pack sections that use it, what on it was
  not imported, and the textual notes.

Pages imported (printed page numbers; file page = printed + 25): 251, 253, 255, 367, 467–475, 477–533, 541–549 (odd
pages only, 43 in all).
