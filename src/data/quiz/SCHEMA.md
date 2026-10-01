# בחן אותי — question files

Each file `src/data/quiz/<area>.mjs` exports `export default [ … ]` of plain objects:

```js
{
  id: 'tanakh-0001',          // unique across all files: '<area>-NNNN'
  q: 'מי ראה את הסנה הבוער?', // the question, Hebrew, clear, one line or two
  options: ['משה', 'אהרן', 'יהושע', 'שמואל'], // exactly 4 distinct options
  answer: 0,                  // index of the correct option in `options`
  category: 'tanakh',         // tanakh | torah-stories | places | people | history | halacha | shabbat | moadim | brachot | tefila | yahadut
  difficulty: 1,              // 1 מתחיל · 2 בינוני · 3 מתקדם
  tags: ['שמות', 'משה'],      // free tags for review/personalisation
  note: 'שמות ג',             // optional short reference or explanation (shown only after the session, never mid-game)
}
```

Rules: written in our own words (facts are free; never copy another quiz's wording or lists verbatim);
one unambiguous correct answer; plausible distractors of the same kind; no disputed halacha presented as
absolute (halacha questions follow the Sephardi line of Maran / Yalkut Yosef, as in the app's halacha DB);
no trick questions; respectful tone.
