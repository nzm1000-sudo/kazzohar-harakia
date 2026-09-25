# Content and License Register

Audit status: **not a legal clearance**. A human rights review must confirm the final editions, terms, attribution, and commercial distribution rights.

| Content or asset | Current source | Current evidence | Store status |
|---|---|---|---|
| Classical halacha references | Sefaria API and linked editions | Some catalog entries are marked Public Domain | Confirm each actual edition and attribution |
| Peninei Halakhah | Sefaria | Catalog marks `CC-BY-NC` | **Potential commercial distribution blocker**; obtain permission or exclude from store build |
| Talmud / William Davidson / Steinsaltz | Sefaria API | William Davidson Vocalized Aramaic and William Davidson Edition - Hebrew; both return `CC-BY-NC` | **No bundle; bounded attributed recent/pinned cache only, with commercial/store clearance unresolved** |
| Vilna page scans | Sefaria Manuscripts API or Wikimedia Commons fallback | Source URL and limited runtime metadata are retained | Confirm image license, attribution, and app redistribution terms |
| Tanakh verse search | Repository `src/data/tanakh.json`, generated from Tanach.us UXLC 2.5 (build 27.6, 31 Mar 2026) | Tanach.us License: all biblical Hebrew text may be viewed or copied without restriction; citation appreciated. Source: https://www.tanach.us/License.html | Bundling/local indexing permitted for the biblical Hebrew text; do not bundle Tanach.us site files, fonts, or look-and-feel |
| Tehillim reader | Repository `src/data/tehillim.json` | Existing bundled source retained for the reader; Tanach.us provenance is documented in the file metadata | Confirm provenance before store distribution |
| Siddur Edot HaMizrach | Existing Sefaria index/text responses | 121 leaves return `Shaliehsaboo Edition`, `CC0`; 8 leaves have no license metadata and are excluded from the bundle | Bundle only the 121 CC0 leaves; clear the remaining eight before redistribution |
| Kitzur Shulchan Aruch Yalkut Yosef, 2007 edition | Official Torat Emet corpus, book `f_01355` | Torat Emet catalog and detailed terms state `CC BY-NC-SA 2.5` for the non-Wikisource group; the book page retains the Rabbi Yitzhak Yosef rights notice | **Cleared for the free, non-commercial app only**; retain attribution, source notice, license terms, and share-alike disclosure; no commercial/store clearance |
| Brand and memorial imagery | Repository `public/branding` assets | Asset ownership/provenance not recorded here | Confirm permission before store screenshots and binary distribution |
| `@hebcal/core` 6.9.2 (calendar and zmanim library) | npm dependency, bundled into the app | `package.json` of the installed package declares `GPL-2.0` (checked 2026-09-24) | **Requires professional review before store distribution**: GPL-2.0 may oblige source availability for the distributed app; not removed |
| Weekday Mincha content pack | Generated from the bundled Siddur Edot HaMizrach leaves (Shaliehsaboo Edition, `CC0`) | Offsets and checksums only; canonical text unchanged | Covered by the Siddur Edot HaMizrach row above |

## Required clearance record

For every displayed edition or image, retain the exact title, provider, source URL, license text, attribution, permission or public-domain basis, and whether commercial redistribution in an iOS/Android app is allowed. Do not rely on a generic provider-level statement when the API returns edition-specific metadata.

The app must not imply endorsement by Sefaria, Koren, Steinsaltz, Wikimedia Commons, or any source provider. Preserve attribution and link-back requirements in the native presentation.
