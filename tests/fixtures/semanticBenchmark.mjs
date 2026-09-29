// The semantic search benchmark: real queries against the real corpus. Every source id below was verified by reading the
// unit's own text (a grep of the corpus plus the engine's result pools, judged by hand) — never guessed; the test checks
// that every id exists and still holds the words it was chosen for. Pooling: the Stage-0 engine's results, a grep of
// the corpus, and (second round) the hybrid engine's first results — each new unit judged by reading it; seven were
// found relevant and added (yalkut 990 / 469 / 1109 / 931 / 12531, חפץ חיים ב:ז, טור 1550:5, שו״ע הרב 211:7 and 3:6,
// תשב״ץ קטן 547, באר היטב ב:ו, מ״ב עה:יא, four Talmud units that name השבת אבידה, and בן איש חי 359:1 —
// "אסור לו לברך בגילוי הראש, לא מהני ליה לכסות ראשו בידיו" — first misjudged from a truncated snippet, corrected on
// reading the whole unit).
// HELD_OUT below was written after the lexicon was frozen and is never used to tune it: it measures generalization.
//   id       — "<workId>.<node>.<unit>" (a pack unit; ילקוט יוסף is halacha.yalkut-yosef-tashz.1.<n>) or "answer:<id>"
//   grade    — 3 the source itself · 2 directly relevant · 1 relevant
//   route    — an exact reference: the reader route that must come first
//   contains — lexical queries: a result is also relevant (grade 1) when its text (nikud removed) matches every pattern
//   type     — exact-ref · keyword · word-order · modern-classical · question · abbreviation · spelling · low-overlap · no-result
const HALAV_DAGIM = {
  relevant: { 'answer:hal-bayit-fish-with-dairy': 3, 'halacha.yalkut-yosef-tashz.1.8398': 3, 'Ben_Ish_Hai.1866.1': 3, 'halacha.yalkut-yosef-tashz.1.8400': 2, 'halacha.yalkut-yosef-tashz.1.8377': 2, 'Mishneh_Torah__Forbidden_Foods.9.23': 1 },
  contains: ['חלב', '(^|[^א-ת])[ובלהמשד]{0,2}דג(ים|ה|י)?([^א-ת]|$)'],
};
const KIBUD = {
  relevant: { 'Shulchan_Arukh__Yoreh_Deah.240.1': 3, 'Mishneh_Torah__Rebels.6.1': 3, 'answer:hal-basic-kibbud-horim-actions': 3, 'Kitzur_Shulchan_Arukh.143.1': 3, 'Exodus.20.12': 3, 'Deuteronomy.5.16': 3, 'Bavli_Kiddushin.59.8': 2, 'Bavli_Kiddushin.59.9': 2, 'Bavli_Kiddushin.58.18': 2, 'Shulchan_Arukh__Yoreh_Deah.240.8': 2, 'Kitzur_Shulchan_Arukh.143.13': 1, 'Shulchan_Arukh__Yoreh_Deah.240.17': 1, 'halacha.yalkut-yosef-tashz.1.9537': 1, 'answer:hal-bayit-honor-after-death': 1 },
};
const LESHON_HARA = {
  relevant: { 'Mishneh_Torah__Human_Dispositions.7.2': 3, 'Kitzur_Shulchan_Arukh.30.2': 3, 'Chafetz_Chaim.3.1': 3, 'Chafetz_Chaim.1.17': 2, 'Chafetz_Chaim.4.13': 2, 'Chafetz_Chaim.28.1': 2, 'Chafetz_Chaim.56.1': 2, 'Mishneh_Torah__Human_Dispositions.7.5': 1, 'Kitzur_Shulchan_Arukh.30.5': 1, 'Chafetz_Chaim.25.2': 1, 'Chafetz_Chaim.2.7': 3 },
};
const AVEDA = {
  relevant: { 'Shulchan_Arukh__Choshen_Mishpat.259.1': 3, 'Mishneh_Torah__Robbery_and_Lost_Property.11.1': 3, 'Kitzur_Shulchan_Arukh.187.1': 3, 'Shulchan_Arukh__Choshen_Mishpat.260.9': 2, 'Shulchan_Arukh__Choshen_Mishpat.267.3': 2, 'Mishneh_Torah__Robbery_and_Lost_Property.13.1': 2, 'Mishneh_Torah__Robbery_and_Lost_Property.15.1': 2, 'Bavli_Bava_Metzia.54.2': 1, 'Bavli_Bava_Metzia.107.14': 1, 'Oneg_Shabbat.19.38': 1, 'Mishneh_Torah__Repentance.4.3': 1, 'answer:hal-basic3-found-chametz-street': 1, 'Tur.1550.5': 2, 'Bavli_Bava_Kamma.111.12': 1, 'Bavli_Bava_Metzia.59.14': 1, 'Rashi_on_Bava_Metzia.59.20': 1, 'Bartenura_on_Mishnah_Bava_Kamma.5.31': 1 },
};
const CHIMUM = {
  relevant: { 'answer:ong-9-21-a': 3, 'Oneg_Shabbat.9.21': 3, 'answer:qa-reheat-food-shabbat': 3, 'Oneg_Shabbat.9.22': 2, 'answer:qa-place-food-plata': 2, 'answer:hal-shabbat-return-to-plata': 2, 'Shulchan_Arukh__Orach_Chayim.318.4': 2, 'Shulchan_Arukh__Orach_Chayim.318.15': 2, 'Mishnah_Berurah.318.29': 2, 'Oneg_Shabbat.9.24': 2, 'answer:ong-9-24': 2, 'Oneg_Shabbat.9.23': 1, 'answer:ong-9-23': 1, 'halacha.yalkut-yosef-tashz.1.1356': 1, 'halacha.yalkut-yosef-tashz.1.1357': 1, 'halacha.yalkut-yosef-tashz.1.2805': 1, 'Shulchan_Arukh__Orach_Chayim.253.2': 1, 'answer:ong-9-19-b': 1 },
};

export const BENCHMARK = Object.freeze([
  // ---- exact references: the place itself, first ----
  { id: 'ref-genesis', type: 'exact-ref', query: 'בראשית א א', route: 'books/r/Genesis/1/1' },
  { id: 'ref-exodus', type: 'exact-ref', query: 'שמות כ יב', route: 'books/r/Exodus/20/12' },
  { id: 'ref-sa', type: 'exact-ref', query: 'שו״ע או״ח רסג א', route: 'books/r/Shulchan_Arukh__Orach_Chayim/263/1' },
  { id: 'ref-mb', type: 'exact-ref', query: 'מ״ב רסג ס״ק א', route: 'books/r/Mishnah_Berurah/263/1' },
  { id: 'ref-bavli', type: 'exact-ref', query: 'ברכות לז ע״ב', route: 'talmud/Berakhot/37b' },
  { id: 'ref-rambam', type: 'exact-ref', query: 'רמב״ם הלכות דעות ז ב', route: 'books/r/Mishneh_Torah__Human_Dispositions/7/2' },
  // ---- keywords (the words of the sources) ----
  { id: 'kw-halav-dagim', type: 'keyword', query: 'חלב ודגים', ...HALAV_DAGIM },
  { id: 'kw-ner-chanukah', type: 'keyword', query: 'נר חנוכה', relevant: { 'Bavli_Shabbat.41.2': 3, 'Abudarham.35.2': 2, 'Siddur_Rashi.312.1': 2 }, contains: ['(^|[^א-ת])[ובלהמשד]{0,2}נר([^א-ת]|$)', 'חנוכה'] },
  { id: 'kw-nefashot', type: 'keyword', query: 'בורא נפשות', relevant: { 'Mishnah_Berurah.207.3': 3 }, contains: ['בורא', 'נפשות'] },
  { id: 'kw-omer', type: 'keyword', query: 'ספירת העומר', relevant: { 'answer:hal-moed-omer-bracha': 3 }, contains: ['ספירת', 'העומר'] },
  { id: 'kw-kibud', type: 'keyword', query: 'כבוד אב ואם', ...KIBUD, contains: ['כ(י)?בוד', '(^|[^א-ת])[ובלהמשד]{0,2}אב([^א-ת]|$)', '(^|[^א-ת])ו?אם([^א-ת]|$)'] },
  // ---- word order ----
  { id: 'wo-dagim-vehalav', type: 'word-order', query: 'דגים וחלב', ...HALAV_DAGIM },
  { id: 'wo-dagim-behalav', type: 'word-order', query: 'דגים בחלב', ...HALAV_DAGIM },
  { id: 'wo-halav-im-dagim', type: 'word-order', query: 'חלב עם דגים', ...HALAV_DAGIM },
  // ---- modern Hebrew → the sources' words ----
  { id: 'mc-leshon', type: 'modern-classical', query: 'לדבר רע על אדם', ...LESHON_HARA },
  { id: 'mc-kibud', type: 'modern-classical', query: 'כיבוד הורים', ...KIBUD },
  { id: 'mc-aveda', type: 'modern-classical', query: 'להחזיר חפץ שנמצא', ...AVEDA },
  { id: 'mc-chimum', type: 'modern-classical', query: 'לחמם מרק בשבת', ...CHIMUM },
  { id: 'mc-kippah', type: 'modern-classical', query: 'ללכת בלי כיפה', relevant: { 'Shulchan_Arukh__Orach_Chayim.2.6': 3, 'Mishnah_Berurah.2.11': 3, 'answer:hal-prayer-bracha-bare-head': 3, 'Mishnah_Berurah.2.12': 2, 'Shulchan_Arukh__Orach_Chayim.91.3': 2, 'Shulchan_Arukh__Orach_Chayim.8.2': 1, 'Mishnah_Berurah.74.8': 1, 'Tashbetz_Katan.547.1': 3, 'halacha.yalkut-yosef-tashz.1.931': 3, 'Shulchan_Arukh_HaRav.3.6': 3, 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim.2.6': 2, 'Mishnah_Berurah.75.11': 1 } },
  // ---- natural Hebrew questions ----
  { id: 'q-yaaleh', type: 'question', query: 'שכחתי לומר יעלה ויבוא', relevant: { 'Shulchan_Arukh__Orach_Chayim.422.1': 3, 'answer:qa-yaaleh-veyavo': 3, 'Kitzur_Shulchan_Arukh.19.10': 3, 'answer:hal-moed-chm-yaale-amida': 2, 'answer:hal-moed-rc-forgot-yaale-after-musaf': 2, 'answer:hal-prayer-rc-yaale-before-modim': 2, 'answer:hal-prayer-rc-yaale-from-modim': 2, 'answer:hal-trk-rosh-chodesh-repeat-only-amida': 2, 'answer:hal-trk-rosh-chodesh-forgot-mincha-remembered-night': 2, 'answer:hal-brachot-forgot-yaale-rc': 2, 'answer:hal-moed-rc-yaale-birkat-hamazon': 2, 'answer:hal-moed-yt-birkat-yaale': 2, 'answer:hal-brachot-yt-birkat-fix': 2, 'answer:hal-trk-prayer-mistakes-rely-on-chazara': 2, 'answer:hal-trk-rosh-chodesh-woman-forgot-yaale': 2, 'answer:hal-chag-birkat-hamazon-rh-forgot': 1, 'Kitzur_Shulchan_Arukh.19.11': 2, 'Kitzur_Shulchan_Arukh.44.14': 2, 'Shulchan_Arukh__Orach_Chayim.424.1': 2, 'Mishnah_Berurah.114.32': 2, 'halacha.yalkut-yosef-tashz.1.525': 2, 'Shulchan_Arukh__Orach_Chayim.124.10': 1, 'Kitzur_Shulchan_Arukh.20.10': 1, 'Kitzur_Shulchan_Arukh.21.6': 1, 'Kitzur_Shulchan_Arukh.21.7': 1 } },
  { id: 'q-orez', type: 'question', query: 'מה מברכים על מאכל שעשוי מאורז', relevant: { 'answer:qa-rice-blessing': 3, 'Shulchan_Arukh__Orach_Chayim.208.7': 3, 'Kitzur_Shulchan_Arukh.52.17': 3, 'halacha.yalkut-yosef-tashz.1.699': 3, 'Ben_Ish_Hai.901.1': 2, 'Chayyei_Adam.52.11': 2, 'Mishnah_Berurah.208.26': 2, 'Bavli_Berakhot.71.7': 2, 'Bavli_Berakhot.71.12': 2, 'Rif_Berakhot.51.3': 2, 'answer:hal-brachot-rice-cakes': 2, 'halacha.yalkut-yosef-tashz.1.703': 1, 'answer:hal-trk-daily-brachot-rice-with-chicken': 1, 'Jerusalem_Talmud_Berakhot.33.17': 1, 'Mishnah_Berurah.208.25': 1 } },
  { id: 'q-chimum', type: 'question', query: 'אפשר לחמם אוכל נוזלי בשבת', ...CHIMUM },
  { id: 'q-safek', type: 'question', query: 'מה עושים כשלא בטוחים אם בירכתי', relevant: { 'Shulchan_Arukh__Orach_Chayim.209.3': 3, 'answer:hal-brachot-doubt-bracha-rishona': 3, 'halacha.yalkut-yosef-tashz.1.735': 3, 'halacha.yalkut-yosef-tashz.1.476': 3, 'halacha.yalkut-yosef-tashz.1.734': 2, 'answer:hal-trk-daily-brachot-doubt-after-bracha': 2, 'answer:hal-brachot-birkat-doubt-kezayit': 2, 'Shulchan_Arukh__Orach_Chayim.167.9': 2, 'Shulchan_Arukh__Orach_Chayim.67.1': 1, 'Ben_Ish_Hai.185.1': 1, 'Ben_Ish_Hai.855.2': 1, 'Ben_Ish_Hai.1154.1': 1, 'Chayyei_Adam.6.24': 1, 'halacha.yalkut-yosef-tashz.1.466': 1, 'halacha.yalkut-yosef-tashz.1.467': 1, 'halacha.yalkut-yosef-tashz.1.691': 1, 'halacha.yalkut-yosef-tashz.1.295': 1, 'halacha.yalkut-yosef-tashz.1.990': 2, 'halacha.yalkut-yosef-tashz.1.1109': 2, 'halacha.yalkut-yosef-tashz.1.469': 2 } },
  { id: 'q-kibud', type: 'question', query: 'איפה כתוב על כיבוד הורים', ...KIBUD },
  { id: 'q-leshon', type: 'question', query: 'אסור לדבר רע על אדם אפילו שזה אמת', ...LESHON_HARA },
  { id: 'q-aveda', type: 'question', query: 'מצאתי חפץ ברחוב', ...AVEDA },
  // ---- abbreviations ----
  { id: 'ab-bhmz', type: 'abbreviation', query: 'בהמ״ז יעלה ויבא', relevant: { 'Shulchan_Arukh__Orach_Chayim.424.1': 3, 'halacha.yalkut-yosef-tashz.1.525': 3, 'answer:hal-brachot-yt-birkat-fix': 3, 'answer:hal-moed-rc-yaale-birkat-hamazon': 3, 'answer:hal-brachot-forgot-yaale-rc': 3 }, contains: ['(ברכת המזון|בהמ"ז|ב"המז|בהמז)', 'יעלה'] },
  { id: 'ab-ks', type: 'abbreviation', query: 'ק״ש שעל המטה', relevant: { 'halacha.yalkut-yosef-tashz.1.1260': 3, 'answer:hal-basic-bedtime-hamapil-before-shema': 2, 'halacha.yalkut-yosef-tashz.1.1261': 2 }, contains: ['(קריאת שמע|ק"ש)', 'מ(י)?טה'] },
  { id: 'ab-lhr', type: 'abbreviation', query: 'לה״ר אפילו אמת', relevant: LESHON_HARA.relevant, contains: ['(לשון הרע|לה"ר)', 'אמת'] },
  // ---- spelling (plene / defective) ----
  { id: 'sp-aveda', type: 'spelling', query: 'השבת אבדה', relevant: { 'Shulchan_Arukh__Choshen_Mishpat.259.1': 3, 'Kitzur_Shulchan_Arukh.187.1': 3, 'Mishneh_Torah__Robbery_and_Lost_Property.11.1': 3, 'Oneg_Shabbat.19.38': 2 }, contains: ['השב', 'אב(י)?ד'] },
  { id: 'sp-kibud', type: 'spelling', query: 'כיבוד אב ואם', ...KIBUD, contains: ['כ(י)?בוד', '(^|[^א-ת])[ובלהמשד]{0,2}אב([^א-ת]|$)', '(^|[^א-ת])ו?אם([^א-ת]|$)'] },
  { id: 'sp-tefilin', type: 'spelling', query: 'תפלין של ראש', relevant: {}, contains: ['תפ(י)?לין', 'ראש'] },
  // ---- low lexical overlap ----
  { id: 'lo-basar-halav', type: 'low-overlap', query: 'כמה זמן מחכים בין בשר לחלב', relevant: { 'answer:hal-bayit-six-hours-meat-to-dairy': 3, 'Shulchan_Arukh__Yoreh_Deah.89.1': 3, 'Kitzur_Shulchan_Arukh.46.9': 3, 'Bavli_Chullin.207.6': 2, 'Bavli_Chullin.207.7': 2 } },
  { id: 'lo-kippah', type: 'low-overlap', query: 'לברך בלי כיסוי ראש', relevant: { 'answer:hal-prayer-bracha-bare-head': 3, 'Mishnah_Berurah.2.12': 3, 'Mishnah_Berurah.74.8': 2, 'Shulchan_Arukh__Orach_Chayim.74.2': 2, 'Mishnah_Berurah.25.27': 1, 'Shulchan_Arukh__Orach_Chayim.2.6': 1, 'Shulchan_Arukh_HaRav.211.7': 3, 'halacha.yalkut-yosef-tashz.1.12531': 1, 'Ben_Ish_Hai.359.1': 2 } },
  // ---- nothing to find: nothing is invented ----
  { id: 'none-quantum', type: 'no-result', query: 'מחשב קוונטי' },
  { id: 'none-instagram', type: 'no-result', query: 'אינסטגרם טיקטוק' },
]);

// Held-out natural questions (written after the lexicon was frozen; not used to tune it).
export const HELD_OUT = Object.freeze([
  { id: 'ho-chanukah-time', type: 'held-out', query: 'מתי מדליקים נרות חנוכה', relevant: { 'answer:hal-chag-candle-lighting-time': 3, 'Shulchan_Arukh__Orach_Chayim.672.1': 3, 'Kitzur_Shulchan_Arukh.139.10': 3 } },
  { id: 'ho-tzedaka', type: 'held-out', query: 'כמה צדקה צריך לתת', relevant: { 'Shulchan_Arukh__Yoreh_Deah.249.1': 3, 'Mishneh_Torah__Gifts_to_the_Poor.7.5': 3, 'Kitzur_Shulchan_Arukh.34.4': 3, 'answer:hal-bayit-maaser-kesafim': 2 } },
  { id: 'ho-hagala', type: 'held-out', query: 'איך מכשירים סירים לפסח', relevant: { 'answer:hal-moed-kasher-pots': 3, 'answer:hal-moed-kasher-frying-pan': 2, 'Shulchan_Arukh__Orach_Chayim.451.8': 2, 'Shulchan_Arukh__Orach_Chayim.451.3': 2, 'Shulchan_Arukh__Orach_Chayim.451.6': 1 } },
  { id: 'ho-mazik', type: 'held-out', query: 'שברתי חפץ של חבר צריך לשלם', relevant: { 'Mishnah_Bava_Kamma.2.6': 3, 'Shulchan_Arukh__Choshen_Mishpat.378.1': 3, 'Bartenura_on_Mishnah_Bava_Kamma.3.21': 1 } },
  { id: 'ho-tal-umatar', type: 'held-out', query: 'שכחתי לומר ותן טל ומטר', relevant: { 'answer:hal-prayer-forgot-tal-umatar': 3, 'Shulchan_Arukh__Orach_Chayim.117.5': 3, 'answer:hal-trk-prayer-mistakes-tal-umatar-arvit': 2, 'answer:hal-trk-prayer-mistakes-rely-on-chazara': 2, 'Kitzur_Shulchan_Arukh.19.8': 1 } },
]);

// ---------- Metrics ----------
const strip = text => String(text || '').replace(/[֑-ׇ]/g, '');
export const hitId = hit => (hit.answer ? `answer:${decodeURIComponent(hit.target.route.split('/')[2])}` : `${hit.workId}.${hit.place.node}.${hit.place.unit}`);
export function gradeOf(item, entry) {
  if (item.kind === 'reference') return entry.route && item.route === entry.route ? 3 : 0;
  const explicit = entry.relevant?.[item.id];
  if (explicit) return explicit;
  if (entry.contains && entry.contains.every(pattern => new RegExp(pattern).test(strip(item.text)))) return 1;
  return 0;
}
// The ranked list a user sees: the exact reference first (when there is one), then the results.
export function rankedOf(data) {
  const list = [];
  if (data.reference?.target?.route) list.push({ kind: 'reference', route: data.reference.target.route });
  for (const hit of data.results) list.push({ kind: 'hit', id: hitId(hit), text: `${hit.displayRef} ${hit.snippet?.text || ''}` });
  return list;
}
// → { top1, top5, rr10 } for one query (no-result queries: success when nothing complete is claimed).
export function scoreQuery(entry, data) {
  if (entry.type === 'no-result') { const ok = !data.results.length || data.results.every(hit => hit.partial); return { top1: +ok, top5: +ok, rr10: +ok }; }
  const ranked = rankedOf(data);
  const first = ranked.slice(0, 10).findIndex(item => gradeOf(item, entry) > 0);
  return { top1: first === 0 ? 1 : 0, top5: first >= 0 && first < 5 ? 1 : 0, rr10: first >= 0 ? 1 / (first + 1) : 0 };
}
export function summarize(rows) {
  const avg = (list, key) => (list.length ? list.reduce((sum, row) => sum + row[key], 0) / list.length : 0);
  const byType = {};
  for (const row of rows) (byType[row.type] ||= []).push(row);
  const pack = list => ({ n: list.length, top1: +avg(list, 'top1').toFixed(3), top5: +avg(list, 'top5').toFixed(3), mrr10: +avg(list, 'rr10').toFixed(3) });
  return { all: pack(rows), byType: Object.fromEntries(Object.entries(byType).map(([type, list]) => [type, pack(list)])) };
}
