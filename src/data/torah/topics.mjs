// Curated word families for search (reviewable data, not code): forms of one word the sources use interchangeably —
// a verbal noun and its verb, Aramaic and Hebrew plurals. A query word in a family also searches the other forms, at a
// lower weight than the word as written, so an exact match always ranks first.
// Conservative by rule: only forms of the same word. Never a topic, a synonym of a different concept or a halachic
// equivalence (חלב is milk and forbidden fat alike, so it has no family here). Plene/defective spelling (כיבוד/כבוד,
// אבידה/אבדה) and plurals in ־ים / ־ות / ־ין are handled by the engine and need no entry.
export const WORD_FAMILIES = Object.freeze([
  { id: 'bishul', words: ['בישול', 'מבשל', 'לבשל', 'מבושל', 'מתבשל', 'שבישל'], note: 'בישול: שם הפעולה ונטיותיה' },
  { id: 'chimum', words: ['חימום', 'לחמם', 'מחמם', 'מחממין', 'להחם', 'חמום'], note: 'חימום: שם הפעולה ונטיותיה' },
  { id: 'borer', words: ['בורר', 'ברירה', 'לברור', 'הבורר', 'בוררין'], note: 'מלאכת בורר' },
  { id: 'dag', words: ['דגים', 'דג', 'דגה', 'דגי'], note: 'דג: יחיד, רבים, שם הקיבוץ (דגה) וסמיכות' },
  { id: 'hefsek', words: ['הפסק', 'הפסיק', 'מפסיק', 'להפסיק', 'הפסקה'], note: 'הפסק ונטיותיו' },
  { id: 'muktzeh', words: ['מוקצה', 'מוקצים', 'מוקצין', 'מוקצות'], note: 'מוקצה ורבים' },
  { id: 'netila', words: ['נטילת', 'נטילה', 'ליטול', 'נוטל'], note: 'נטילה ונטיותיה' },
  { id: 'kiddush', words: ['קידוש', 'לקדש', 'קידש'], note: 'קידוש ונטיותיו (בלי "מקדש", שהוא גם בית המקדש)' },
  { id: 'bracha', words: ['ברכה', 'ברכות', 'מברך', 'לברך', 'מברכין', 'מברכים'], note: 'ברכה ונטיותיה' },
]);
