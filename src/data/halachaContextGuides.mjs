// "מה חשוב לדעת עכשיו": for a day or season, the verified halachot in the order they are needed. Every item is an
// existing published entry (tests enforce it); a step may also offer the matching guided flow. The guide shown is the
// first one, in this order, whose context is active today.

const h = id => `hal-${id}`;

export const CONTEXT_GUIDES = [
  { id: 'tisha-bav', context: 'tisha-bav', title: 'תשעה באב', steps: [
    { label: 'מה אסור היום', entryIds: [h('moed-tb-five-prohibitions'), h('moed-tb-shoes'), h('moed-tb-torah-study')] },
    { label: 'מי פטור', entryIds: [h('moed-tb-pregnant-nursing'), h('moed-fast-sick')] },
    { label: 'סוף הצום', entryIds: [h('moed-tb-end')] },
  ] },
  { id: 'yom-kippur', context: 'aseret-yemei-teshuva', title: 'עשרת ימי תשובה', steps: [
    { label: 'בתפילה', entryIds: ['qa-hamelech-hakadosh', h('chag-forgot-zochrenu'), h('chag-avinu-malkenu-individual')], flowId: 'aseret-yemei-teshuva' },
    { label: 'סליחות', entryIds: [h('chag-selichot-not-before-chatzot'), h('chag-thirteen-middot-alone')] },
    { label: 'לקראת יום הכיפורים', entryIds: [h('chag-appease-before-yk'), h('chag-forgiveness-from-parents'), h('chag-kaparot-custom')] },
  ] },
  { id: 'pre-sukkot', context: 'pre-sukkot', title: 'לקראת סוכות', steps: [
    { label: 'בניית הסוכה', entryIds: [h('chag-build-sukkah-motzei-yk'), h('chag-sukkah-minimum-size'), h('chag-shade-more-than-sun'), h('chag-no-plastic-sechach')] },
    { label: 'ארבעת המינים', entryIds: [h('chag-buy-four-species-early'), h('chag-etrog-murkav-invalid')] },
    { label: 'ערב החג', entryIds: [h('chag-no-bread-erev-sukkot')] },
  ] },
  { id: 'sukkot', context: 'sukkot', title: 'סוכות', steps: [
    { label: 'בסוכה', entryIds: [h('chag-bread-kebeitza-sukkah'), h('chag-fruit-drinks-outside-sukkah'), h('chag-leshev-bracha-when'), h('chag-sleeping-in-sukkah'), h('chag-rain-leave-sukkah')] },
    { label: 'ארבעת המינים', entryIds: [h('chag-how-to-bless-lulav'), h('chag-lulav-bracha-every-day'), h('chag-no-meal-before-lulav')] },
    { label: 'בתפילה', entryIds: [h('prayer-tefillin-chol-hamoed'), h('chag-ledavid-hashem-ori')] },
  ] },
  { id: 'pesach-prep', context: 'pesach-prep', title: 'לקראת פסח', steps: [
    { label: 'בדיקת חמץ', entryIds: [h('moed-bedika-time'), h('moed-bedika-bracha'), h('moed-bedika-where'), h('moed-bitul-text')] },
    { label: 'מכירה וביעור', entryIds: [h('moed-mechira-rabbanut'), h('moed-chametz-time-eating'), h('moed-chametz-time-benefit'), h('moed-biur-burning')] },
    { label: 'הכשרת המטבח', entryIds: [h('moed-kasher-pots'), h('moed-kasher-oven'), h('moed-kasher-stove'), h('moed-kasher-sink-counter')] },
    { label: 'ערב פסח', entryIds: [h('moed-bechorot-fast'), h('moed-erev-matza-forbidden'), h('moed-erev-tenth-hour')] },
  ] },
  { id: 'chanukah', context: 'chanukah', title: 'חנוכה', steps: [
    { label: 'ההדלקה', entryIds: [h('chag-candle-lighting-time'), h('chag-how-many-candles-sephardim'), h('chag-candles-left-of-door'), h('chag-lighting-order-left-to-right'), h('chag-no-meal-before-lighting')] },
    { label: 'ערב שבת חנוכה', entryIds: [h('chag-friday-chanukah-before-shabbat'), h('chag-friday-chanukah-oil-amount')] },
    { label: 'בתפילה ובסעודה', entryIds: [h('chag-forgot-al-hanisim'), h('brachot-forgot-al-hanisim')] },
  ] },
  { id: 'purim', context: 'purim', title: 'פורים', steps: [
    { label: 'קריאת המגילה', entryIds: [h('chag-megila-night-and-day'), h('chag-women-megila')] },
    { label: 'מצוות היום', entryIds: [h('chag-matanot-laevyonim'), h('chag-mishloach-manot-two-foods'), h('chag-seudat-purim-bread')] },
    { label: 'בתפילה ובסעודה', entryIds: [h('chag-forgot-al-hanisim'), h('brachot-forgot-al-hanisim')] },
  ] },
  { id: 'fast-day', context: 'fast-day', title: 'יום צום', steps: [
    { label: 'זמני הצום', entryIds: [h('moed-fast-times')] },
    { label: 'מי פטור', entryIds: [h('moed-fast-pregnant'), h('moed-fast-sick'), h('moed-fast-pills')], flowId: 'fasts' },
    { label: 'בתפילה', entryIds: [h('moed-fast-anenu')] },
  ] },
  { id: 'nine-days', context: 'nine-days', title: 'תשעת הימים', steps: [
    { label: 'אכילה', entryIds: [h('moed-9d-meat'), h('moed-9d-chicken')] },
    { label: 'בבית', entryIds: [h('moed-9d-laundry-week'), h('moed-9d-hot-shower'), h('moed-9d-haircut-week')] },
  ] },
  { id: 'rosh-chodesh', context: 'rosh-chodesh', title: 'ראש חודש', steps: [
    { label: 'בתפילה', entryIds: [h('moed-rc-yaale-veyavo-reminder'), h('moed-rc-hallel-no-bracha'), h('prayer-tefillin-rosh-chodesh-musaf')], flowId: 'yaaleh-veyavo' },
    { label: 'בסעודה', entryIds: [h('brachot-forgot-yaale-rc')] },
    { label: 'במשך היום', entryIds: [h('moed-rc-women-work'), h('moed-rc-haircut')] },
  ] },
  { id: 'omer', context: 'omer', title: 'ספירת העומר', steps: [
    { label: 'הספירה', entryIds: [h('moed-omer-time'), h('moed-omer-bracha'), h('moed-omer-eating-before')], flowId: 'omer' },
    { label: 'מנהגי הימים', entryIds: [h('moed-omer-haircut'), h('moed-omer-music'), h('moed-omer-weddings')] },
  ] },
  { id: 'elul', context: 'elul', title: 'חודש אלול', steps: [
    { label: 'סליחות', entryIds: [h('chag-selichot-from-rosh-chodesh-elul'), h('chag-selichot-not-before-chatzot'), h('chag-eating-before-selichot')] },
    { label: 'בתפילה', entryIds: [h('chag-ledavid-hashem-ori')] },
  ] },
  { id: 'motzei-shabbat', context: 'motzei-shabbat', title: 'מוצאי שבת', steps: [
    { label: 'צאת השבת', entryIds: [h('shabbat-tzeit-shabbat'), h('shabbat-rabbeinu-tam')] },
    { label: 'לפני ההבדלה', entryIds: [h('shabbat-no-food-before-havdala'), h('shabbat-hamavdil-before-work')] },
    { label: 'ההבדלה', entryIds: [h('shabbat-havdala-order'), h('shabbat-no-spices'), h('shabbat-avuka')], flowId: 'kiddush-havdala' },
    { label: 'מלווה מלכה', entryIds: [h('shabbat-melaveh-malka'), h('shabbat-melaveh-malka-time')] },
  ] },
  { id: 'erev-shabbat', context: 'friday', weekdays: [5], title: 'ערב שבת', steps: [
    { label: 'במשך היום', entryIds: [h('shabbat-taste-food'), h('shabbat-prepare-yourself'), h('shabbat-big-meal-friday')] },
    { label: 'האוכל לשבת', entryIds: [h('shabbat-raw-meat-pot'), h('shabbat-oven-shabbat-mode'), h('shabbat-shehiya-open-flame')], flowId: 'shabbat-heating' },
    { label: 'לקראת הכניסה', entryIds: [h('shabbat-work-after-mincha'), h('shabbat-washing-machine-before')] },
    { label: 'הדלקת נרות', entryIds: ['qa-shabbat-candle-time', h('shabbat-earliest-time'), h('shabbat-bracha-before')], flowId: 'shabbat-candles' },
    { label: 'קידוש', entryIds: [h('shabbat-kiddush-before-washing'), h('shabbat-no-eating-before-kiddush')] },
  ] },
];
