// Facts a user states in Hebrew, extracted deterministically: clock times, relative times, periods of the day,
// durations, amounts, who. Nothing here is halacha. Ambiguity is reported, never guessed: "בשלוש" with no
// morning/afternoon word is { ambiguous: true, options: [03:00, 15:00] }, and the reasoning layer asks — unless every
// reading leads to the same answer.

const NUMBER_WORDS = [
  ['שתים עשרה', 12], ['שתיים עשרה', 12], ['אחת עשרה', 11], ['אחד עשרה', 11],
  ['אחת', 1], ['שתיים', 2], ['שתים', 2], ['שלוש', 3], ['ארבע', 4], ['חמש', 5], ['שש', 6], ['שבע', 7], ['שמונה', 8], ['תשע', 9], ['עשר', 10],
];
const HOUR_WORD = NUMBER_WORDS.map(([word]) => word).join('|');
const MINUTE_WORDS = [['וחצי', 30], ['ורבע', 15], ['ועשרים', 20], ['ועשר', 10], ['וחמש', 5], ['וארבעים', 40]];
const clean = text => ` ${String(text || '').replace(/[֑-ׇ]/g, '').replace(/[־–—]/g, '-').replace(/[?!.,;]/g, ' ').replace(/\s+/g, ' ').trim()} `;

const PM_WORDS = /(אחה"צ|אחר הצהריים|אחרי הצהריים|צהריים|בערב|בלילה|ערב)/;
const AM_WORDS = /(בבוקר|לפנות בוקר|לפני הצהריים|בוקר)/;
// A time is introduced by ב / בשעה / בסביבות / בערך / עד ("עד ארבע").
const LEAD = '(?:ב-?|בשעה\\s*|בסביבות\\s*|סביבות\\s*|בערך\\s*|עד\\s*)';

// Periods of the day, for "אכלתי בשר אתמול בערב" (no clock time): [fromHour, toHour).
const PERIODS = [
  [/(?:מה|ב|אחרי ה)צהריים/, 12, 16, 'בצהריים'], [/בבוקר/, 6, 12, 'בבוקר'], [/בערב/, 18, 24, 'בערב'],
];

// Every time the user mentions, in order: [{ index, fact }]. A fact is
//   { kind: 'clock', hour, minute, ambiguous, options?, dayOffset, words }  (words: said in words, not digits)
//   { kind: 'relative', minutesAgo, dayOffset: 0 }  ("עכשיו", "לפני שעתיים")
//   { kind: 'invalid', raw }                        ("25:00")
// `hint`: earlier words of the conversation, used only for a morning/afternoon qualifier the message itself lacks.
export function extractTimes(text, hint = '') {
  const t = clean(text);
  const dayOffset = /\sאתמול\s/.test(t) ? -1 : 0;
  const found = [];
  const taken = [];
  const add = (index, length, fact) => { if (fact && !taken.some(([from, to]) => index < to && index + length > from)) { taken.push([index, index + length]); found.push({ index, fact }); } };
  // Morning/afternoon words next to the time (a little before it, or after it), else from earlier in the conversation.
  const qualifier = index => `${t.slice(Math.max(0, index - 25), index + 40)} ${hint && !PM_WORDS.test(t) && !AM_WORDS.test(t) ? clean(hint) : ''}`;
  for (const match of t.matchAll(new RegExp(`\\s${LEAD}?(\\d{1,2}):(\\d{2})(?=\\s)`, 'g'))) {
    const hour = Number(match[1]), minute = Number(match[2]);
    add(match.index, match[0].length, hour > 23 || minute > 59 ? { kind: 'invalid', raw: `${match[1]}:${match[2]}` } : clock(hour, minute, qualifier(match.index), dayOffset, { leadingZero: match[1].length === 2 && match[1].startsWith('0'), digital: true }));
  }
  for (const match of t.matchAll(/\sלפני\s+(חצי שעה|רבע שעה|שעה וחצי|שעה|שעתיים|(\d+(?:\.\d+)?)\s*(שעות|דקות|דק')|(שלוש|ארבע|חמש|שש|שבע|שמונה)\s*(שעות|דקות))(?=\s)/g)) {
    const phrase = match[1];
    const fixed = { 'חצי שעה': 30, 'רבע שעה': 15, 'שעה וחצי': 90, 'שעה': 60, 'שעתיים': 120 }[phrase];
    const count = match[2] ? Number(match[2]) : NUMBER_WORDS.find(([word]) => word === match[4])?.[1];
    const unit = match[3] || match[5];
    const minutesAgo = fixed !== undefined ? fixed : count ? (/שעות/.test(unit) ? count * 60 : count) : null;
    if (minutesAgo !== null) add(match.index, match[0].length, { kind: 'relative', minutesAgo, dayOffset: 0 });
  }
  for (const match of t.matchAll(new RegExp(`\\s${LEAD}?רבע ל(${HOUR_WORD})(?=\\s)`, 'g'))) {
    const hour = NUMBER_WORDS.find(([word]) => word === match[1])[1];
    add(match.index, match[0].length, clock(hour === 1 ? 12 : hour - 1, 45, qualifier(match.index), dayOffset, { words: true }));
  }
  for (const match of t.matchAll(new RegExp(`\\s${LEAD}(${HOUR_WORD})((?:\\s(?:${MINUTE_WORDS.map(([word]) => word).join('|')}))?)(?=\\s)`, 'g'))) {
    const hour = NUMBER_WORDS.find(([word]) => word === match[1])[1];
    const minute = MINUTE_WORDS.find(([word]) => match[2].trim() === word)?.[1] || 0;
    add(match.index, match[0].length, clock(hour, minute, qualifier(match.index), dayOffset, { words: true, noonWord: hour === 12 }));
  }
  for (const match of t.matchAll(/\s(?:ב-?|בשעה\s*|בסביבות\s*|עד\s*)(\d{1,2})(?=\s)(?!\s*(?:דקות|שעות|גרם|ק"מ|קמ|שנים|שנה|ימים))/g)) {
    add(match.index, match[0].length, clock(Number(match[1]), 0, qualifier(match.index), dayOffset, {}));
  }
  for (const match of t.matchAll(/\s(עכשיו|הרגע|כרגע|ממש עכשיו)(?=\s)/g)) add(match.index, match[0].length, { kind: 'relative', minutesAgo: 0, dayOffset: 0 });
  return found.sort((a, b) => a.index - b.index);
}

// The first stated time (a clock time wins over "עכשיו"), or null.
export function extractTime(text, now = new Date(), hint = '') {
  const all = extractTimes(text, hint);
  return (all.find(item => item.fact.kind !== 'relative' || item.fact.minutesAgo > 0) || all[0])?.fact || null;
}

// A part of the day stated without a clock time ("אתמול בערב"): { kind: 'period', from, to } as Dates, or null.
export function extractPeriod(text, now = new Date()) {
  const t = clean(text);
  const period = PERIODS.find(([pattern]) => pattern.test(t));
  if (!period) return null;
  const dayOffset = /\sאתמול\s/.test(t) ? -1 : 0;
  const at = hour => { const date = new Date(now); date.setHours(hour, 0, 0, 0); date.setDate(date.getDate() + dayOffset); return date; };
  const to = at(period[2]);
  const from = at(period[1]);
  // "בערב" said after midnight means last evening.
  if (!dayOffset && from > now) { from.setDate(from.getDate() - 1); to.setDate(to.getDate() - 1); }
  return { kind: 'period', from, to: to > now ? now : to, label: period[3], yesterday: dayOffset === -1 };
}

function clock(hour, minute, t, dayOffset, { leadingZero = false, digital = false, noonWord = false } = {}) {
  if (hour > 23 || minute > 59) return null;
  if (hour >= 13 || hour === 0 || leadingZero) return { kind: 'clock', hour, minute, ambiguous: false, dayOffset };
  if (PM_WORDS.test(t) && !(hour <= 4 && /בלילה/.test(t))) return { kind: 'clock', hour: hour === 12 ? 12 : hour + 12, minute, ambiguous: false, dayOffset };
  if (AM_WORDS.test(t) || (/בלילה/.test(t) && hour <= 4)) return { kind: 'clock', hour: hour === 12 ? 0 : hour, minute, ambiguous: false, dayOffset };
  // "12:40" and "בשתים עשרה" are noon; after midnight people write 00:40 or say "חצות".
  if (hour === 12 && (digital || noonWord)) return { kind: 'clock', hour: 12, minute, ambiguous: false, dayOffset };
  return { kind: 'clock', hour, minute, ambiguous: true, options: [{ hour: hour === 12 ? 0 : hour, minute }, { hour: hour === 12 ? 12 : hour + 12, minute }], dayOffset };
}

// A resolved time as a Date (relative to now), or null if ambiguous.
export function timeToDate(fact, now = new Date()) {
  if (!fact) return null;
  if (fact.kind === 'relative') return new Date(now.getTime() - fact.minutesAgo * 60000);
  if (fact.kind !== 'clock' || fact.ambiguous) return null;
  const date = new Date(now);
  date.setHours(fact.hour, fact.minute, 0, 0);
  if (fact.dayOffset) date.setDate(date.getDate() + fact.dayOffset);
  return date;
}

// The moments a stated time can mean, for an event the user describes.
//   tense 'past'  — "אכלתי ב…": a time later than now is yesterday's (just after midnight both halves of a 12-hour time
//                   are still possible), otherwise it is dropped;
//   tense 'if'    — "ואם אכלתי ב…": a hypothetical, both readings of today stay;
//   tense 'future'— "אני אוכל ב…": readings already past are dropped.
export function eventCandidates(fact, now = new Date(), tense = 'past') {
  if (!fact) return [];
  if (fact.kind === 'relative') return [timeToDate(fact, now)];
  if (fact.kind !== 'clock') return [];
  const options = fact.ambiguous ? fact.options : [{ hour: fact.hour, minute: fact.minute }];
  const dates = [];
  for (const option of options) {
    const date = new Date(now);
    date.setHours(option.hour, option.minute, 0, 0);
    if (fact.dayOffset) date.setDate(date.getDate() + fact.dayOffset);
    if (tense === 'past' && !fact.dayOffset && date > now) {
      if (!fact.ambiguous || now.getHours() < 6) date.setDate(date.getDate() - 1);
      else continue;
    }
    if (tense === 'future' && date < now) continue;
    dates.push(date);
  }
  return dates;
}

// Durations: "נסיעה של 40 דקות", "שעה וחצי", "שעתיים", "רבע שעה".
export function extractDuration(text) {
  const t = clean(text);
  const fixed = [['שעה וחצי', 90], ['שעתיים', 120], ['חצי שעה', 30], ['רבע שעה', 15], ['שעה ורבע', 75], ['שעה', 60]];
  const words = t.match(/\s(?:ב|של\s|תוך\s)?(חמש|שש|שבע|שמונה|תשע|עשר|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים)\s(דקות)\s/);
  const WORD_VALUES = { חמש: 5, שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10, עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50, שישים: 60, שבעים: 70, שמונים: 80, תשעים: 90 };
  if (words && !t.includes(` לפני ${words[1]} `)) return WORD_VALUES[words[1]];
  const numeric = t.match(/\s(\d+(?:\.\d+)?)\s*(דקות|דק'|שעות|שעה)\s/);
  if (numeric && !t.includes(` לפני ${numeric[1]} `)) return /שע/.test(numeric[2]) ? Number(numeric[1]) * 60 : Number(numeric[1]);
  for (const [phrase, minutes] of fixed) if (t.includes(` ${phrase} `) && !t.includes(` לפני ${phrase} `)) return minutes;
  return null;
}

// Who the question is about.
export function extractWho(text) {
  const t = clean(text);
  if (/\s(ה?ילד|ה?ילדה|ה?ילדים|תינוק|קטן|קטנה|בני|בתי|לבן שלי|הבן שלי|הבת שלי|לבת שלי|לילד|לילדה|הקטן|הקטנה)\s|\s(?:ה|ל)?(?:בן|בת)\s(?:שלי\s)?(?:[1-9]|1[0-2])\s/.test(t)) return 'child';
  if (/\s(חולה|חלש|חלשה|שפעת|חום גבוה)\s/.test(t)) return 'sick';
  return null;
}

export const formatHM = date => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
