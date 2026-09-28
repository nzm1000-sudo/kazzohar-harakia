// Halacha inside the Siddur: for each section of the Smart Siddur's day service, the verified halachot and guided
// flows that belong to it. The siddur shows one small link under the section heading; everything else opens on its
// own page, so the prayer text stays a prayer text. `time` names a prayer-time window to show (halachaTime.mjs);
// `today` entries/flows are listed first when that context is active today. Tests check every id.

const h = id => `hal-${id}`;

export const SIDDUR_HALACHA = {
  amida: {
    title: 'הלכות וטעויות בתפילת העמידה', short: 'הלכות העמידה', time: 'prayer',
    flows: ['prayer-forgot', 'yaaleh-veyavo', 'aseret-yemei-teshuva'],
    today: { 'rosh-chodesh': ['yaaleh-veyavo'], 'chol-hamoed': ['yaaleh-veyavo'], 'aseret-yemei-teshuva': ['aseret-yemei-teshuva'] },
    entryIds: [h('prayer-forgot-tal-umatar'), h('prayer-doubt-if-prayed'), h('prayer-kedusha-during-amida'), h('prayer-passing-in-front'), h('prayer-three-steps'), h('prayer-phone-ringing-amida')],
  },
  mussaf: {
    title: 'הלכות תפילת מוסף', short: 'הלכות מוסף',
    flows: ['yaaleh-veyavo'],
    entryIds: [h('prayer-tefillin-rosh-chodesh-musaf'), h('moed-rc-women-musaf'), h('moed-rc-forgot-yaale-after-musaf')],
  },
  shema: {
    title: 'הלכות קריאת שמע', short: 'הלכות קריאת שמע', time: 'shema',
    flows: [],
    entryIds: [h('prayer-shema-morning-deadline'), h('prayer-shema-after-deadline'), h('prayer-shema-kavana-first-verse'), h('prayer-shema-hand-over-eyes')],
  },
  hallel: {
    title: 'הלכות הלל', short: 'הלכות הלל', showHallel: true,
    flows: [],
    entryIds: [h('moed-rc-hallel-no-bracha'), h('moed-chm-hallel'), h('moed-rc-hallel-women'), h('chag-women-hallel-chanukah')],
  },
  'birkat-hamazon': {
    title: 'הלכות ברכת המזון', short: 'הלכות ברכת המזון',
    flows: ['prayer-forgot', 'yaaleh-veyavo'],
    entryIds: [h('brachot-forgot-retzeh'), h('brachot-forgot-yaale-rc'), h('moed-yt-birkat-yaale'), h('brachot-forgot-al-hanisim'), h('brachot-birkat-doubt-full'), h('brachot-birkat-until-when'), h('brachot-birkat-sit'), h('brachot-zimun-basic'), h('brachot-mayim-acharonim')],
  },
  talit: {
    title: 'הלכות טלית ותפילין', short: 'הלכות תפילין', time: 'tefillin',
    flows: [],
    entryIds: [h('prayer-tallit-before-tefillin'), h('prayer-tefillin-yad-before-rosh'), h('prayer-tefillin-one-bracha'), h('prayer-tefillin-no-talking-between'), h('prayer-tefillin-forgot-bracha')],
  },
  omer: {
    title: 'הלכות ספירת העומר', short: 'הלכות ספירת העומר',
    flows: ['omer'],
    entryIds: [h('moed-omer-time'), h('moed-omer-bracha'), h('moed-omer-doubt'), h('moed-omer-forgot')],
  },
  lulav: {
    title: 'הלכות נטילת לולב', short: 'הלכות הלולב',
    flows: [],
    entryIds: [h('chag-how-to-bless-lulav'), h('chag-lulav-bracha-every-day'), h('chag-no-meal-before-lulav')],
  },
};

// The day-service prayer ids → the prayer names halachaTime understands.
export const SIDDUR_PRAYER = { shacharit: 'shacharit', mincha: 'mincha', maariv: 'arvit', 'birkat-hamazon': null };
