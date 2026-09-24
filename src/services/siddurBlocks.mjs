import { classifyHebrewParagraph, removeNikud } from '../hebrewText.mjs';

// One normalization layer for every Siddur paragraph. JSX must not scatter
// text.includes checks — it renders the typed blocks this function returns.
const TYPE_CLASS = {
  heading: 'siddur-block-heading',
  instruction: 'siddur-block-instruction',
  rubric: 'siddur-block-rubric',
  recitedText: 'siddur-block-recited',
  conditionalAddition: 'siddur-block-addition',
  source: 'siddur-block-source',
};

const BRAKHA_ANCHORS = [
  { id: 'avot', pattern: /ברוך אתה .{0,12}אלהינו ואלהי אבותינו/ },
  { id: 'gevurot', pattern: /אתה גבור לעולם/ },
  { id: 'kedushat-hashem', pattern: /אתה קדוש ושמך קדוש/ },
  { id: 'daat', pattern: /אתה חונן לאדם דעת/ },
  { id: 'teshuvah', pattern: /השיבנו אבינו לתורתך/ },
  { id: 'selicha', pattern: /סלח לנו אבינו כי חטאנו/ },
  { id: 'geula', pattern: /ראה בעניינו|ראה נא בענינו/ },
  { id: 'refuah', pattern: /רפאנו ה׳ ונרפא|רפאנו יי ונרפא/ },
  { id: 'birkat-hashanim', pattern: /ברך עלינו .{0,40}השנה הזאת/ },
  { id: 'kibbutz-galuyot', pattern: /תקע בשופר גדול/ },
  { id: 'din', pattern: /השיבה שופטינו כבראשונה/ },
  { id: 'tzadikim', pattern: /על הצדיקים ועל החסידים/ },
  { id: 'yerushalayim', pattern: /ולירושלים עירך ברחמים תשוב|ולירושלים עירך/ },
  { id: 'david', pattern: /את צמח דוד עבדך/ },
  { id: 'retzeh', pattern: /רצה ה׳ אלהינו בעמך ישראל|רצה יי אלהינו בעמך ישראל/ },
  { id: 'modim', pattern: /מודים אנחנו לך/ },
  { id: 'shalom', pattern: /שים שלום טובה וברכה/ },
];

const ANCHOR_BY_KIND = {
  'yaaleh-veyavo': 'retzeh',
  'al-hanissim': 'modim',
  'mashiv-haruach': 'gevurot',
  'morid-hatal': 'gevurot',
  'veten-tal-umatar': 'birkat-hashanim',
  'hamelech-hakadosh': 'kedushat-hashem',
};

const plain = text => removeNikud(text).replace(/[״׳"']/g, '').replace(/\s+/g, ' ');

export function detectBrakhaAnchor(text) {
  const value = plain(text);
  return BRAKHA_ANCHORS.find(anchor => anchor.pattern.test(value))?.id || null;
}

export function normalizeSiddurBlocks(paragraphs = [], { title = '', additions = [] } = {}) {
  const blocks = [];
  paragraphs.forEach((raw, index) => {
    const text = String(raw || '').trim();
    if (!text) return;
    const classified = classifyHebrewParagraph(text, index, title);
    const type = classified === 'section-heading' ? 'heading'
      : classified === 'instruction' || classified === 'alternative-label' ? 'instruction'
        : classified === 'source' ? 'source'
          : 'recitedText';
    const anchor = type === 'recitedText' ? detectBrakhaAnchor(text) : null;
    blocks.push({ type, text, anchor, className: TYPE_CLASS[type] });
    if (!anchor) return;
    additions.filter(item => item.anchor === anchor && item.verifiedText).forEach(item => {
      blocks.push({
        type: 'instruction',
        text: item.rubric,
        className: TYPE_CLASS.instruction,
        additionId: item.id,
      });
      blocks.push({
        type: 'conditionalAddition',
        text: item.verifiedText,
        className: TYPE_CLASS.conditionalAddition,
        additionId: item.id,
      });
    });
  });
  return blocks;
}

export const SIDDUR_BLOCK_CLASS = TYPE_CLASS;
export const SIDDUR_ADDITION_ANCHORS = ANCHOR_BY_KIND;
