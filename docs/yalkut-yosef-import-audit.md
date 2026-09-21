# Yalkut Yosef Import Audit

Source audited: the official Torat Emet HTML corpus for `f_01355`, titled `קיצור ש''ע ילקוט יוסף`, `מהדורת התשס''ז`, by `מו''ר הרב יצחק יוסף שליט''א`.

Source index: <https://www.toratemetfreeware.com/online/f_01355.html>

Audit date: 2026-03-31

## Counts and size

| Measure | Result |
|---|---:|
| Official part files | 87 |
| Raw downloaded HTML | 9.3 MB |
| Gzip archive of raw HTML | 2.0 MB |
| Generated local ESM data pack | 13 MB |
| Production JS chunk containing the pack | 14.1 MB (4.7 MB gzip) |
| Top-level chapter markers (`$@`) | 87 |
| Siman/section markers (`$~`) | 1,050 |
| Halacha markers (`$!--`) | 14,303 |

The source is small enough for a bundled offline pack after removing presentation markup and retaining the structured Hebrew text, headings, source anchors, and edition metadata.

## Structure

Each official part declares Windows-1255 encoding and contains:

- a repeated rights and attribution header;
- a top-level subject heading;
- siman or section headings;
- individual halacha blocks marked by stable source anchors;
- inline bracketed notes and source references;
- a generated table of contents linking to the same anchors.

The import keeps the source hierarchy and stable deterministic IDs derived from the official part number and source anchor. HTML styling, images, generated navigation markup, and temporary source-file comments are excluded. Hebrew text, headings, numbering, bracketed notes, and source references are retained.

## Integrity checks required by the importer

- Reject a part that does not contain its expected source title and edition metadata.
- Reject empty headings or empty halacha blocks.
- Require unique IDs across all imported units.
- Preserve the official part and anchor in every section record for traceability.
- Verify that decoded text contains Hebrew characters and does not contain replacement characters.
- Keep the book-specific rights notice in pack metadata and expose the license record from the reader.

## Known limitations

- The official files are legacy HTML rather than a modern JSON/XML schema.
- The Windows-1255 decoding step is required before parsing.
- Some headings are generated for navigation and may not be full grammatical sentences; they are presented as source headings, not rewritten summaries.
- The imported edition is the 2007 (`תשס"ז`) edition only. It must not be labeled as current, complete, or superseding later editions.

## Distribution decision

The official raw source compresses to approximately 2.0 MB; the generated ESM pack is 13 MB because records retain full text, headings, and traceability metadata, and the production chunk is 14.1 MB (4.7 MB gzip). This remains a bundled offline pack, but the size is intentionally disclosed for native-app review. The pack is not placed in the recent-content cache and does not require network access after installation. Its attribution and `CC BY-NC-SA 2.5` disclosure are part of the app's source details.