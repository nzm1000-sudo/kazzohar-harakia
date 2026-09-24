import { useEffect } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { getText, getShape } from '../services/sefaria.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import {
  SHNAYIM_MIKRA_PROGRESS_KEY, buildShnayimSequence, onkelosReference, parseTorahRange,
  shnayimProgressKey, verseReferences, weeklyParashaForShnayimMikra,
} from '../services/shnayimMikra.mjs';

async function loadVerse(reference) {
  const [mikra, targum] = await Promise.all([
    getText(reference, 'cantillation'),
    getText(onkelosReference(reference), 'source'),
  ]);
  return {
    reference,
    mikra: mikra?.hebrew?.[0] || '',
    onkelos: targum?.hebrew?.[0] || '',
  };
}

export default function ShnayimMikra({ context, onBack }) {
  const weekly = weeklyParashaForShnayimMikra(context);
  const range = parseTorahRange(weekly.reference);
  const shape = useResource(() => range ? getShape(range.book) : Promise.resolve(null), [range?.book]);
  const lengths = Object.fromEntries((shape.data?.lengths || shape.data?.chapters || []).map((length, index) => [index + 1, Array.isArray(length) ? length.length : length]));
  const refs = verseReferences(range, lengths);
  const resource = useResource(() => Promise.all(refs.map(loadVerse)), [refs.join('|')]);
  const [progress, setProgress] = useLocal(SHNAYIM_MIKRA_PROGRESS_KEY, {});
  const key = shnayimProgressKey(weekly.parasha);
  const saved = progress[key]?.verse || 0;
  const sequence = buildShnayimSequence(resource.data || []);
  useEffect(() => {
    if (!sequence.length) return;
    const node = document.getElementById(`shnayim-verse-${saved}`);
    node?.scrollIntoView({ block: 'center' });
  }, [resource.data, saved]);
  const remember = index => setProgress(value => ({ ...value, [key]: { verse: index, reference: sequence[index]?.reference || null } }));
  return <section className="shnayim-mikra" aria-label="שניים מקרא ואחד תרגום">
    <button type="button" className="local-back" onClick={onBack}>← חזרה לפרשה</button>
    <p className="eyebrow">שניים מקרא ואחד תרגום</p>
    <h1>{weekly.parasha?.hebrew || 'פרשת השבוע'}</h1>
    {weekly.festivalOverride && <p className="notice">בשבת זו קוראים קריאת חג. שניים מקרא נשאר על פרשת השבוע הקבועה, לא על קריאת החג.</p>}
    {!weekly.reference && <p className="notice">פרשת השבוע עדיין לא זמינה, ולכן אין מה להציג.</p>}
    {weekly.reference && !range && <p className="notice">טווח הפרשה אינו בפורמט מאומת, ולכן לא נבנה סדר פסוקים משוער.</p>}
    <ResourceState resource={resource} />
    {sequence.map(verse => <article className="shnayim-verse" id={`shnayim-verse-${verse.index}`} key={verse.reference}>
      <header><strong>{verse.label}</strong>{verse.index === saved && <small>המשך מכאן</small>}</header>
      {verse.blocks.map((block, index) => <p className={block.type === 'targum' ? 'shnayim-targum' : 'shnayim-mikra-text'} key={`${verse.reference}-${index}`}>
        {block.type === 'targum' && <span>תרגום אונקלוס</span>}
        {block.text}
      </p>)}
      <button type="button" onClick={() => remember(verse.index)}>שמירת מקום בפסוק זה</button>
    </article>)}
  </section>;
}
