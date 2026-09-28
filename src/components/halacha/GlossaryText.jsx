import { useMemo, useState } from 'react';
import { splitGlossary } from '../../services/halachaGlossaryText.mjs';

// An answer with its terms explained in place: tap a dotted term and a short note opens right below the text.
// The note is marked as a term explanation, separate from the source. Never used on source quotations.
export default function GlossaryText({ text, as: Tag = 'span', className }) {
  const parts = useMemo(() => splitGlossary(text), [text]);
  const [open, setOpen] = useState(null);
  const term = parts.find(part => part.term?.id === open)?.term;
  return <>
    <Tag className={className}>{parts.map((part, index) => part.term
      ? <button type="button" key={index} className={`gloss-term${open === part.term.id ? ' is-open' : ''}`} aria-expanded={open === part.term.id} onClick={() => setOpen(current => current === part.term.id ? null : part.term.id)}>{part.text}</button>
      : <span key={index}>{part.text}</span>)}</Tag>
    {term && <span className="gloss-note" role="note"><strong>{term.term}</strong> — {term.text}<small>הסבר מושג · אינו חלק מהמקור</small></span>}
  </>;
}
