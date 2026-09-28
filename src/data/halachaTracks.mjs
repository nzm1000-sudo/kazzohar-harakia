// Learning tracks: ordered paths through existing verified entries (nothing is duplicated). Each item is read on its
// own page; "למדתי" marks it. Tests check that every id is published and appears once per track.
const h = id => `hal-${id}`;

export const HALACHA_TRACKS = [
  { id: 'erev-shabbat', title: 'מתכוננים לשבת', subtitle: 'מיום שישי בבוקר ועד הקידוש', entryIds: [
    h('shabbat-taste-food'), h('shabbat-prepare-yourself'), h('shabbat-big-meal-friday'), h('shabbat-work-after-mincha'), h('shabbat-washing-machine-before'),
    h('shabbat-raw-meat-pot'), h('shabbat-oven-shabbat-mode'), h('shabbat-shehiya-open-flame'),
    'qa-shabbat-candle-time', h('shabbat-earliest-time'), h('shabbat-how-many-candles'), h('shabbat-bracha-before'), h('shabbat-forgot-bracha'),
    h('shabbat-kiddush-before-washing'), h('shabbat-no-eating-before-kiddush'),
  ] },
  { id: 'prayer-mistakes', title: 'טעויות נפוצות בתפילה', subtitle: 'מה עושים כששוכחים, ומתי חוזרים', entryIds: [
    'qa-yaaleh-veyavo', h('prayer-rc-yaale-before-modim'), h('prayer-rc-yaale-from-modim'), h('moed-rc-doubt-yaale'), h('moed-chm-yaale-amida'),
    'qa-hamelech-hakadosh', h('chag-hamelech-hamishpat'), h('chag-forgot-zochrenu'), h('prayer-forgot-tal-umatar'),
    h('prayer-doubt-if-prayed'), h('prayer-tashlumin-missed-shacharit'), h('moed-fast-anenu'),
  ] },
  { id: 'daily-brachot', title: 'ברכות ביום־יום', subtitle: 'מה מברכים, לפני ואחרי', entryIds: [
    'qa-banana-blessing', 'qa-rice-blessing', h('brachot-doubtful-fruit'), h('brachot-veg-soup'), h('brachot-cake-mezonot'),
    h('brachot-nefashot-shiur'), h('brachot-achilat-pras'), h('brachot-coffee-no-after'), h('brachot-seven-species-after'),
    h('brachot-mistake-adama-on-fruit'), h('brachot-doubt-bracha-rishona'),
  ] },
  { id: 'kosher-kitchen', title: 'מטבח כשר', subtitle: 'בשר וחלב, כלים ובדיקה', entryIds: [
    h('bayit-six-hours-meat-to-dairy'), h('bayit-count-from-end-of-meat'), h('bayit-meat-after-cheese'), h('bayit-milk-drink-then-meat'),
    h('bayit-glass-meat-dairy'), h('bayit-gas-stove'), h('bayit-oven-same-compartment'), h('bayit-one-sink'), h('bayit-egg-fried-in-meat-pan'),
    h('bayit-dairy-spoon-old-meat-pot'), h('bayit-blood-in-egg'), h('bayit-worms-in-cooked-dish'),
  ] },
  { id: 'rosh-chodesh', title: 'ראש חודש', subtitle: 'בתפילה, בסעודה ובמשך היום', entryIds: [
    h('moed-rc-yaale-veyavo-reminder'), 'qa-yaaleh-veyavo', h('prayer-rc-yaale-before-modim'), h('prayer-rc-yaale-from-modim'),
    h('moed-rc-hallel-no-bracha'), h('prayer-tefillin-rosh-chodesh-musaf'), h('brachot-forgot-yaale-rc'), h('moed-rc-women-work'), h('moed-rc-haircut'),
  ] },
  { id: 'omer', title: 'ספירת העומר', subtitle: 'הספירה ומנהגי הימים', entryIds: [
    h('moed-omer-time'), h('moed-omer-bracha'), h('moed-omer-eating-before'), h('moed-omer-forgot'), h('moed-omer-doubt'),
    h('moed-omer-women'), h('moed-omer-haircut'), h('moed-omer-music'), h('moed-omer-weddings'),
  ] },
  { id: 'shabbat-hotel', title: 'שבת בבית מלון', subtitle: 'נרות, קידוש, מעלית ומפתח', entryIds: [
    h('shabbat-guest-candles'), h('shabbat-electric-candles'), h('shabbat-kiddush-bmakom-seuda'), h('shabbat-elevator'), h('shabbat-house-key'),
    h('bayit-guest-untoveled'), h('bayit-restaurant-untoveled'),
  ] },
  { id: 'travel', title: 'בדרכים ובטיסה', subtitle: 'תפילת הדרך, תפילה בדרך והגומל', entryIds: [
    h('prayer-tefilat-haderech-shiur'), h('prayer-tefilat-haderech-flight'), h('prayer-tefilat-haderech-once-a-day'), h('prayer-airplane-direction'),
    h('prayer-mincha-on-bus'), h('prayer-shema-while-driving'), h('brachot-gomel-flight'), h('brachot-gomel-car'), h('bayit-pat-akum-bakery'), h('bayit-coffee-by-gentile'),
  ] },
];

export const HALACHA_TRACK_INDEX = Object.fromEntries(HALACHA_TRACKS.map(track => [track.id, track]));
