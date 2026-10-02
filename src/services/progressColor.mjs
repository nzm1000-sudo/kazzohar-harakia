// The ONE colour of progress on "המעגל הרוחני" (owner, 2026-10-02): royal blue — never the ring's own gold, so the
// ribbon and its pointed tip read against the band in every palette. Used wherever the open circle's progress is shown:
// the ring on Today and on the circle page (SpiritualRing, CLAY build), the first-circle pill, and the native widgets
// (ios/App/KZWidgets/KZWidgets.swift › KZPalette.progress, android …/widget/KZWidgetProvider.java › PROGRESS_*).
// Light palettes take the royal blue itself; the two dark palettes (כהה, זהב לילי) and iOS/Android dark mode a slightly
// lighter royal blue, for the same contrast on a dark ground. tests/circleRound3.test.mjs keeps every copy equal.
export const PROGRESS = Object.freeze({
  light: '#2a55d0', // royal blue
  dark: '#789cf8', // the same royal blue, lifted for a dark ground
});

// The ribbon is a gentle gradient of that blue from the notch to the tip (deeper → brighter), and the spark at the tip
// a cool white light.
export const PROGRESS_RIBBON = Object.freeze({
  light: Object.freeze({ from: '#2347bd', to: '#325ddb' }),
  dark: Object.freeze({ from: '#6189f2', to: '#8fadfb' }),
});
