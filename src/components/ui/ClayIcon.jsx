import { useId } from 'react';

// CLAY · the moulded icon set (docs/design-system.md › CLAY › Icons). One drawing per category, in round 1.9 strokes on a
// 24 grid, made three-dimensional the way the material is — one light from the upper left:
//   1. a soft shadow of the drawing, a little to the lower right (--clay-icon-shadow);
//   2. the drawing itself in a gradient from the light colour (upper left) to the ink (lower right);
//   3. a bright inner edge: the drawing's own top-left rim, left uncovered by the body moved half a unit down-right.
// The colours are the theme's (--clay-icon-hi, --clay-icon-ink, --clay-icon-shadow; styles/clay/tokens.css), so every
// palette gets its own copper. Decorative: the button around it carries the name (aria-hidden here).
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const dot = (x, y, w = 2.7) => ({ d: `M${x} ${y}h.01`, w });

export const CLAY_GLYPHS = {
  today: ['M4.6 10.9 12 4.8l7.4 6.1v8.2a1.3 1.3 0 0 1-1.3 1.3h-3.6v-5.6h-5v5.6H5.9a1.3 1.3 0 0 1-1.3-1.3z'],
  calendar: ['M6.6 5.5h10.8a2.6 2.6 0 0 1 2.6 2.6v9.8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 17.9V8.1a2.6 2.6 0 0 1 2.6-2.6z', 'M4 10.2h16', 'M8.5 3.6v3.6M15.5 3.6v3.6', dot(8.6, 14), dot(12, 14), dot(15.4, 14), dot(8.6, 17.1), dot(12, 17.1)],
  tehillim: ['M6.6 4.4c.9 2.3.9 4.7 0 7.1v8.3h10.8v-8.3c-.9-2.4-.9-4.8 0-7.1', 'M6.8 7.4h10.4', 'M6.6 15h10.8', 'M9.6 7.4V15M12 7.4V15M14.4 7.4V15'],
  siddur: ['M5.6 18.8V6.1a2.1 2.1 0 0 1 2.1-2.1h10.7v13.1H7.7a2.1 2.1 0 0 0-2.1 2.1 2.1 2.1 0 0 0 2.1 2h10.7', 'M13.4 4v6.2l1.7-1.3 1.7 1.3V4'],
  times: ['M3.6 17.4h16.8', 'M7.4 17.4a4.6 4.6 0 0 1 9.2 0', 'M12 6.2v2.6M5.6 9.4l1.8 1.8M18.4 9.4l-1.8 1.8M3.6 13.9h2.2M18.2 13.9h2.2', 'M8.2 20.4h7.6'],
  halacha: ['M4.6 19.6V8.4a3.4 3.4 0 0 1 6.8 0v11.2z', 'M12.6 19.6V8.4a3.4 3.4 0 0 1 6.8 0v11.2z', 'M6.8 11.2h2.4M6.8 14.4h2.4M14.8 11.2h2.4M14.8 14.4h2.4'],
  books: ['M5 5.2h3v13.6H5z', 'M9.6 5.2h3v13.6h-3z', 'M14.5 6.4l2.9-.8 3 12.9-2.9.8z', 'M3.6 20.2h16.8'],
  talmud: ['M6.6 3.8h10.8a1.6 1.6 0 0 1 1.6 1.6v13.2a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 18.6V5.4a1.6 1.6 0 0 1 1.6-1.6z', 'M9.6 7.6h4.8v6.2H9.6z', 'M7.6 7.6v9M16.4 7.6v9', 'M9.6 16.6h4.8'],
  parasha: ['M7 5.6v12.8M17 5.6v12.8', 'M7 3.6v2M7 18.4v2M17 3.6v2M17 18.4v2', 'M7 6.6h10M7 17.4h10', 'M9.6 10h4.8M9.6 13h4.8'],
  otiyot: ['M7.4 5.6 16.6 18.4', 'M16.2 5.4c.7 2.5-.2 4.2-2.6 5', 'M7.8 18.6c-.7-2.5.2-4.2 2.6-5'],
  'shalom-rav': ['M19.4 4.6C13.5 5 9 9.2 7.6 15.8L6.2 20', 'M19.4 4.6c-.6 5.6-4.4 9.6-11 11.2', 'M12.4 11.4 9.6 14.2'],
  'personal-tools': ['M6.4 4.6h3.4a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8V6.4a1.8 1.8 0 0 1 1.8-1.8z', 'M14.2 4.6h3.4a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8h-3.4a1.8 1.8 0 0 1-1.8-1.8V6.4a1.8 1.8 0 0 1 1.8-1.8z', 'M6.4 12.4h3.4a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8v-3.4a1.8 1.8 0 0 1 1.8-1.8z', circle(15.9, 15.9, 3.1)],
  leatzmi: ['M5 19C5 11 10.5 5.4 19 5c0 8.5-5.5 14-14 14z', 'M5 19l8.4-8.4'],
  'mitzvot-journal': [circle(12, 12, 7.6), circle(12, 12, 1.7), 'M12 2.6v1.2'],
  about: [circle(12, 12, 8.4), 'M12 11.2v5.2', dot(12, 7.9)],
  settings: [circle(12, 12, 5.2), circle(12, 12, 2), 'M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7'],
  more: [dot(6, 12, 3), dot(12, 12, 3), dot(18, 12, 3)],
  compass: [circle(12, 12, 8.4), 'M12 6.6l2.1 5.4-2.1 5.4-2.1-5.4z'],
};

// The app's places and their icons (the dock, the "עוד" sheet, the section tiles).
export const CLAY_PLACE_ICON = Object.freeze({
  today: 'today', calendar: 'calendar', tehillim: 'tehillim', siddur: 'siddur', times: 'times', settings: 'settings',
  halacha: 'halacha', books: 'books', talmud: 'talmud', parasha: 'parasha', otiyot: 'otiyot', 'shalom-rav': 'shalom-rav',
  'personal-tools': 'personal-tools', leatzmi: 'leatzmi', 'mitzvot-journal': 'mitzvot-journal', about: 'about', more: 'more',
});

const parts = glyph => glyph.map(part => (typeof part === 'string' ? { d: part } : part));

export function ClayIcon({ name, size = 24, className = '' }) {
  const id = useId().replace(/:/g, '');
  const glyph = CLAY_GLYPHS[name];
  if (!glyph) return null;
  const draw = (paint, key) => <g key={key} fill="none" style={{ stroke: paint }} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {parts(glyph).map(({ d, w }, index) => <path key={index} d={d} strokeWidth={w} />)}
  </g>;
  return <svg className={`clay-icon clay-icon-${name}${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`ci-g${id}`} gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="20" y2="21">
        <stop offset="0" style={{ stopColor: 'var(--clay-icon-hi)' }} />
        <stop offset="1" style={{ stopColor: 'var(--clay-icon-ink)' }} />
      </linearGradient>
      <mask id={`ci-m${id}`} maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">{draw('#fff')}</mask>
    </defs>
    <g transform="translate(.6 .8)" opacity=".5">{draw('var(--clay-icon-shadow)')}</g>
    <g mask={`url(#ci-m${id})`}>
      {draw('var(--clay-icon-rim)', 'rim')}
      <g transform="translate(.5 .5)">{draw(`url(#ci-g${id})`, 'body')}</g>
    </g>
  </svg>;
}

export default ClayIcon;
