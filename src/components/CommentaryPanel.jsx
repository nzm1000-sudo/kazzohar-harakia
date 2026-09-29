import { Fragment, useEffect, useState } from 'react';
import { useResource } from '../hooks.jsx';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';
import { groupByVerse, isParallel, layersAt, loadLayerUnits, loadRemoteLayerUnits } from '../services/library/relations.mjs';
import { commentariesAt, commentatorsOnVerse, hasVerseCommentaries } from '../services/torah/commentaries.mjs';
import { ResourceState } from './SourceReader.jsx';

// The מפרשים of every base text, in one place: the library's chapter reader (Tanakh, Mishnah, Zohar, Shulchan Arukh),
// its weekly-portion reader, the readings of פרשת השבוע (SourceReader) and שניים מקרא all show commentaries through
// PassageCommentaries: a row of commentator chips on top (only those with something in the passage), then the chosen
// commentator's text grouped under its verses. The last choice is remembered per reader family (Tanakh, Mishnah…).

export const labelNumeral = label => label ? label.replace(/'/g, '׳').replace(/"/g, '״') : null;
export function renderUnitText(text) {
  return fixHebrewTypography(text).split(/(\{[פס]\})/).map((part, index) => /^\{[פס]\}$/.test(part) ? <span key={index} className="library-break" aria-label={part === '{פ}' ? 'פרשה פתוחה' : 'פרשה סתומה'}>{part}</span> : part);
}

// ---------- The commentator choice ----------
export const ALL_COMMENTATORS = 'all';
const CHOICE_STORE = 'commentator-choice-v1';
export const commentatorName = layer => layer.title || layer.work.layerTitle || layer.work.shortTitle || layer.work.title;
function readChoices() {
  try { const saved = JSON.parse(localStorage.getItem(CHOICE_STORE) || '{}'); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; }
}
function writeChoice(readerKey, value) {
  try { localStorage.setItem(CHOICE_STORE, JSON.stringify({ ...readChoices(), [readerKey]: value })); } catch { /* private browsing / storage full: the choice lives for this session */ }
}
// The reader's last choice (a commentator's name, or "all"), remembered per reader family.
export function useCommentatorChoice(readerKey) {
  const [choice, setChoice] = useState(() => { const saved = readChoices()[readerKey]; return typeof saved === 'string' ? saved : null; });
  const choose = value => { setChoice(value); writeChoice(readerKey, value); };
  return [choice, choose];
}
// What the chips select: the chosen commentator when it has something here, otherwise the first available one.
export function selectedCommentator(layers, choice) {
  if (!layers.length) return null;
  if (choice === ALL_COMMENTATORS && layers.length > 1) return ALL_COMMENTATORS;
  return layers.some(layer => commentatorName(layer) === choice) ? choice : commentatorName(layers[0]);
}
export const shownCommentators = (layers, selected) => (selected === ALL_COMMENTATORS ? layers : layers.filter(layer => commentatorName(layer) === selected));

// ---------- Which commentators have something in a passage ----------
// A passage is { from: [chapter, verse], to: [chapter, verse] } of a base text (verse 0 / Infinity = the whole chapter),
// or one verse (mishnah, seif) in focus. Bundled Tanakh / Mishnah commentators are known per verse; the rest (a Zohar
// page, a Shulchan Arukh siman, a commentator read live from Sefaria) per chapter, as the registry records them.
export function passageChapters({ from, to }) {
  return Array.from({ length: Math.max(0, to[0] - from[0] + 1) }, (_, i) => {
    const node = from[0] + i;
    return { node, first: node === from[0] ? from[1] : 1, last: node === to[0] ? to[1] : Infinity };
  });
}
const commentaryLayersAt = (baseWorkId, node) => layersAt(baseWorkId, node).filter(layer => layer.relationType !== 'translation' && !isParallel(layer));
export function layersInChapter(baseWorkId, { node, first = 1, last = Infinity }, focusVerse = null, candidates = null) {
  const all = candidates || commentaryLayersAt(baseWorkId, node);
  if (focusVerse) {
    const here = new Set(commentariesAt({ workId: baseWorkId, section: node, segment: focusVerse }).map(entry => entry.workId));
    return all.filter(layer => here.has(layer.work.workId) || (layer.remote && hasVerseCommentaries(baseWorkId)));
  }
  if (!hasVerseCommentaries(baseWorkId) || (first <= 1 && last === Infinity)) return all;
  const found = new Set();
  // (The longest chapter, Psalms 119, has 176 verses; past a chapter's end the verse data answers nothing.)
  for (let verse = Math.max(1, first); verse <= Math.min(last, 200); verse += 1) commentatorsOnVerse(baseWorkId, node, verse).forEach(layer => found.add(layer.workId));
  return all.filter(layer => layer.remote || found.has(layer.work.workId));
}
// The commentators of the whole passage, once each, in their customary order.
export function passageCommentators(baseWorkId, passage, focus = null) {
  const byName = new Map();
  for (const chapter of passageChapters(passage)) {
    if (focus && focus.c !== chapter.node) continue;
    for (const layer of layersInChapter(baseWorkId, chapter, focus?.v || null)) if (!byName.has(commentatorName(layer))) byName.set(commentatorName(layer), layer);
  }
  return [...byName.values()];
}

// ---------- The chips ----------
export function CommentatorPicker({ layers, selected, onSelect, label = 'מפרשים' }) {
  if (layers.length < 2) return null;
  const chip = (value, text, remote = false) => <button key={value} type="button" role="tab" aria-selected={selected === value} className={`${selected === value ? 'on' : ''}${remote ? ' is-remote' : ''}`.trim() || undefined} onClick={() => onSelect(value)}>{text}</button>;
  return <div className="commentator-picker" role="tablist" aria-label={`בחירת ${label === 'מפרשים' ? 'מפרש' : label}`}>
    {layers.map(layer => chip(commentatorName(layer), commentatorName(layer), layer.remote))}
    {chip(ALL_COMMENTATORS, 'הכל')}
  </div>;
}

// Under a picked verse (mishnah): the commentators with a comment on it, each one tap from its own text.
export function VerseLayersLine({ layers, label, unitLabel, verse, onOpen }) {
  if (!layers.length) return null;
  return <p className="library-seif-layers library-verse-layers library-verse-chips" role="group" aria-label={`${label} על ${unitLabel} ${hebrewNumeral(verse)}: ${layers.map(layer => layer.title).join(', ')}`}>
    <span className="library-seif-layers-label" aria-hidden="true">{label}</span>
    {layers.map(layer => <button key={layer.workId} type="button" className={layer.remote ? "is-remote" : undefined} onClick={() => onOpen(layer.title)} aria-label={`${layer.title} על ${unitLabel} ${hebrewNumeral(verse)}`}>{layer.title}</button>)}
  </p>;
}

// ---------- One commentator's text on one chapter (page, siman) ----------
// Bundled layers from their pack, remote ones live from the provider in their registered edition. The text is shown as
// the edition has it; nothing is filled in. Comments are grouped under the verse (mishnah) they explain; with a verse in
// focus (or a range of verses) only those are shown, and a commentator with nothing there steps aside.
// The Shulchan Arukh's commentaries: each comment carries its printed number "(ג)"; a seif katan of several paragraphs
// keeps them; an introduction carries its title; groups are headed "סעיף ג׳"; a remote layer names its licence.
const skLabel = n => `(${hebrewNumeral(n).replace(/[׳״]/g, '')})`;
function LayerUnitText({ item }) {
  const paragraphs = item.text.split('\n');
  return <span>{item.title && <span className="library-unit-title">{fixHebrewTypography(item.title)}</span>}{paragraphs.length > 1
    ? paragraphs.map((text, index) => <span key={index} className="library-para library-para-p">{index === 0 && item.dh && <><strong className="library-dh">{fixHebrewTypography(item.dh)}</strong> </>}{renderUnitText(text)}</span>)
    : <>{item.dh && <><strong className="library-dh">{fixHebrewTypography(item.dh)}</strong> </>}{renderUnitText(item.text)}</>}</span>;
}
const REMOTE_LICENCE = { 'public-domain': 'נחלת הכלל', 'cc-by-sa': 'CC BY-SA 4.0 (ויקיטקסט)' };
export function LayerSection({ layer, node, verse = null, verses = null, unitLabel = 'פסוק', focus = null, titled = true }) {
  const work = layer.work;
  const resource = useResource(() => (layer.remote ? loadRemoteLayerUnits(layer, node) : loadLayerUnits(layer)), [work.workId, node]);
  // The comment a search result points to: brought into view and marked once its text is on the page.
  const focused = focus && resource.data?.some(item => item.id === focus) ? focus : null;
  useEffect(() => {
    if (!focused) return undefined;
    // After the other layers above it have laid out (their text arrives separately).
    const timer = setTimeout(() => document.getElementById(`layer-unit-${focused}`)?.scrollIntoView({ block: 'center' }), 350);
    return () => clearTimeout(timer);
  }, [focused]);
  const edition = work.editions[0];
  const narrowed = Boolean(verse || verses);
  const units = resource.data && narrowed ? resource.data.filter(item => (verse ? item.v === verse : item.v >= verses[0] && item.v <= verses[1])) : resource.data;
  if (units && !units.length && narrowed) return null;
  const groups = units ? groupByVerse(units) : [];
  const byVerse = groups.some(group => group.v);
  const numbered = ['סעיף קטן', 'סעיף'].includes(edition.unitLabel);
  const seifHead = v => (unitLabel === 'סעיף' ? `סעיף ${hebrewNumeral(v)}` : hebrewNumeral(v));
  return <section className="library-layer" aria-label={work.title}>
    {titled && <h2 className="library-layer-title">{work.layerTitle || work.shortTitle || work.title}</h2>}
    <ResourceState resource={resource} />
    {units && <div className="library-text library-layer-text" dir="rtl">{groups.map(group => <Fragment key={`${group.v}-${group.units[0].id}`}>
      {byVerse && !verse && group.v && <p className="library-layer-verse" aria-label={`${unitLabel} ${labelNumeral(group.units[0].vl) || hebrewNumeral(group.v)}`}><span>{group.units[0].vl ? `${unitLabel} ${labelNumeral(group.units[0].vl)}` : seifHead(group.v)}</span></p>}
      {group.units.map(item => <p key={item.id} id={`layer-unit-${item.id}`} className={`library-unit${numbered && !item.title ? ' library-unit-sk' : ''}${item.id === focused ? ' highlighted' : ''}`}>{item.fn && <sup className="library-fn library-fn-lead" aria-label={`הערה ${item.fn}`}>{item.fn}</sup>}{numbered && !item.title && <span className="library-sk" aria-label={`${edition.unitLabel} ${hebrewNumeral(item.n)}`}>{skLabel(item.n)}</span>}<LayerUnitText item={item} /></p>)}
    </Fragment>)}</div>}
    <p className="library-layer-source">{layer.remote ? `${work.layerTitle ? `${work.title} · ` : `${work.title}, `}${edition.heTitle} · ${REMOTE_LICENCE[edition.license] || 'נחלת הכלל'} · נטען מספריא בעת הקריאה` : edition.attribution?.text || edition.sourceLine || edition.heTitle}</p>
    {edition.license === 'cc-by-sa' && edition.attribution?.licenseUrl && <p className="library-layer-source"><a href={edition.attribution.licenseUrl} target="_blank" rel="noreferrer">תנאי הרישיון</a>{edition.attribution.url && <> · <a href={edition.attribution.url} target="_blank" rel="noreferrer">המקור</a></>}</p>}
  </section>;
}

// ---------- The מפרשים tab ----------
// passage: { from, to } (a chapter is { from: [n, 0], to: [n, Infinity] }); focusVerse: { c, v } narrows to one verse.
// choice / onChoose: the reader's remembered commentator (useCommentatorChoice). focus: a comment id to bring into view —
// its commentator is shown whatever the remembered choice.
export function PassageCommentaries({ baseWorkId, passage, focusVerse = null, onClearFocus = null, clearLabel = 'כל הפרק', unitLabel = 'פסוק', label = 'מפרשים', choice, onChoose, focus = null, candidates = null }) {
  const chapters = passageChapters(passage).filter(chapter => !focusVerse || chapter.node === focusVerse.c);
  const perChapter = chapters.map(chapter => ({ ...chapter, layers: layersInChapter(baseWorkId, chapter, focusVerse?.v || null, chapters.length === 1 ? candidates : null) }));
  const byName = new Map();
  perChapter.forEach(chapter => chapter.layers.forEach(layer => { if (!byName.has(commentatorName(layer))) byName.set(commentatorName(layer), layer); }));
  const available = [...byName.values()];
  const focusedLayer = focus ? available.find(layer => focus.startsWith(`${layer.work.workId}.`)) : null;
  const selected = selectedCommentator(available, focusedLayer ? commentatorName(focusedLayer) : choice);
  const shownNames = new Set(shownCommentators(available, selected).map(commentatorName));
  const many = perChapter.length > 1;
  return <div className="passage-commentaries">
    {focusVerse && <p className="library-verse-focus">{label} על {unitLabel} {hebrewNumeral(focusVerse.v)}{many || passage.from[0] !== passage.to[0] ? ` בפרק ${hebrewNumeral(focusVerse.c)}` : ''}{onClearFocus && <> · <button type="button" onClick={onClearFocus}>{clearLabel}</button></>}</p>}
    <CommentatorPicker layers={available} selected={selected} onSelect={onChoose} label={label} />
    {!available.length && <p className="library-layer-note">אין {label} על {focusVerse ? `ה${unitLabel} הזה` : 'הקטע הזה'} במכשיר.</p>}
    <div className="library-layers" role={available.length > 1 ? 'tabpanel' : undefined} aria-label={selected === ALL_COMMENTATORS ? `כל ה${label}` : selected || undefined}>
      {perChapter.map(chapter => {
        const layers = chapter.layers.filter(layer => shownNames.has(commentatorName(layer)));
        if (!layers.length) return null;
        const whole = chapter.first <= 1 && chapter.last === Infinity;
        // Over several chapters each opens under its own mark; one commentator chosen, its name is on the chip.
        return <section key={chapter.node} className="passage-commentaries-chapter" aria-label={many ? `פרק ${hebrewNumeral(chapter.node)}` : undefined}>
          {many && <p className="library-chapter-mark"><span>פרק {hebrewNumeral(chapter.node)}</span></p>}
          {layers.map(layer => <LayerSection key={`${chapter.node}-${layer.work.workId}`} layer={layer} node={chapter.node} verse={focusVerse?.v || null} verses={whole || focusVerse ? null : [chapter.first, chapter.last]} unitLabel={unitLabel} focus={focus} titled={!many || selected === ALL_COMMENTATORS || available.length < 2} />)}
        </section>;
      })}
    </div>
  </div>;
}
