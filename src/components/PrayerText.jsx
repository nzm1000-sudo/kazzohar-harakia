import { Fragment } from 'react';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';

// A block's words; a source that interrupts them is set inline, small and muted (see prayerPresentation.mjs).
export default function PrayerText({ block }) {
  if (!block.segments) return fixHebrewTypography(block.text);
  return block.segments.map((segment, index) => <Fragment key={index}>
    {index > 0 && ' '}
    {segment.reference ? <span className="prayer-inline-reference">{fixHebrewTypography(segment.text)}</span> : fixHebrewTypography(segment.text)}
  </Fragment>);
}
