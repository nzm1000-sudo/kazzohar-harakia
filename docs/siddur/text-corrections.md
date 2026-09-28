# Siddur text — display rules and corrections

No word of any edition is changed in the bundled packs. The rules below change only how the edition's text is
*displayed*, and each is recorded with the reason and the exact place it was found. Suspicious words found in the
editions are listed in `text-audit.md` (generated) and in the per-rite notes; they are reported, not repaired.

## 1. A line break separates words (all rites)

- **Found:** the word circled on the iPhone, `…שכתב החיד״א ז״ל בסידורויְהִי רָצוֹן` — Siddur Edot HaMizrach,
  Weekday Mincha, Amida ¶67 (and Weekday Shacharit, Amida ¶69; Weekday Arvit, Amidah ¶48).
- **Source text (exact):** `<small>יש אומרים תפילת רב מגמרה ברכות ט"ז ע"ב שכתב החיד"א ז"ל בסידורו<br>יְהִי רָצוֹן מִלְּפָנֶיךָ…</small>`.
- **Verdict:** the word is correct and the source is correct. It is not a transcription error. The app removed the
  `<br>` without leaving a space, which glued the last word of the editor's note ("בסידורו") to the first word of the
  prayer ("יְהִי").
- **Rule:** `<br>` is read as a word break everywhere (`src/hebrewText.mjs` `stripHtml`). Inside small print it also
  separates lines, so a caption line and the prayer it introduces become two blocks: the note as an instruction, and
  the Chida's prayer as an optional prayer (`src/services/siddurBlocks.mjs` `markupParts`).
- **Other places with the same pattern:** the text audit (`glued-at-line-break`) lists them.

## 2. The paseq in the Siddur (all rites)

- **Found:** `רָם עַל־כָּל־גּוֹיִם ׀ יְהוָה` and similar verses quoted with cantillation marks (Edot HaMizrach: 468
  paragraphs; see `text-audit.md`, `paseq`).
- **Rule:** where the cantillation marks are removed (the Siddur policy), the paseq (U+05C0) is removed with them. It is
  a mark of the te'amim system and read on the iPhone as a stray "|". The Tanakh reader keeps it.
  (`normalizeHebrewText`, and the test in `tests/hebrewText.test.mjs`.)

## 3. Small print is prayer only when it is pointed (all rites)

- **Found:** Nusach Sefard and Ashkenaz (Metsudah), Birkat HaShanim — the halachic note
  `אם שכח לומר טַל וּמָטָר ונזכר קודם שהתחיל תְּקַע … התחיל לומר תְּקַע יאמרנה בשׁוֹמֵֽעַ תְּפִלָּה…` was split. The
  pointed words it quotes were shown in the large prayer type, as if they were said.
- **Rule:** a small-print passage whose words are mostly unpointed and which is longer than 24 words is the editor's
  note (`type: note`). It is shown whole, in the note style, and it is hidden in prayer mode unless "הצגת ההלכות וההערות"
  is on. An instruction is displayed as an instruction throughout; a few quoted pointed words do not turn it into prayer
  (`prayerPresentation.mjs`).

## 4. A known condition caption is not shown once the day is decided (prayer mode)

- **Found:** `בימות החמה:` / `בימות הגשמים:` and similar captions stayed above the day's words even though the app had
  already chosen them.
- **Rule:** with a known date, a caption the day engine knows (`rubricConditions.mjs`) decides what is shown, and is
  then not displayed. The full-edition mode shows every caption and every alternative (`asPrinted`).

## 5. A seasonal word reads on in its sentence (prayer mode)

- **Found:** `וְתֵן` ¶ `בְּרָכָה` ¶ `עַל פְּנֵי הָאֲדָמָה…` — the edition prints the seasonal alternative as its own
  paragraph, so "בְּרָכָה" stood alone on a line.
- **Rule:** once the alternative is chosen, a pointed fragment of up to four words joins the pointed sentence before it
  (when that sentence does not end with ":" "." "]" ")"), and the sentence after it joins too.

## 6. Empty brackets left by a resolved condition

- **Found:** Kaddish `לְעֵֽלָּא מִן כָּל ( בעשי"ת לְעֵֽלָּא לְעֵֽלָּא מִכָּל)` — outside the Ten Days of Repentance the
  inner alternative is removed, which left `( )`.
- **Rule:** brackets with nothing left inside are not displayed.

## 7. Structure instead of text changes

These problems from the iPhone review are solved by the composition layer (`data/nusach/compositions/*.mjs`), not by
changing text:

- the Tisha B'Av "נחם" material inside Boneh Yerushalayim → its own section, `when: tishaBav`;
- "מודים דרבנן" printed inside Modim → its own section, `role: repetition`, folded in prayer mode;
- "ואחר כך אומר הש״ץ חצי קדיש" with no Kaddish after it → the Kaddish is its own section in the service order;
- instructions such as "בימים שאין בהם תחנון אומרים…" → the sections they govern carry the condition.

## 8. The grey "⟩" tab at the left edge (iPhone screenshot 5)

No element of the app matches it: the app has no fixed or sticky control on the side of the reader (the only
floating controls are the prayer navigation bar in the header and the round "back to top" button at the bottom). Its
shape — a dark translucent tab with a chevron, half outside the screen edge — matches an iOS system overlay: a
*stashed* Picture-in-Picture window or AssistiveTouch. This needs checking on the device.
