// Editorial decisions on top of the mechanical check (documented in the report).
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
const accepted = JSON.parse(readFileSync(`${DIR}accepted.json`, 'utf8'));
const DROP = new Set([
  'rema-eh-no-ketubat-benin-dikhrin',          // financial law
  'bih2-baghdad-seuda-mafseket-sugar',          // the author's household ("בביתנו"), not the city's custom
  'bih2-baghdad-rosh-hashana-silka',            // the author's household ("בביתנו")
  'wiki-iran-persian-jewish-dishes',            // the article marks this passage "דרוש מקור"
]);
// Triggers that were approximations or diaspora-only dates: the custom stays, tied to no day.
const UNTRIGGER = new Set(['wiki-italy-selichot-start', 'rema-oc-isru-chag', 'rema-oc2-pesach-last-day-dried-fruit', 'bih-haazinu-instead-shirat-hayam']);
const approx = t => (t.month === 2 || t.month === 8) && t.from === 1 && t.to === 15 || (t.month === 6 && t.from === 18) || (t.month === 7 && t.from === 3 && t.to === 9);
const out = [];
const log = [];
for (const record of accepted) {
  if (DROP.has(record.id)) { log.push(`drop ${record.id}`); continue; }
  // Bakashot are sung on winter nights only; a plain Shabbat trigger would show them all summer.
  const seasonal = /בקשות/.test(`${record.title} ${record.excerpt}`) && (record.calendarTriggers || []).some(t => t.weekday === 6);
  if (seasonal || UNTRIGGER.has(record.id) || (record.calendarTriggers || []).some(approx)) { log.push(`untrigger ${record.id} ${JSON.stringify(record.calendarTriggers)}`); record.calendarTriggers = []; }
  out.push(record);
}
writeFileSync(`${DIR}accepted.json`, JSON.stringify(out, null, 1));
console.log(log.join('\n')); console.log('kept', out.length);
