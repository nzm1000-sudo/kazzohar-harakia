// The catalogue of downloadable audio packs (format: docs/leatzmi/offline-audio-packs.md). Empty for now — there are
// no recordings yet — so the download section stays hidden. Adding a pack is adding one object here (or, later,
// loading the same JSON shape from a signed, versioned URL), and the screen offers it with its size and licence.
export const PACK_MANIFEST = Object.freeze({ version: 1, packs: [] });
