// "Today" questions answered from the calendar the app already computes (JewishContextEngine / dayContext), never
// from search: "אומרים היום הלל?", "היום צום?", "היום ראש חודש?". The calendar facts come from the engine; any
// halacha shown with them is a verified entry.
import { activeContexts, CONTEXT_LABELS } from './halachaEngine.mjs';
import { normalizeQuery } from './halachaSearch.mjs';

const TODAY = /(?:^|\s)(היום|הערב|עכשיו|כעת|הלילה)(?:\s|$)/;
const TOPICS = [
  { kind: 'hallel', words: /הלל/ },
  { kind: 'tachanun', words: /תחנון|נפילת אפיים|נפילת אפים|וידוי/ },
  { kind: 'yaaleh', words: /יעלה ויבוא|יעלה ויבא/ },
  { kind: 'hanisim', words: /על הניסים|על הנסים/ },
  { kind: 'tefillin', words: /תפילין/ },
  { kind: 'fast', words: /צום|תענית|צמים/ },
  { kind: 'omer', words: /עומר|ספירה|סופרים/ },
  { kind: 'haircut', words: /להסתפר|תספורת|להתגלח|גילוח/ },
  { kind: 'rosh-chodesh', words: /ראש חודש|ר"ח/ },
  { kind: 'holiday', words: /חג|יום טוב|מועד/ },
];

// "עד מתי אפשר להניח תפילין?" is a time question, not a calendar one; "להביא תפילין?" is about today even without "היום".
const TIME_ASK = /(?:^|\s)ו?(עד מתי|ממתי|מתי אפשר|עוד אפשר|כבר אפשר|אפשר עוד|מאיזו שעה)(?:\s|$)/;
const TEFILLIN_TODAY = /(?:להביא|לקחת)\s+(?:את\s+)?(?:ה)?תפילין/;
const REMOVAL = /(?:מורידים|להוריד|חולצים|לחלוץ|מסירים)/;

// "שכחתי יעלה ויבוא היום" is a situation (what to do now), not a calendar question.
const SITUATION = /(?:^|\s)(שכחתי|טעיתי|נזכרתי|דילגתי|לא אמרתי|אמרתי בטעות)(?:\s|$)/;

export function detectTodayQuestion(query) {
  const text = normalizeQuery(query);
  if (SITUATION.test(text)) return null;
  if (/(?:^|\s)תפילין(?:\s|$)/.test(text) && TIME_ASK.test(text) && !REMOVAL.test(text)) return null;
  if (!TODAY.test(text) && !(TEFILLIN_TODAY.test(text) && !TIME_ASK.test(text))) return null;
  return TOPICS.find(topic => topic.words.test(text))?.kind || null;
}

const yes = (text, entryIds = [], extra = {}) => ({ answer: text, entryIds, ...extra });

// Returns { kind, answer, entryIds } from the day context, or null when the calendar is not available.
export function answerToday(kind, context = {}, now = new Date(), query = '') {
  if (!context?.hebrewDate) return null;
  const active = activeContexts(context, now);
  const date = context.hebrewDate?.label ? ` (${context.hebrewDate.label})` : '';
  const prayer = context.prayerContext || {};
  switch (kind) {
    case 'hallel': {
      const hallel = prayer.hallel || context.additions?.find(item => item.kind === 'hallel')?.text || null;
      if (!hallel) return yes(`היום${date} אין אמירת הלל בתפילה.`, ['hal-basic-hallel-full-or-no-bracha']);
      const ids = context.chanukah ? ['hal-basic-hallel-chanukah'] : active.has('rosh-chodesh') ? ['hal-basic-hallel-rosh-chodesh-dilug', 'hal-moed-rc-hallel-no-bracha'] : active.has('chol-hamoed') && active.has('pesach') ? ['hal-moed-chm-hallel', 'hal-basic-hallel-pesach-which-days'] : active.has('pesach') ? ['hal-basic-hallel-pesach-which-days'] : active.has('sukkot') || active.has('chol-hamoed') ? ['hal-basic-hallel-sukkot'] : ['hal-basic-hallel-full-or-no-bracha'];
      return yes(`היום${date} אומרים ${hallel}.`, ids);
    }
    case 'tachanun': {
      const omitted = Boolean(prayer.omitTachanun ?? context.omissions?.some(item => item.kind === 'tachanun'));
      const inNisan = /ניסן/.test(context.hebrewDate?.label || '') || active.has('pesach') || active.has('pesach-prep');
      const ids = !omitted ? ['hal-basic-tachanun-when']
        : active.has('rosh-chodesh') ? ['hal-basic3-rc-no-tachanun'] : inNisan ? ['hal-moed-nisan-no-tachanun'] : context.weekday === 5 ? ['hal-basic-tachanun-erev-shabbat-mincha', 'hal-basic-tachanun-days-skipped'] : ['hal-basic-tachanun-days-skipped'];
      return yes(omitted ? `היום${date} אין אומרים תחנון.` : `היום${date} אומרים תחנון כרגיל.`, ids);
    }
    case 'yaaleh': {
      const on = active.has('rosh-chodesh') || active.has('chol-hamoed') || context.isYomTov;
      const ids = !on ? [] : active.has('chol-hamoed') ? ['hal-basic-yaale-chol-hamoed', 'qa-yaaleh-veyavo'] : active.has('rosh-chodesh') ? ['hal-moed-rc-yaale-veyavo-reminder', 'qa-yaaleh-veyavo'] : ['qa-yaaleh-veyavo'];
      return yes(on ? `היום${date} אומרים יעלה ויבוא.` : `היום${date} אין אומרים יעלה ויבוא.`, ids);
    }
    case 'hanisim': {
      const on = context.chanukah || context.purim;
      return yes(on ? `היום${date} אומרים על הניסים.` : `היום${date} אין אומרים על הניסים.`, on ? [context.purim ? 'hal-basic-al-hanisim-purim' : 'hal-basic-al-hanisim-chanukah-arvit', 'hal-chag-forgot-al-hanisim'] : []);
    }
    case 'tefillin': {
      if (REMOVAL.test(normalizeQuery(query)) && active.has('rosh-chodesh')) return yes(`היום${date} ראש חודש.`, ['hal-prayer-tefillin-rosh-chodesh-musaf']);
      if (active.has('chol-hamoed')) return yes(`היום${date} חול המועד.`, ['hal-prayer-tefillin-chol-hamoed']);
      if (context.weekday === 6 || context.isYomTov) return yes(`היום${date} ${context.isYomTov ? 'יום טוב' : 'שבת'} – אין מניחים תפילין.`, ['hal-basic-tefillin-shabbat']);
      return yes(`היום${date} יום חול.`, ['qa-tefillin-until-when']);
    }
    case 'fast': {
      const fast = context.fast;
      return yes(fast ? `היום${date} ${fast.hebrew || 'יום צום'}.` : `היום${date} אינו יום צום.`, fast ? ['hal-moed-fast-times'] : []);
    }
    case 'omer': {
      if (!active.has('omer')) return yes(`היום${date} אינו בימי ספירת העומר.`, []);
      const label = context.omer?.hebrew || context.omer?.title || null;
      return yes(label ? `היום${date} בספירת העומר: ${label}.` : `היום${date} בימי ספירת העומר.`, ['hal-moed-omer-time']);
    }
    case 'haircut': {
      const seasons = ['omer', 'three-weeks', 'nine-days', 'chol-hamoed'].filter(key => active.has(key));
      if (!seasons.length) return yes(`היום${date} אינו בימים שיש לגביהם במאגר הלכות תספורת (ספירת העומר, בין המצרים, חול המועד).`, []);
      const ids = seasons.flatMap(key => ({ omer: ['hal-moed-omer-haircut'], 'three-weeks': ['hal-moed-9d-haircut-week'], 'nine-days': ['hal-moed-9d-haircut-week'], 'chol-hamoed': ['hal-moed-chm-haircut'] })[key]);
      return yes(`היום${date}: ${seasons.map(key => CONTEXT_LABELS[key]).join(', ')}.`, [...new Set(ids)]);
    }
    case 'rosh-chodesh':
      return yes(active.has('rosh-chodesh') ? `היום${date} ראש חודש.` : `היום${date} אינו ראש חודש.`, []);
    case 'holiday': {
      const name = context.specialDay?.hebrew || context.specialDay?.title || null;
      if (context.isYomTov) return yes(`היום${date} יום טוב${name ? `: ${name}` : ''}.`, []);
      if (active.has('chol-hamoed')) return yes(`היום${date} חול המועד${name ? `: ${name}` : ''}.`, []);
      return yes(name ? `היום${date}: ${name}.` : `היום${date} אינו חג.`, []);
    }
    default: return null;
  }
}
