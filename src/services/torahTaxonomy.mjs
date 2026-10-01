// The names the Torah content engine files its divrei torah under: the 54 parashot (canonical spelling of the "בני ציון"
// contract, docs/bnei-zion/SCHEMA.md, with every common variant as an alias), the festivals and the special Shabbatot.
// Pure data and matchers; the calendar itself comes from the app's context (dayContext / Hebcal items), never from here.

export const TORAH_BOOKS = Object.freeze([
  { id: 'bereshit', he: 'בראשית', parashot: ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי'] },
  { id: 'shemot', he: 'שמות', parashot: ['שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצווה', 'כי תשא', 'ויקהל', 'פקודי'] },
  { id: 'vayikra', he: 'ויקרא', parashot: ['ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקותי'] },
  { id: 'bamidbar', he: 'במדבר', parashot: ['במדבר', 'נשא', 'בהעלותך', 'שלח', 'קורח', 'חוקת', 'בלק', 'פינחס', 'מטות', 'מסעי'] },
  { id: 'devarim', he: 'דברים', parashot: ['דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'ניצבים', 'וילך', 'האזינו', 'וזאת הברכה'] },
]);
export const PARASHOT = Object.freeze(TORAH_BOOKS.flatMap(book => book.parashot));
export const bookOfParasha = name => TORAH_BOOKS.find(book => book.parashot.includes(name)) || null;

// Spelling variants (ktiv male / chaser, Hebcal's forms, the old app data) → the canonical name.
const VARIANTS = {
  'תצוה': 'תצווה', 'בחקתי': 'בחוקותי', 'בחקותי': 'בחוקותי', 'קרח': 'קורח', 'חקת': 'חוקת', 'פנחס': 'פינחס',
  'נצבים': 'ניצבים', 'כי תבא': 'כי תבוא', 'שלח לך': 'שלח', 'אחרי': 'אחרי מות', 'לך': 'לך לך', 'האזנו': 'האזינו',
  'הברכה': 'וזאת הברכה', 'בהעלתך': 'בהעלותך', 'מטת': 'מטות',
  // Hebcal's transliterations (a calendar item's English title).
  bereshit: 'בראשית', noach: 'נח', 'lech-lecha': 'לך לך', vayera: 'וירא', 'chayei sara': 'חיי שרה', toldot: 'תולדות', vayetzei: 'ויצא',
  vayishlach: 'וישלח', vayeshev: 'וישב', miketz: 'מקץ', vayigash: 'ויגש', vayechi: 'ויחי', shemot: 'שמות', vaera: 'וארא', bo: 'בא',
  beshalach: 'בשלח', yitro: 'יתרו', mishpatim: 'משפטים', terumah: 'תרומה', tetzaveh: 'תצווה', 'ki tisa': 'כי תשא', vayakhel: 'ויקהל',
  pekudei: 'פקודי', vayikra: 'ויקרא', tzav: 'צו', shmini: 'שמיני', tazria: 'תזריע', metzora: 'מצורע', 'achrei mot': 'אחרי מות',
  kedoshim: 'קדושים', emor: 'אמור', behar: 'בהר', bechukotai: 'בחוקותי', bamidbar: 'במדבר', nasso: 'נשא', "beha'alotcha": 'בהעלותך',
  behaalotcha: 'בהעלותך', "sh'lach": 'שלח', shlach: 'שלח', korach: 'קורח', chukat: 'חוקת', balak: 'בלק', pinchas: 'פינחס',
  matot: 'מטות', masei: 'מסעי', devarim: 'דברים', vaetchanan: 'ואתחנן', eikev: 'עקב', "re'eh": 'ראה', reeh: 'ראה', shoftim: 'שופטים',
  'ki teitzei': 'כי תצא', 'ki tavo': 'כי תבוא', nitzavim: 'ניצבים', vayeilech: 'וילך', haazinu: 'האזינו', "ha'azinu": 'האזינו',
  'vezot haberakhah': 'וזאת הברכה',
};
const clean = value => String(value || '')
  .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '') // nikud and te'amim (the maqaf, U+05BE, stays: it joins a combined reading)
  .replace(/^(?:Parashat|Parshat|פרשת|פרשיות)\s+/i, '')
  .replace(/[׳״"]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
const CANONICAL = new Map([...PARASHOT.map(name => [name, name]), ...Object.entries(VARIANTS)]);

/** One parasha name (any spelling, with or without "פרשת") → its canonical name, or null. */
export function canonicalParasha(name) {
  const key = clean(name);
  return key ? CANONICAL.get(key) || null : null;
}

/** A reading's name → its parashot: "תזריע־מצורע" / "Tazria-Metzora" → ['תזריע', 'מצורע']; a single parasha → [it]. */
export function parashotOfReading(name) {
  const key = clean(name);
  if (!key) return [];
  const whole = canonicalParasha(key);
  if (whole) return [whole];
  return key.split(/\s*[־–-]\s*/).map(canonicalParasha).filter(Boolean);
}

export const parashaIndex = name => PARASHOT.indexOf(canonicalParasha(name));
export const neighbourParashot = name => {
  const index = parashaIndex(name);
  return index < 0 ? { previous: null, next: null } : { previous: PARASHOT[index - 1] || null, next: PARASHOT[index + 1] || null };
};

// Festivals, in the order of the year (Tishrei first). Ids are the contract's.
export const HOLIDAYS = Object.freeze([
  ['elul', 'אלול'], ['rosh-hashana', 'ראש השנה'], ['yom-kippur', 'יום כיפור'], ['sukkot', 'סוכות'], ['hoshana-rabba', 'הושענא רבה'],
  ['shmini-atzeret', 'שמיני עצרת'], ['simchat-torah', 'שמחת תורה'], ['chanukah', 'חנוכה'], ['tu-bishvat', 'ט״ו בשבט'],
  ['purim', 'פורים'], ['pesach', 'פסח'], ['seventh-pesach', 'שביעי של פסח'], ['pesach-sheni', 'פסח שני'],
  ['lag-baomer', 'ל״ג בעומר'], ['shavuot', 'שבועות'], ['three-weeks', 'בין המצרים'], ['tisha-bav', 'תשעה באב'],
  ['tu-bav', 'ט״ו באב'], ['rosh-chodesh', 'ראש חודש'], ['yom-haatzmaut', 'יום העצמאות'], ['yom-yerushalayim', 'יום ירושלים'],
].map(([id, he]) => Object.freeze({ id, he })));
export const holidayLabel = id => HOLIDAYS.find(item => item.id === id)?.he || null;

export const SPECIAL_SHABBATOT = Object.freeze([
  ['shabbat-shuva', 'שבת שובה'], ['shabbat-shekalim', 'שבת שקלים'], ['shabbat-zachor', 'שבת זכור'], ['shabbat-parah', 'שבת פרה'],
  ['shabbat-hachodesh', 'שבת החודש'], ['shabbat-hagadol', 'שבת הגדול'], ['shabbat-chazon', 'שבת חזון'], ['shabbat-nachamu', 'שבת נחמו'],
].map(([id, he]) => Object.freeze({ id, he })));
export const specialShabbatLabel = id => SPECIAL_SHABBATOT.find(item => item.id === id)?.he || null;

// A calendar item (Hebcal's English title and Hebrew name) → the festival ids it is, most specific first
// ("Pesach VII" is שביעי של פסח, and still פסח). Erev days and Purim Katan are not the festival.
const HOLIDAY_MATCHERS = [
  [/rosh hashana|ראש השנה/i, ['rosh-hashana']],
  [/yom kippur|יום כיפור|יום הכפורים/i, ['yom-kippur']],
  [/hoshana raba|הושענא רבה/i, ['hoshana-rabba', 'sukkot']],
  [/simchat torah|שמחת תורה/i, ['simchat-torah', 'shmini-atzeret']],
  [/shmini atzeret|שמיני עצרת/i, ['shmini-atzeret', 'simchat-torah']],
  [/sukkot|סוכות/i, ['sukkot']],
  [/chanukah|hanukkah|חנוכה/i, ['chanukah']],
  [/tu bishvat|ט״ו בשבט|ט"ו בשבט/i, ['tu-bishvat']],
  [/shushan purim|purim|פורים/i, ['purim']],
  [/pesach sheni|פסח שני/i, ['pesach-sheni']],
  [/pesach vii|pesach viii|שביעי של פסח|פסח ז׳|פסח ח׳/i, ['seventh-pesach', 'pesach']],
  [/pesach|passover|פסח/i, ['pesach']],
  [/lag baomer|lag b'omer|ל״ג בעומר|ל"ג בעומר/i, ['lag-baomer']],
  [/shavuot|שבועות/i, ['shavuot']],
  [/tish.?a b.?av|תשעה באב/i, ['tisha-bav']],
  [/tu b.?av|ט״ו באב/i, ['tu-bav']],
  [/yom haatzma.?ut|יום העצמאות/i, ['yom-haatzmaut']],
  [/yom yerushalayim|יום ירושלים/i, ['yom-yerushalayim']],
];
const NOT_THE_FESTIVAL = /\berev\b|ערב |purim katan|פורים קטן|shabbat (?:shekalim|zachor|parah|hachodesh|hagadol|shuva|chazon|nachamu)/i;

export function holidayIdsFor(item) {
  if (!item || !['holiday', 'roshchodesh'].includes(item.category)) return [];
  const text = `${item.title || ''} ${item.hebrew || ''}`;
  if (NOT_THE_FESTIVAL.test(text)) return [];
  return HOLIDAY_MATCHERS.find(([pattern]) => pattern.test(text))?.[1] || [];
}

const SPECIAL_MATCHERS = [
  [/shabbat shuva|שבת שובה/i, 'shabbat-shuva'], [/shabbat shekalim|שבת שקלים/i, 'shabbat-shekalim'],
  [/shabbat zachor|שבת זכור/i, 'shabbat-zachor'], [/shabbat parah|שבת פרה/i, 'shabbat-parah'],
  [/shabbat hachodesh|שבת החודש/i, 'shabbat-hachodesh'], [/shabbat hagadol|שבת הגדול/i, 'shabbat-hagadol'],
  [/shabbat chazon|שבת חזון/i, 'shabbat-chazon'], [/shabbat nachamu|שבת נחמו/i, 'shabbat-nachamu'],
];
export function specialShabbatIdFor(item) {
  const text = `${item?.title || ''} ${item?.hebrew || ''}`;
  return SPECIAL_MATCHERS.find(([pattern]) => pattern.test(text))?.[1] || null;
}

// The kinds of divrei torah (contentType), the owner's list (docs/bnei-zion/SCHEMA.md); unknown values read as "דבר תורה".
// (short / deep / children / … are the app's own and the early fixture's words, kept readable.)
export const CONTENT_TYPES = Object.freeze({
  'dvar-torah': 'דבר תורה', story: 'סיפור', mashal: 'משל', chizuk: 'חיזוק', commentary: 'פירוש', family: 'לשולחן המשפחה', general: 'כללי',
  short: 'דבר תורה', deep: 'עיון', children: 'לילדים', halacha: 'הלכה', musar: 'מוסר', question: 'שאלה ותשובה', article: 'מאמר',
});
export const contentTypeLabel = type => CONTENT_TYPES[type] || 'דבר תורה';
// The three places of the weekly table and the groups of a collection:
//   story — a story, a mashal or one for the family (any length);  short — up to 3 minutes, any other kind;
//   deep  — a longer dvar torah or commentary (4 minutes and more).
export const STORY_TYPES = Object.freeze(['story', 'mashal', 'family', 'children']);
export const SHORT_MINUTES = 3;
export const SLOT_OF = meta => {
  if (STORY_TYPES.includes(meta.contentType)) return 'story';
  return (meta.readMinutes || 0) <= SHORT_MINUTES ? 'short' : 'deep';
};
export const SLOT_LABELS = Object.freeze({ story: 'סיפורים ומשלים', short: 'קצרים · עד 3 דקות', deep: 'לעיון · 4 דקות ומעלה', special: 'לשבת המיוחדת' });
export const minutesLabel = minutes => (Math.max(1, Math.round(minutes || 1)) === 1 ? 'דקה' : `${Math.max(1, Math.round(minutes))} דקות`);
