import { Fragment } from 'react';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';

// A block's words with its inline pieces (see services/prayer/prayerPresentation.mjs):
// a source, a paragraph marker, a response or a short direction inside the sentence keeps its own look.
const INLINE_CLASS = { reference: 'prayer-inline-reference', marker: 'prayer-inline-marker', response: 'prayer-inline-instruction', instruction: 'prayer-inline-instruction' };

export default function PrayerText({ block }) {
  if (!block.segments) return fixHebrewTypography(block.text);
  // A marker never ends a line alone: it is bound to the word after it by a no-break space.
  return block.segments.map((segment, index) => <Fragment key={index}>
    {index > 0 && (block.segments[index - 1].kind === 'marker' ? '\u00A0' : ' ')}
    {INLINE_CLASS[segment.kind] ? <span className={INLINE_CLASS[segment.kind]}>{fixHebrewTypography(segment.text)}</span> : fixHebrewTypography(segment.text)}
  </Fragment>);
}
