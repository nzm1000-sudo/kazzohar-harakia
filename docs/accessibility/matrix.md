# Accessibility matrix: common tasks

Rows are the things people come to the app to do. Columns are the ways they may be using it. Each cell says what is in
place and how it was checked.

Key:
- **A**: covered by the automated tests (markup and source).
- **S**: checked visually in the iOS Simulator.
- **P**: pending a check on a physical device.
- **—**: not applicable.

None of these was checked with a real screen reader on a device.

| Task | VoiceOver / TalkBack | Voice Control / Switch | Large text | Contrast | Differentiate without colour | Reduced motion | Keyboard |
|---|---|---|---|---|---|---|---|
| Open today's prayer from Today | Named buttons and ring label; title focus after navigation (A) · P | Visible labels start each name (A) · P | Re-flows to 200%; the tab bar is capped at 130% (S) · P | Token overrides per theme · P | The current tab has `aria-current` and an outline in high contrast (A) | Global rule (A) | Tab order follows the DOM · P |
| Read a prayer (Siddur) | Headings and regions for instructions and sources (A, partial) · P for the Divine Name | Section navigation buttons named · P | Reading text scales; nikud stays attached (S: Tanakh) · P: Siddur | · P | Instructions are marked apart by more than colour · P | · A | Sheets use `useModalFocus` · P |
| Tehillim, daily or by chapter | Chapter controls named · P | · P | · P | · P | · P | · A | · P |
| Tanakh chapter and its מפרשים | Tabs have role and selected state; chips are a tablist (A) · P | Chips named by their visible names (A) | Re-flows to 200% (S) | · P | The chosen chip is filled and outlined in high contrast (A) | · A | Chips reachable with Tab · P |
| A commentator's own chapter, switching commentators | The row is a `nav` with its own label; the current one has `aria-current`; commentators read live say so (A) | Chip name equals the visible name (A) | The row scrolls sideways; the text never does · P | · P | The current chip has `aria-current` plus a filled style (A) | Centring the current chip is a single scroll, not an animation | · P |
| Commentary by weekly portion | Chapter marks and verse headings are buttons with names (A) | · P | · P | · P | — | · A | · P |
| Talmud daf and its commentaries | Drag panel has accessible buttons (see the final report) · P | Alternative buttons for dragging · P | · P | · P | · P | · A | · P |
| Halacha question: search and answer | The field has a persistent label and a named clear button; results update as a low-priority render (A) | · P | · P | · P | Relevance groups are shown by headings, not colour · P | · A | The form submits on Enter · P |
| Library search and book contents | Labelled fields, named clear buttons, named grid cells (A) | · P | Grids widen at large text (S) · P | · P | Missing parts use text ("אינו במהדורה זו"), not only fading (A) | · A | · P |
| Settings › נגישות | Every switch has a name and on/off state; the groups are labelled (A) | Switch names equal the visible titles (A) | The rows wrap (CSS) · P | Contrast applies live · P | Switch state is shown by position and colour; `aria-checked` for assistive technology (A) | · A | · P |
| Jewish alarm (השעון היהודי) | Switches, radio-like segments and dialog sheets (A, partial) · P | · P | · P | · P | · P | · A | Escape closes sheets · P |
| Reporting an accessibility problem | Named action; confirmation is announced in a status region (A) | · P | · P | · P | — | — | · P |
