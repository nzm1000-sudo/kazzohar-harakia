# Offline audio packs ("הורדה לשימוש ללא רשת")

Code: `src/services/ambientAudio/offlinePacks.mjs` (manager), `packCatalog.mjs` (the catalogue — **empty today**), `capacitorFs.mjs` (files in `Directory.Data/audio-packs/<id>/`). Tests: `tests/hitbodedutPacks.test.mjs`.

The UI (`#leatzmi/hitbodedut/packs` and its link) appears **only when the catalogue has at least one valid pack**.

## Rules
- No download without explicit consent: `download(id, { consent: true })` — the UI asks first, showing the size and that files stay on the device.
- Progress (streamed when possible), total and per-pack storage used, delete.
- Size per file is checked; optional SHA-256 verified; a failed download leaves nothing behind.

## Manifest format (version 1)
```json
{
  "version": 1,
  "packs": [
    {
      "id": "tehillim-reading-a",
      "title": "תהילים בקריאה",
      "description": "קריאה שקטה של ספר תהילים",
      "license": "CC BY 4.0 — <reader name>",
      "version": "1.0.0",
      "bytes": 12345678,
      "files": [
        { "path": "001.m4a", "url": "https://…/001.m4a", "bytes": 123456, "sha256": "<64 hex>" }
      ]
    }
  ]
}
```
- `id`: lowercase letters, digits, dashes (2–48). `version`: x.y.z (a newer version shows as an update).
- `files[].path`: safe relative name with an audio extension (m4a, mp3, aac, ogg, opus, wav, caf); `url`: https only; `bytes`: positive integer; `sha256` optional.
- `bytes` (optional) must equal the sum of the files; a pack is at most 600 MB.
- An invalid pack is dropped entirely (never half-shown); `manager.errors` lists why.
