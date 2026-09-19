# Content and License Register

Audit status: **not a legal clearance**. A human rights review must confirm the final editions, terms, attribution, and commercial distribution rights.

| Content or asset | Current source | Current evidence | Store status |
|---|---|---|---|
| Classical halacha references | Sefaria API and linked editions | Some catalog entries are marked Public Domain | Confirm each actual edition and attribution |
| Peninei Halakhah | Sefaria | Catalog marks `CC-BY-NC` | **Potential commercial distribution blocker**; obtain permission or exclude from store build |
| Talmud / William Davidson / Steinsaltz | Sefaria API | Edition title and license are returned at runtime | **Unknown until exact edition rights are confirmed** |
| Vilna page scans | Sefaria Manuscripts API or Wikimedia Commons fallback | Source URL and limited runtime metadata are retained | Confirm image license, attribution, and app redistribution terms |
| Tehillim, siddur, and local editorial text | Repository data and app-authored UI | Review repository provenance and any included edition notices | Confirm public-domain/original status |
| Brand and memorial imagery | Repository `public/branding` assets | Asset ownership/provenance not recorded here | Confirm permission before store screenshots and binary distribution |

## Required clearance record

For every displayed edition or image, retain the exact title, provider, source URL, license text, attribution, permission or public-domain basis, and whether commercial redistribution in an iOS/Android app is allowed. Do not rely on a generic provider-level statement when the API returns edition-specific metadata.

The app must not imply endorsement by Sefaria, Koren, Steinsaltz, Wikimedia Commons, or any source provider. Preserve attribution and link-back requirements in the native presentation.
