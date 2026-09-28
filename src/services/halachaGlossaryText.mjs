// Finding glossary terms inside an answer (never inside a source quotation). Whole words only, one mark per term,
// longest form first so "ספק ברכות להקל" wins over "ספק ברכות".
import { HALACHA_GLOSSARY } from '../data/halachaGlossary.mjs';

const H = '[\\u0590-\\u05FF]';
const FORMS = HALACHA_GLOSSARY.flatMap(term => term.forms.map(form => ({ term, form }))).sort((a, b) => b.form.length - a.form.length);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Returns [{ text, term? }] segments covering the whole string.
export function splitGlossary(text) {
  const value = String(text || '');
  const marks = [];
  const used = new Set();
  for (const { term, form } of FORMS) {
    if (used.has(term.id)) continue;
    const match = new RegExp(`(?<!${H})[והבלמש]?(${escape(form)})(?!${H})`).exec(value);
    if (!match) continue;
    const start = match.index + match[0].length - match[1].length;
    const end = start + match[1].length;
    if (marks.some(mark => start < mark.end && end > mark.start)) continue;
    marks.push({ start, end, term });
    used.add(term.id);
  }
  marks.sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.start > at) parts.push({ text: value.slice(at, mark.start) });
    parts.push({ text: value.slice(mark.start, mark.end), term: mark.term });
    at = mark.end;
  }
  if (at < value.length) parts.push({ text: value.slice(at) });
  return parts;
}

export const findGlossaryTerms = text => splitGlossary(text).filter(part => part.term).map(part => part.term);
