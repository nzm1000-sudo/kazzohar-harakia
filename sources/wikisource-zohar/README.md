# Hebrew Wikisource — ספר הזהר (Mantua pagination) with Yahel Ohr, Nefesh David and Beur HaGra on Sifra DeTzniuta

`scripts/library/build-zohar.mjs` builds the pack `public/library/packs/wikisource-zohar-cc-by-sa/` and the index module
`src/data/library/corpus/zohar.mjs`, and writes `provenance.json` here. Raw page text is not committed: every page is
pinned by revision id, so the build is reproducible from `oldid`s (`node scripts/library/build-zohar.mjs`; add
`--refresh` to re-pin the latest revisions, `--offline` to rebuild from a local cache).

- **Work:** ספר הזהר as printed in Mantua 1558–1560 (three volumes: I 1a–251a, II 2a–269a, III 2a–299b; 1,632 amud
  pages, of which III 116a–b are the printed title pages with no text). The Wikisource page `ספר הזהר` states that the
  Mantua print is the basis of its page numbers.
- **Source:** Hebrew Wikisource. One page per amud (`זהר חלק א ב א` …) transcludes named sections
  (`<קטע התחלה=דף ב א/>`) of the 29 parasha pages (`זוהר חלק א` … `זוהר חלק ל`); parashot come from
  `{{דפי הזהר לפרשה}}` on `זהר חלק א/ב/ג`. The builder reads them exactly as the site assembles them (labelled section
  transclusion, `<noinclude>` excluded). 1,673 pages in all, each with URL, revision id, `oldid` link and SHA-256 of the
  text in `provenance.json`.
- **Licence:** CC BY-SA 4.0 (Wikisource terms), https://creativecommons.org/licenses/by-sa/4.0/. The Mantua print and
  the 1882 commentaries are public domain; the licence covers the transcriptions. **Attribution and share-alike apply to
  this pack and the screens that show it — nothing else in the app.**
- **Attribution:** "ספר הזהר — העתקת ויקיטקסט העברי (דפוס מנטובה שי״ח–שי״ט), CC BY-SA 4.0", shown under the text in
  the reader and on the About page with the other three works.
- **Proofread status:** these are main-namespace transcriptions, not `Page:` scans, so Wikisource proofread levels do
  not apply (`proofread: "not-applicable"` on each page record). The category `זהר ללא ניקוד` marks the text unvocalized.
- **Changes:** markup only — editors' footnotes (`{{הערה}}`, 280), images (14), one site table and navigation removed;
  verse/page references kept in parentheses; emendations (`{{תיקון גירסה}}`, 9) kept as "(printed) [corrected]";
  ketiv/qere as "(ketiv) [qere]". Seven markup typos in the pinned revisions (six in the Zohar pages, one in Nefesh David) are repaired
  and listed in `provenance.json › markupRepairs` (each must match exactly once). Three quotation highlights left open
  on the page lose their opener only. Two named sections that the parasha pages do not
  define render as nothing on the site and are listed in `unresolvedSections`.
- **Honest coverage:** 1,630 of 1,630 pages with text are present; the pack is marked PARTIAL because the transcription
  itself marks incomplete passages (`{{להשלים}}`) on 22 pages (`coverage.incompletePassages`). Nothing was filled in.
- **Textual basis (flag for a rights reviewer):** the Wikisource talk page of `ביאור:זוהר מתורגם` (July 2026) records
  that the text was first typed from hebrew.grimoar.cz and has been corrected by volunteers partly after the Gra and the
  method of the Matok MiDvash edition; the discussion concluded it is a Wikisource edition that does not copy a
  protected one. Not a legal clearance.

## Commentaries in the pack

| Work | Taken from | Recorded licence | Used as | Anchored |
|---|---|---|---|---|
| יהל אור (הגר״א) | Sefaria `Yahel Ohr on Zohar` / "Vilna 1882" (source: he.wikisource `יהל_אור`) | PD | CC BY-SA 4.0 (the transcription is Wikisource's) | Volume/Daf = the Mantua page |
| ביאור הגר״א על ספרא דצניעותא | Sefaria `Beur HaGra on Sifra DeTzniuta` / "Wikisource" | Public Domain | CC BY-SA 4.0 (same reason) | Sefaria links → Zohar Daf alt-structure → page |
| נפש דוד (הרד״ל) | he.wikisource `נפש דוד (רד"ל)` (7 pages; Sefaria's copy is `unknown` and not used) | CC BY-SA 4.0 | CC BY-SA 4.0 | the page each heading names |

Pages past the end of a Mantua volume (Vilna's השמטות, e.g. I 264b) have no Zohar page in this pack; commentary on
them follows the addenda as its own node and is not anchored.

## Remote only (not in the bundle)

Ketem Paz ("Livorno, 1795"), Mikdash Melekh and its RaMaZ commentary ("Zholkva, 1864"), Or HaChamah ("Ohr Hachama,
Peremyshl, 1896-1898") — all recorded Public Domain on Sefaria, licence re-checked 2026-09-29. The reader fetches only
the registered edition (`/api/v3/texts/<ref>?version=hebrew|<versionTitle>`) and refuses any response whose edition or
licence differs.

## Not shipped: the Wikisource Hebrew translation

`ביאור:זוהר מתורגם` (Hakdama and I 15a–83a, 165 pages) is **BLOCKED**. Its translator wrote on the talk page that
parts are based on the Sulam (a protected translation). Details and measurements: `provenance.json › translation`.
