# Content and License Register

Audit status: **not a legal clearance**. A human rights review must confirm the final editions, terms, attribution, and commercial distribution rights.

| Content or asset | Current source | Current evidence | Store status |
|---|---|---|---|
| Classical halacha references | Sefaria API and linked editions | Some catalog entries are marked Public Domain | Confirm each actual edition and attribution |
| Peninei Halakhah | Sefaria | Catalog marks `CC-BY-NC` | **Potential commercial distribution blocker**; obtain permission or exclude from store build |
| Talmud / William Davidson / Steinsaltz | Sefaria API | William Davidson Vocalized Aramaic and William Davidson Edition - Hebrew; both return `CC-BY-NC` | **No bundle; bounded attributed recent/pinned cache only, with commercial/store clearance unresolved** |
| Vilna page scans | Sefaria Manuscripts API or Wikimedia Commons fallback | Source URL and limited runtime metadata are retained | Confirm image license, attribution, and app redistribution terms |
| Tehillim | Repository `src/data/tehillim.json` | Shipped as the existing public-domain Tanakh source | Confirm provenance before store distribution |
| Siddur Edot HaMizrach | Existing Sefaria index/text responses | 121 leaves return `Shaliehsaboo Edition`, `CC0`; 8 leaves have no license metadata and are excluded from the bundle | Bundle only the 121 CC0 leaves; clear the remaining eight before redistribution |
| Brand and memorial imagery | Repository `public/branding` assets | Asset ownership/provenance not recorded here | Confirm permission before store screenshots and binary distribution |

## Required clearance record

For every displayed edition or image, retain the exact title, provider, source URL, license text, attribution, permission or public-domain basis, and whether commercial redistribution in an iOS/Android app is allowed. Do not rely on a generic provider-level statement when the API returns edition-specific metadata.

The app must not imply endorsement by Sefaria, Koren, Steinsaltz, Wikimedia Commons, or any source provider. Preserve attribution and link-back requirements in the native presentation.
