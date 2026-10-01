# כזוהר הרקיע: design map

This is the reference for every utility control in the app. A screen uses the controls listed here. It does not draw its own text-size buttons, hearts, close crosses or back arrows.

- Code: `src/components/ui/` (re-exported from `src/components/ui/index.js`)
- Styles: `src/styles/ui.css`, loaded after the page styles
- Tokens: `src/styles/base.css` `:root` and the theme blocks
- Enforced by: `tests/uiDesignSystem.test.mjs`

Principles (the owner's taste): symmetry, order, consistency, elegance, Heebo, no emojis. Glyphs are drawn as SVG and never typed as characters. A typed `✕ × ♥ ♡ א+` looks different in every font and in every theme.

---

## 1. Inventory (before this pass)

| Control | What existed | Inconsistency |
|---|---|---|
| **Text size** | Tehillim: a slider labelled "גודל טקסט" (18–34px). Siddur readers (SourceReader, ComposedPrayerReader, DayServiceReader, RiteServiceReader): a slider labelled "גודל אות" (20–38px). Library/Tanakh: two loose buttons `א−` `א+` (18–40). Shalom Rav: `א−` `א+` (16–40). Zemirot: `א−` `א+` (18–40). Talmud: a joined `א−|א+` pair (`.font-steps`, 17–31). דברי תורה, שולחן שבת, שניים מקרא: none. | Three different controls, three labels ("גודל טקסט" / "גודל אות" / none), six separate stored sizes. Changing the siddur size did not change Tehillim. |
| **Favourite** | `HeartToggle` (SVG heart) in every reader. Library "הוספה לספרים המועדפים" and the דברי תורה "שמירה" button used `HeartIcon`. Baby names used `'♥ נשמר' / '♡ שמור'`. Chidushim used `♡` / `♥ במועדפים` / `♡ למועדפים` as typed characters. | Typed hearts next to drawn hearts. |
| **Close** | Talmud panel: `✕`. Memorial: `×`. Search fields (ClearableInput): `×`. Verse-name field: `✕`. Journal row remove: `✕`. Auto-scroll bar: an SVG cross. Meat/dairy sheet: the text button "סגור". Olam unlock: "סגירה" (a closing action). Webview hint: "לא עכשיו". | Four different crosses (two characters, two fonts, one SVG) and a text "סגור". |
| **Back** | `BackNavigation` / `BackLink` (`.local-back`: framed, → and a label). לעצמי screens: their own frameless `.lz-back`. Siddur readers: a "חזרה לתוכן העניינים" button *inside* the reader tools row. Quiz: `.local-back.qz-back` (quiz styling, out of scope here). | Two styles of back, and a back placed in a toolbar. |
| **Reader toolbars** | `.reader-tools` rows in a different order in each reader. Tehillim used inline styles, mixing the search, the title, the heart, a slider and auto-scroll in one row. Talmud uses `.talmud-tool-row`. Shalom Rav and Zemirot put loose `א−` `א+` in a centred row. | No fixed order, and the text size was in a different place in every reader. |
| **Share** | `ShareImageButton` ("שיתוף כתמונה") in 7 places. Tehillim also has a text-only "שיתוף" (navigator.share or clipboard). Personal tools and לעצמי use `shareText` behind a `.ghost` / `.lz-text-button`. | Two share wordings. Behaviour differs on purpose (image vs text), so they were kept, and the wording is now documented below. |
| **Copy** | Library "העתקת מראה מקום" → "הועתק" | One instance. It already follows the rule. |
| **Search clear** | `ClearableInput` everywhere. The verse-name field has its own clear button. | The glyphs were different (see Close). |
| **Auto-scroll** | `AutoScrollControl`, one component everywhere. In Tehillim and שניים מקרא it was standalone (`is-standalone`). | It is now in the reader tools row in every reader. |
| **Segmented** | `.seg` (pill, 12 files), `Segmented` (alarms/accessibility), `.personal-seg`, `.personal-switch` pills, `.trope-seg`, `.talmud-text-choice` | Several skins of one idea. Merged into one look in the Selector pass (§3.11). |
| **Choosing from a list** | 27 native `<select>`s in 12 files: the דברי תורה filters (סוג · נושא · אורך · סדר), נוסח התפילה, the accessibility text size, Ner Zikaron and reminder dates, the Shabbat preparation reminders, the Talmud's extra commentators, the date converter, הפרשה שלי, baby names, המסורת שלי, חידושים, the library lab, the התבודדות start chapter. | Old-fashioned boxes with ⌃⌄ chevrons, drawn differently by every device. Replaced by the one `Selector` (§3.16). |
| **Switch** | `AlarmSwitch` (role="switch") in alarms and accessibility. Quiz has its own `quiz-switch`. Plain checkboxes appear in Preparation, Offline, NerZikaron and the Talmud compare toggle. | The canonical switch is `AlarmSwitch`. |
| **Primary / secondary / quiet** | Primary: `.personal-primary`, `.prayer-compass-primary`. Secondary: `button.ghost`, `.reader-tools button`, `.md-secondary`, `.prayer-compass-secondary`, `.tc-action` (pill). Quiet: `button.link`, `a.link`, `.lz-text-button`, `.hb-pill`. | Documented below as three roles. |
| **Prev / next** | `ReaderDock` (in the header) and `ReaderNavigation` (cards at the end) in every reader. דברי תורה uses `.tc-prevnext`. | Consistent. |

## 2. Tokens (as they are: this pass changes no sizes)

**Colour** (each theme redefines these: light, dark, sage, blue, plum, coral, plus high contrast):
- Background and surfaces: `--bg`, `--surface`, `--surface-2`
- Text: `--ink` (text), `--ink-2` (muted)
- Lines: `--line` (hairline), `--line-strong` (control frame)
- Accent: `--accent`, `--accent-soft`, `--accent-contrast`
- States: `--selected`, `--hover`, `--link`, `--focus`, `--danger`
- Siddur: `--siddur-editorial` / `--instruction`

Never hard-code a hex value in a control.

**Radii:**
- `--radius-sm: 8px` for controls, rows and toolbar groups
- `--radius: 12px` for cards and sheets
- `999px` for pills (segmented, `.tc-action`) and the floating auto-scroll bar
- `50%` for quiet icon buttons and the heart

**Spacing:**
- The scale in use is 4 · 6 · 8 · 12 · 16 · 20 · 24 · 28.
- Controls in a row are 8px apart.
- Toolbar to text: 12px, with a hairline under the row when the head is start-aligned.

**Type** (unchanged):
- Body: Heebo / Noto Sans Hebrew (`--font-primary`)
- Reading text: Noto Serif Hebrew (`--font-reading`)
- UI: `--font-ui-meta: max(16px,.94rem)` for control labels and `--font-ui-caption: max(15px,.88rem)` for notes
- Reading text sizes are each reader's own designed size, multiplied by the shared reading size (§3.5).

**Shadows:** `--shadow`, on cards and floating bars only, never on buttons.

**Hit area:** every control is at least 44×44 CSS px. A glyph can be smaller, but its button cannot.

## 3. Canonical components

### 3.1 PrimaryButton (`.personal-primary`)
Filled with `--accent` and `--accent-contrast` text, weight 700, radius-sm, min-height 46px.
- Use it for the one main action on a screen (save, start, "הצגת התשובה").
- **Never** put two primary buttons side by side.

### 3.2 SecondaryButton (outlined: `button.ghost`, `.reader-tools button`)
`--line-strong` 1px frame on `--surface`, `--ink-2` text, radius-sm, min-height 44px, `--font-ui-meta`.
- Use it for every other action.
- Inside an article footer, the pill variant `.tc-action` (999px radius) is used for the "שמירה · שיתוף · עוד" row.

### 3.3 QuietButton / link-button (`button.link`, `a.link`, `.lz-text-button`)
No frame, `--focus`/`--accent` text, weight 600. Use it for inline navigation and "more".
- **Never** browser-blue, and never underlined except in high contrast.

### 3.4 IconButton (`<IconButton label=… variant="quiet|framed|row">`)
A drawn glyph in a 44px square, always named (`aria-label`, and `title` by default).
- `quiet`: no frame, round hover.
- `framed`: the secondary frame.
- `row`: takes the frame of its neighbours (for example, the Talmud panel's steps).

### 3.5 TextSizeControl: `−  גודל טקסט  +` (`<TextSizeControl />`)
- **The only text-size control in the app.** There are no sliders and no `א−` / `א+`. The scan test fails if one appears.
- **Look:** one framed group, 44px tall: `[ − | גודל טקסט | + ]`. Each step is 44×44. The label is `--font-ui-meta` in `--ink-2`, between two hairlines.
- **Direction:** minus on the left and plus on the right in every direction (`dir="ltr"` on the group), like a phone's own stepper.
- **Accessibility:**
  - The group is `role="group"` with the name "גודל טקסט, 110%" (it carries the current value).
  - The buttons are "הקטנת הטקסט" and "הגדלת הטקסט", and each is disabled at its end.
  - Every change is announced ("גודל טקסט 120%").
- **Value:** one shared reading size (`services/readingSize.mjs`, key `kz-reading-size-v1`) from 80% to 160% in 10% steps.
  - Each reader multiplies its own designed size by it: siddur 25px, Tehillim 22, library/Tanakh 24, Talmud 21, Shalom Rav 22, Zemirot 24, and the CSS sizes of דברי תורה, שולחן שבת, שניים מקרא and the halacha answers (the question page and הלכה חכמה).
  - At 100% every reader looks exactly as designed.
  - Changing the size in one reader changes it in all of them, including readers already open.
  - The first time it runs, an earlier per-reader size carries over, the siddur's first.
- **Relation to הגדרות › נגישות › גודל טקסט:** that setting scales the whole app and follows the device. This one scales only the reading text, on top of it. The two multiply, so they never fight.
- **Hooks:**
  - `useReadingFont(base)` returns px for readers that size text inline.
  - `useReadingScale()` returns the factor for readers sized in CSS: set `--reading-scale` on the reader and use `calc(<size> * var(--reading-scale,1))`.

### 3.6 ShareButton (`ShareImageButton`, exported as `ShareButton`)
- Shares a designed image. Label: "שיתוף כתמונה", or "שיתוף" in an article's action row.
- A plain-text share (Tehillim's chapter name, personal tools) is labelled "שיתוף".
- Copying is labelled with what it copies ("העתקת מראה מקום") and confirms "הועתק" in place.

### 3.7 FavouriteToggle (`HeartToggle`, exported as `FavouriteToggle`)
- **One heart:** the SVG `HeartIcon`, outlined, filled with `--accent` when saved, `aria-pressed`, announced.
- In a reader it sits at the end of the title row (`.reader-title-row`).
- When the heart is part of a labelled button ("שמירה", "שמור לשמות שאהבתי", "למועדפים"), the button draws `<HeartIcon filled={…} />` before the words.
- **Never** typed `♥ ♡ ❤ ★ ☆`, never a star, and never a bookmark icon. In this app a bookmark *is* the heart.

### 3.8 CloseButton (`<CloseButton label="סגירת …" />`, glyph `CloseGlyph`)
- **One cross:** two 1.6px strokes in `currentColor`.
- It closes a sheet, a panel or a dialog, or removes one row (the name says which: "סגירת המפרשים", "הסר … מהרישום").
- Its place is at the end of a sheet's head row. In RTL that is the left.
- A search field's clear button and the auto-scroll bar use the same glyph.
- **Never** a typed `✕ × ✖`, and never a text "סגור" on a sheet. A closing *action* that ends a flow ("סגירה" after a celebration, "לא עכשיו") stays a worded secondary button.

### 3.9 BackButton (`BackNavigation` / `BackLink`, exported as `BackButton`)
- `.local-back`: framed, `→` and a label that says where it goes ("חזרה לתוכן העניינים", "לשלום רב").
- It sits first on the page, above the breadcrumbs.
- One per screen. **Never** inside a toolbar.

### 3.10 SearchField (`ClearableInput`, exported as `SearchField`)
- A styled field with the clear cross (CloseGlyph in a small round chip).
- It is hidden while empty, and returns focus to the field when tapped.

### 3.11 SegmentedControl (`Segmented` / `.seg`)
- **One look for every skin** (`.seg` and its variants, `Segmented`/`.ja-seg`, a `.personal-switch` with `role="group"`), set once in `ui.css`: an inset track — a `--line-strong` hairline pill on `--surface`, the segments 3px inside it, the chosen one filled `--selected` with `--accent-contrast` text, weight 600.
- One-line segments are pills (999px). A segment with a sub-line (the alarm's kinds, the reminder's "לפני") rounds to `--radius`.
- Each skin keeps its own layout (equal grid, scrolling row, wrapping) and its own text size. Only the look is shared.
- Uses `role="radiogroup"`/`radio`, `role="tablist"`/`tab` or `aria-pressed`; the chosen look follows `.on`, `.is-on`, `.selected` or the ARIA state.
- Use it for 2–4 mutually exclusive views (טעמים, נוסח הגמרא, מקרא/מפרשים, תושב ישראל / חו״ל). For more, or for a value in a form, use the Selector.

### 3.12 Switch (`AlarmSwitch`, exported as `Switch`)
- `role="switch"` with `aria-checked`, a 44px row target, and a haptic tick (only when haptics are allowed).
- Use it for on/off settings.
- **Never** a bare checkbox for a setting in new work.

### 3.13 ReaderToolbar (`.reader-tools`)
The row of reading tools under a reader's title. It wraps at narrow widths, with 8px between controls.

**Order, the same in every reader:**
1. **TextSizeControl**: always first, so it is always in the same place (`order:-1` enforces it).
2. Reading mode: segments and switches (טעמים, גוון נוסף, נוסח).
3. **AutoScrollControl**.
4. The reader's own actions: copy, keep offline, quiet reading.

**Alignment:**
- Under a start-aligned head (siddur, Tanakh, Talmud, Tehillim), the row is start-aligned with a hairline under it.
- Under a centred title (Shalom Rav, Zemirot, דברי תורה, שולחן שבת, שניים מקרא), it is centred with no hairline.

**What stays out of the toolbar:**
- Back goes above it.
- The heart goes in the title row.
- Previous and next go in the header dock and the end cards.

### 3.14 Card / Tile
- `--surface`, a 1px `--line` frame, `--radius` (12px), with `--shadow` only for cards that float on `--bg`.
- Rows (`.index-row`, `.library-row`, `.personal-tool-row`) use radius-sm with title, metadata and arrow ←.

### 3.15 Section header
- `.eyebrow` (small, muted) above the `h1`/`h2`.
- A centred title gets the **TitleOrnament** under it (`<TitleOrnament />`, `components/ui/TitleOrnament.jsx`, styles in `ui.css` › TitleOrnament). It is the bar first drawn under "אותיות 26": two gold rules fading out from the centre whose gold drifts softly, a dot on either side, and a diamond that turns slowly in the logo frame's gold (`--brand-angle`). Under reduced motion (the device's or נגישות's) it is still. It is decorative (`aria-hidden`).
- **Every bar under a heading is this one component**: the old quiet `.gold-divider`, the page-local `.otiyot-ornament`, the memorial's line-and-dot between paragraphs and the plain rule under its name, לעצמי's line-circle-line ornament and the calendar month's plain rule are all gone. The memorial carries it under the name and between its paragraphs (a little narrower, `.memorial-mark`); לעצמי carries it *under* its titles (`Ornament` in `components/leatzmi/common.jsx` is the shared component), as do התבודדות's chapter title and end screen, the calendar month, הכנות לשבת and הפסוק שלי. A page may adjust only its margin or width (`.mitzvot-header .title-ornament`, `.tc-credit .title-ornament`, `.memorial-reading .memorial-mark`).
- **The ornament label** — a centred label with a rule on either side ("עוד בשבילך", "דברי חכמים", "ביום הזה", the reminder groups `.mz-group-title` / `.dt-section-title`, a commentary's layer `.library-layer-title`, the reader's `.library-stream-head`): the rules are the TitleOrnament's living gold — fading out from the words, drifting softly, a small gold dot beside the words — two equal flexible rules, so it is symmetric by construction. One rule set in `ui.css` › The ornament label; the page draws no rule of its own. In a long reading stream (`.library-stream-head`) the gold stays still. Reduced motion: still.
- **The guard** (`tests/uiDesignSystem.test.mjs`) scans every stylesheet and fails on a heading-like selector that draws a plain 1px rule (a border under/over it, or a ::before/::after hairline), and on markup with a `-divider` class or `lz-ornament`. Allowed, and why: the app bar's edge, the one-sided list heading `.tc-section-title`, the quiz's electric eyebrow (its own night palette), panel/menu chrome (`.iyun-panel-head`, `.prayer-nav-title`) and the Siddur's in-text section titles (`.day-service-section-title`, reading typography).
- **A heading that opens something** ("נקודות של אור" in המעגל הרוחני): the title, the ornament and its one-line total are one button (`aria-expanded`, `aria-controls`) with a gold chevron in a small circle that turns over when open. The list it opens is a fan: each row starts gathered under the title, turned a little (alternately right and left), and swings down into place one after another; folding runs back, the last row first; Escape folds it and returns focus to the title. Reduced motion: it simply appears and goes.
- Page titles are not changed by this map. Their alignment belongs to the page-title pass.

### 3.16 Selector (`<Selector label=… value=… options=… onChange=… />`)
- **The only way to choose one value from a list.** There is no native `<select>` in the app; the scan test fails if one appears (allow-list in §5).
- **Trigger, two variants:**
  - `field` (default, forms): a framed field (`--control-border`, radius-sm, 48px), the value, and a gold chevron in a small gold circle. Its caption sits above it (`shownLabel`, or `hideLabel` when the row already names it).
  - `chip` (filter rows, `variant="chip"`): a 44px pill with its name in `--ink-2` and the value in weight 600. With `defaultValue`, a chip whose value is not the default lights up in gold, so a filter that is on is seen at a glance.
- **The sheet:** on a phone it rises from the bottom (radius at the top, a grip, a gold hairline crown, the title and a CloseButton); on a wide screen (700px and up) it is a popover under the trigger (above it when there is no room). Rows are 52px with a hairline between them; the chosen row is tinted gold and carries a drawn check in a gold circle. A list longer than 12 gets a search field (nikud and ״ ׳ ignored). Short symbols (days, letters, years, digits) are a grid (`columns`), and a `wide` option takes a whole row ("כל האותיות").
- **Motion:** the sheet slides up and the scrim fades in (0.28s); the popover grows from 98%. Under reduced motion (the device's or נגישות's) it simply appears.
- **Accessibility:** the trigger is a button with `aria-haspopup="listbox"`, `aria-expanded`, and a name that says what it chooses and what is chosen ("סוג, כל הסוגים"). The sheet is a modal dialog (`useModalFocus`): focus moves in (the search field, else the list), Tab stays inside, the page behind is inert, Escape and the Android back button close it, and focus returns to the trigger. The list is a `listbox` with `option`s (`aria-selected`) and `aria-activedescendant`; arrows, Home / End, Page Up / Down, Enter / Space, and typing a letter. In a grid, ← goes on and → goes back (right to left).
- **Where:** the דברי תורה filters (chips), הגדרות › נוסח התפילה, נגישות › גודל טקסט, נר זיכרון and the reminder editor (day grid, month, the memorial), the Shabbat preparation reminders, the Talmud's "עוד" commentators, the date converter's Hebrew month, הפרשה שלי (year grid, month), baby names (letter grid, source type, number grid), המסורת שלי, חידושים (two chips; the form's topic and privacy), the library lab.
- **Code:** `components/ui/Selector.jsx`, pure logic in `components/ui/selectorLogic.mjs`, styles in `ui.css` › Selector.

## 4. Do / Don't

| Do | Don't |
|---|---|
| Use `TextSizeControl` in every reader, first in its tools row | Use a slider, `א−/א+`, "גודל אות" or a per-reader size key |
| Draw glyphs (`CloseGlyph`, `HeartIcon`, `PlusGlyph`, `MinusGlyph`) | Type `✕ × ♥ ♡ ★ א+` |
| Name every icon-only button with what it does | Ship an unnamed icon, or name a toggle by its state |
| Keep 44px hit areas | Shrink a button to its glyph |
| Use one back per screen, above everything | Put "חזרה" in a toolbar |
| Use one primary per screen | Put two filled buttons side by side |
| Use tokens for colour, radius and shadow | Hard-code hex values or new radii |
| Choose from a list with the `Selector` | Use a native `<select>` |
| Use the one segmented track for 2–4 views | Draw a new pill row with its own selected colour |
| Put `<TitleOrnament />` under a centred title | Draw a bar of your own under a heading |

## 5. Allow-list (tests/uiDesignSystem.test.mjs)
- `type="range"` is allowed only for continuous values that are not text: the auto-scroll fine speed (`AutoScrollControl.jsx`) and the ambient volume (`HitbodedutPage.jsx`).
- Comments may name forbidden characters. The scan reads code only.
- No `-divider` class in markup at all (the memorial's marks are `<TitleOrnament />` too); every bar under a heading is `<TitleOrnament />`, every side-lined label is the ornament label (§3.15).
- A native `<select>` is allowed only in `HitbodedutPage.jsx` (its "פרק התחלה"), which belonged to a parallel pass when the Selector came in; it moves to the Selector next.

## 6. Follow-ups (not done in this pass)
- ~~Merge the segmented skins into one `SegmentedControl` look.~~ Done (§3.11). `.hb-seg` (התבודדות) and the Talmud's commentator tabs (`.commentary-selector`, a tab row, not a segmented choice) keep their own look for now.
- ~~Give halacha answers the shared reading size.~~ Done: the question page (`.halacha-tools`, first under the title) and the הלכה חכמה answers.
- The התבודדות start chapter: to the Selector.
- The quiz's own back and switch belong to the quiz pass.
