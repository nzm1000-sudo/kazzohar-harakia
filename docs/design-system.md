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

**Type — one scale, two weights (owner-approved 2026-10-01; the model is לעצמי):**
The whole app speaks the way לעצמי does: quiet, light, symmetric. Defined once in `ui.css` › Typography.
- **Five sizes** (tokens): `--type-display` `clamp(32px,8.6vw,44px)` — a page's own name ("לעצמי", "פיוטים וזמירות");
  `--type-title` `clamp(26px,6.6vw,32px)` — a page title under an eyebrow, or a long one ("שכחתי תוספת — מה עושים?");
  `--type-section` `max(20px,1.25rem)` — a section title ("מה נשאר לי היום", "ליל שבת"); `--type-body` `max(17px,1.06rem)`;
  `--type-meta` (= `--font-ui-caption`, `max(15px,.88rem)`) — meta and secondary lines, always in the muted `--ink-2`.
  Row and tile names sit at 17–18px (לעצמי's `.lz-entry-text strong`). Defaults: `h1` display, `h2` section, `h3` body.
- **Two weights only:** **500** (`--weight-title`) for titles, row and tile names, buttons and labels; **400**
  (`--weight-body`) for body and meta. Nothing in the chrome is 600, 700, 800 or 900; `h1`–`h6`, `strong` and `b` are 500.
  Heebo 500 is a real face, loaded once for the whole app (`NewApp.jsx`).
- **Family:** Heebo (`--font-primary`) everywhere, with Noto Sans Hebrew as the per-glyph fallback. **Noto Serif Hebrew
  (`--font-reading`) only for the Torah, Tanakh and Tehillim texts and the siddur's prayer text itself** — and the
  reading text of the Talmud, Mishnah, commentaries, halacha sources, Shalom Rav and the zemirot, which keep their face.
  Names, numbers, ranks, chips and titles around them (the zemirot tiles, the parasha grid, נר זיכרון, the gematria
  word, the spiritual-path ranks, the daf numbers, the daily-learning portions) are Heebo.
- **A source's own bold stays.** Bold that is part of a text — a dibur hamatchil (`.library-dh`, `.dt-dh`), a printed
  book's sub-headings and emphasised lines (`.library-para-sub`, `.library-para-em`, Ben Porat Yosef…), a `<b>` inside
  Steinsaltz, a commentary or a zemer's acrostic (`:is(.gemara,.steinsaltz,.commentary-item,.zemer-stanza) :is(b,strong)`)
  — is the source's, not the chrome's. הגדרות › נגישות › טקסט מודגש (`html[data-a11y-bold]`) is the reader's own choice
  and may make everything heavier.
- **The siddur's labels** — insert labels ("בראש השנה", "מזונות", "יין", "של ארץ ישראל", `.siddur-display-heading`),
  instructions, inline markers and in-text section titles: Heebo 500 in `--siddur-label` (the editorial colour 62% into
  the muted ink — a soft copper, never the strong red), at `--siddur-label-size` (.76em) — a little smaller than the
  prayer, readable but quiet. The semantic section heading is barely larger (1.06em) in the same colour.
- **No sticky hover:** a `:hover` that paints a ground (or changes a colour) sits inside `@media (hover:hover)`. An
  iPhone keeps `:hover` on the last tapped element, which left a tinted row behind (the parasha page's "פרשת בראשית").
- UI controls keep `--font-ui-meta: max(16px,.94rem)` for labels and `--font-ui-caption` for notes.
- Reading text sizes are each reader's own designed size, multiplied by the shared reading size (§3.5).
- **Enforced** (`tests/uiDesignSystem.test.mjs` › Type): no weight above 500 in any stylesheet (allow-list above, plus
  `quiz.css`, restyled in its own pass), none in inline styles, the tokens exist, the siddur label style, the centred
  היום headings, the parasha rows, no sticky hover, and the quiet שכחתי תוספת / זמירות.

**Shadows:** `--shadow`, on cards and floating bars only, never on buttons.

**Hit area:** every control is at least 44×44 CSS px. A glyph can be smaller, but its button cannot.

## 3. Canonical components

### 3.0 The selected state — Rule A and Rule B (owner-approved, app-wide)
**Rule A — selected = a thin outline, never a fill.** The model is לעצמי › "פֶּרֶק בְּהַפְתָּעָה". What is chosen is drawn by
a thin copper outline in the control's own shape (pill, rounded rectangle, circle), its text in the same copper; inside,
the control keeps exactly its unchosen ground (the page, or its own card colour). Unchosen = plain text, no frame. Static.
- **One definition, in `ui.css` › "The selected state":** the tokens `--sel-ink` (the accent), `--sel-line` (the accent at
  75%, the model's), `--sel-ring` (`inset 0 0 0 1px var(--sel-line)`), `--sel-under` (`1px solid var(--accent)`) and
  `--primary-line` (the accent 70% into `--line-strong`); every theme follows, since the copper is the theme's `--accent`.
- **Segments and borderless choices** (`.seg`, `Segmented`/`.ja-seg`, `.personal-switch`, `.lz-segments`, the top/more
  menus, the theme menu, נוסח, טעמים, a Selector row, a page number, a calendar day): `--sel-ring`, copper text.
- **Framed choices** (chips, tiles, cards, rows with their own hairline — the alarm's tiles, the commentators, the
  reminder chips, the parasha picker, התבודדות, נר זיכרון, the Selector's changed chip): the frame turns `--sel-line`.
- **Tabs** ("הכול / תורה / נביאים / כתובים"): copper text over `--sel-under`.
- **Switch:** an outlined track; on, the frame turns copper and the knob — the one small solid mark — slides to it.
- **Primary action** ("גַּלְגֵּל אֶת הַגַּלְגַּל"): a copper pill outline, empty inside, copper text (§3.1). A submit joined to its
  field ("פתיחת דף", the halacha search and chat) takes the field's radius instead of the pill.
- **Never** a page-local selected colour, a filled `--selected` / `--accent` block, or a tint behind the chosen one.
- **Category colour = outline only** (owner, the הלכה "כל הנושאים" screen). Where subjects are told apart by colour, the
  colour lives only in thin frames and in text: the subject card is a neutral `--surface` in a 1px frame of its colour (no
  tinted ground, no thick top strip, no `hue-rotate`); the subject's head is an empty outline with its text in a deeper
  shade of the colour (the colour mixed into `--ink`), weight 500; each topic chip is an empty outline a little lighter
  than the head, ink text, weight 400; pressed/hovered, the frame turns the full colour — never a fill; the meta line
  ("17 נושאים · 248 שאלות") stays `--ink-2`. The hues are tokens, `--cat-0…5` (`base.css`, deeper on light grounds,
  lighter under `[data-theme="dark"]`/`[data-theme="amber"]`), chosen per card by `.tone-N` → `--cat`. The same applies
  to the subject's own page (its colour carries over) and the daily-learning number badges (an outlined circle). Each
  `color-mix()` with `--cat` is preceded by a plain declaration, since the old-WebView shim cannot see a per-card
  variable. Guard: `tests/uiDesignSystem.test.mjs` › "category colour = outline only". (The quiz arena and the
  אותיות cards' content backgrounds are not category chips and are outside this rule.)

**Rule B — motion only for the truly central.** A soft gold glow moving in a frame is reserved for headings (the
`TitleOrnament`, the ornament labels) and the truly central — the current prayer (`.day-service-buttons button.is-now`,
the turning gold frame of "עת תפילה") and "you are here" on the spiritual path (`.olam-step.is-current`). An ordinary
selected state never animates, glows, or casts a halo; a colour transition is the most it does.

**Exceptions (kept, with their reason):** the quiz's night arena (`quiz.css`: its orbs, rungs and answer feedback are its
own palette); tiny status marks — the התבודדות speed dots, the 6px dot of the page you are on in the "עוד" sheet, the
calendar's event dots, the diaspora dot, progress bars, the compass needle; the reader's own message bubble in הלכה חכמה
(`.chat-user p`, a speech bubble, not a control); reading-position tints (`.highlighted`, `.is-focus`, not choices).

### 3.1 PrimaryButton (`.personal-primary`)
A copper pill outline (Rule A, §3.0): `--primary-line` border, transparent inside, `--sel-ink` text, weight 500,
min-height 46px; hover lifts the frame to the full accent with a 6% wash. Never filled.
- Use it for the one main action on a screen (save, start, "הצגת התשובה").
- **Never** put two primary buttons side by side.

### 3.2 SecondaryButton (outlined: `button.ghost`, `.reader-tools button`)
`--line-strong` 1px frame on `--surface`, `--ink-2` text, radius-sm, min-height 44px, `--font-ui-meta`.
- Use it for every other action.
- Inside an article footer, the pill variant `.tc-action` (999px radius) is used for the "שמירה · שיתוף · עוד" row.

### 3.3 QuietButton / link-button (`button.link`, `a.link`, `.lz-text-button`)
No frame, `--focus`/`--accent` text, weight 500. Use it for inline navigation and "more".
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
- **One look for every skin** (`.seg` and its variants, `Segmented`/`.ja-seg`, a `.personal-switch` with `role="group"`), set once in `ui.css`: a `--line-strong` hairline pill track, transparent, the segments 3px inside it as plain text, the chosen one outlined (Rule A, §3.0: `--sel-ring`, `--sel-ink` text) — never filled.
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
- **A row's arrow is at the far (left) edge,** in its own last column, never beside the words in the middle; title over
  subtitle. A list of rows that belong together is one `.reading-list` card parted by hairlines (the parasha page's
  "שניים מקרא ואחד תרגום" and "דברי תורה לפרשה" are the same rows as its readings below). A row never keeps a tint after a tap.
- A quiet list in the לעצמי language (`.lz-entries`, שכחתי תוספת's `.forgotten-topic-row`): hairline rows on the page's
  ground, no card, the name at 18px/500 over a 15px muted line, the arrow at the far edge at 70%.

### 3.15 Section header
- `.eyebrow` (small, muted) above the `h1`/`h2`.
- On היום, the section heads are centred: "קביעות יומית · מה נשאר לי היום" (eyebrow, title, TitleOrnament —
  `.today-section-head`) and "להמשיך מהיכן שהפסקת", a centred ornament label (`.today-resume-label`), like "עוד בשבילך".
- The personal tools carry the TitleOrnament under their centred titles, all alike: כלים אישיים, נר זיכרון, המזכיר
  היהודי, מצב נסיעה, מחשבון גימטריה, הפסוק שלי; so do שכחתי תוספת and מצפן תפילה (now centred).
- A centred title gets the **TitleOrnament** under it (`<TitleOrnament />`, `components/ui/TitleOrnament.jsx`, styles in `ui.css` › TitleOrnament). It is the bar first drawn under "אותיות 26": two gold rules fading out from the centre whose gold drifts softly, a dot on either side, and a diamond that turns slowly in the logo frame's gold (`--brand-angle`). Under reduced motion (the device's or נגישות's) it is still. It is decorative (`aria-hidden`).
- **Every bar under a heading is this one component**: the old quiet `.gold-divider`, the page-local `.otiyot-ornament`, the memorial's line-and-dot between paragraphs and the plain rule under its name, לעצמי's line-circle-line ornament and the calendar month's plain rule are all gone. The memorial carries it under the name and between its paragraphs (a little narrower, `.memorial-mark`); לעצמי carries it *under* its titles (`Ornament` in `components/leatzmi/common.jsx` is the shared component), as do התבודדות's chapter title and end screen, the calendar month, הכנות לשבת and הפסוק שלי. A page may adjust only its margin or width (`.mitzvot-header .title-ornament`, `.tc-credit .title-ornament`, `.memorial-reading .memorial-mark`).
- **The ornament label** — a centred label with a rule on either side ("עוד בשבילך", "דברי חכמים", "ביום הזה", the reminder groups `.mz-group-title` / `.dt-section-title`, a commentary's layer `.library-layer-title`, the reader's `.library-stream-head`, היום's "להמשיך מהיכן שהפסקת" `.today-resume-label`): the rules are the TitleOrnament's living gold — fading out from the words, drifting softly, a small gold dot beside the words — two equal flexible rules, so it is symmetric by construction. One rule set in `ui.css` › The ornament label; the page draws no rule of its own. In a long reading stream (`.library-stream-head`) the gold stays still. Reduced motion: still.
- **The guard** (`tests/uiDesignSystem.test.mjs`) scans every stylesheet and fails on a heading-like selector that draws a plain 1px rule (a border under/over it, or a ::before/::after hairline), and on markup with a `-divider` class or `lz-ornament`. Allowed, and why: the app bar's edge, the one-sided list heading `.tc-section-title`, the quiz's electric eyebrow (its own night palette), panel/menu chrome (`.iyun-panel-head`, `.prayer-nav-title`) and the Siddur's in-text section titles (`.day-service-section-title`, reading typography).
- **A heading that opens something** ("נקודות של אור" in המעגל הרוחני): the title, the ornament and its one-line total are one button (`aria-expanded`, `aria-controls`) with a gold chevron in a small circle that turns over when open. The list it opens is a fan: each row starts gathered under the title, turned a little (alternately right and left), and swings down into place one after another; folding runs back, the last row first; Escape folds it and returns focus to the title. Reduced motion: it simply appears and goes.
- Page titles are not changed by this map. Their alignment belongs to the page-title pass.

### 3.16 Selector (`<Selector label=… value=… options=… onChange=… />`)
- **The only way to choose one value from a list.** There is no native `<select>` in the app; the scan test fails if one appears (allow-list in §5).
- **Trigger, two variants:**
  - `field` (default, forms): a framed field (`--control-border`, radius-sm, 48px), the value, and a gold chevron in a small gold circle. Its caption sits above it (`shownLabel`, or `hideLabel` when the row already names it).
  - `chip` (filter rows, `variant="chip"`): a 44px pill with its name in `--ink-2` and the value in weight 500. With `defaultValue`, a chip whose value is not the default lights up in gold, so a filter that is on is seen at a glance.
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
| Draw the chosen one with the shared copper outline (§3.0) | Fill a selected state, tint behind it, or make it glow or move |
| Use tokens for colour, radius and shadow | Hard-code hex values or new radii |
| Choose from a list with the `Selector` | Use a native `<select>` |
| Use the one segmented track for 2–4 views | Draw a new pill row with its own selected colour |
| Put `<TitleOrnament />` under a centred title | Draw a bar of your own under a heading |

## 5. Allow-list (tests/uiDesignSystem.test.mjs)
- `type="range"` is allowed only for continuous values that are not text: the auto-scroll fine speed (`AutoScrollControl.jsx`) and the ambient volume (`HitbodedutPage.jsx`).
- Comments may name forbidden characters. The scan reads code only.
- No `-divider` class in markup at all (the memorial's marks are `<TitleOrnament />` too); every bar under a heading is `<TitleOrnament />`, every side-lined label is the ornament label (§3.15).
- A native `<select>` is allowed only in `HitbodedutPage.jsx` (its "פרק התחלה"), which belonged to a parallel pass when the Selector came in; it moves to the Selector next.

- **Rule A guards:** a selected / active / current / pressed state in any stylesheet may keep only `transparent`, `none` or its own `--surface` / `--bg` ground. Allowed: `quiz.css` (its night arena), `.hb-speed-dots i.is-on` (tiny dots), `.ja-switch.is-on .ja-switch-thumb` (the knob), `.ui-picker-option.is-active` (the Selector's keyboard-cursor row, a hover tint), the "עוד" sheet's current-page dot. A solid `--accent` / `--selected` background is allowed only on marks (dots, bars, needle, badges, the chat bubble).
- **Rule B guards:** no `animation`, outer shadow, halo or filter on a selected state; allowed: `quiz.css`, `.olam-step.is-current`, the התבודדות speed dots.
- **CLAY (`styles/clay/*.css`, §7):** the guards read these files too. A chosen state there may keep the sunk ground (`var(--clay-sunk)`) — the material pressed in, never copper; its shadow tokens are resolved and must be inset only. The switch knob's one copper dot is the only copper mark.

## 6. Follow-ups (not done in this pass)
- ~~Merge the segmented skins into one `SegmentedControl` look.~~ Done (§3.11). `.hb-seg` (התבודדות) and the Talmud's commentator tabs (`.commentary-selector`, a tab row, not a segmented choice) keep their own layout; since the Rule A pass their chosen state is the shared copper outline (§3.0).
- ~~Give halacha answers the shared reading size.~~ Done: the question page (`.halacha-tools`, first under the title) and the הלכה חכמה answers.
- The התבודדות start chapter: to the Selector.
- The quiz's own back and switch belong to the quiz pass.

---

## 7. CLAY — the premium 3D material (owner-approved 2026-10-02; branch `design/premium-claymorphism`)

CLAY is a **design mode**, not a restyle: `<html data-clay="app" data-clay-page="today|reader|<route root>">` is set only
by a build made with `VITE_CLAY=true` (the side-by-side "כזוהר Clay" app, `scripts/clay/build-ios-clay.sh`). Every rule
lives under `src/styles/clay/` and is scoped under `:root[data-clay]`, so an ordinary build looks exactly as before.
Everything in §1–§6 still holds (type scale 500/400, Hebrew-only UI text, TitleOrnament, Rule A/B, one Selector, 44px
targets); this section says how each rule is translated to the material.

- Code: `src/services/clayExperiment.mjs` (the mode), `claySun.mjs` (light follows the sun), `clayHaptics.mjs`,
  `todayResume.mjs`; `src/components/ui/ClayIcon.jsx`; the dev-only gallery `#debug/clay` (`pages/ClayGallery.jsx`).
- Enforced by: `tests/clayExperiment.test.mjs`, `tests/clayContrast.test.mjs`, and the guards of
  `tests/uiDesignSystem.test.mjs`, which now read `styles/clay/*.css` too.

### 7.1 Files and ownership (import order defined once: `styles/clay/index.css`)
| File | Owner | What |
|---|---|---|
| `tokens.css` | foundation | the eight palettes (§7.4), geometry, motion, the light (`--clay-lx/ly`), night |
| `primitives.css` | foundation | the layers as tokens and every shared control (§7.2–7.3) |
| `ring.css` | foundation | the raised spiritual circle (Today, the circle page, the first-circle pill) |
| `reading-surface.css` | foundation | the one list of reading surfaces, kept flat (§7.5) |
| `today.css` | foundation | Today's cards, the mirror columns, the four resume tiles |
| `siddur` · `tehillim` · `calendar` · `halacha` · `library` · `readers` · `settings` · `tools` · `leatzmi` · `quiz` · `circle` · `about` · `more` `.css` | Stages 2–4, one area each | empty, reserved; each area writes only its own file |
| `arrows.css` | foundation | the one arrow (§7.15): the gold-ringed micro disc of `ArrowMark` |
| `a11y.css` | foundation | high contrast, reduced transparency, reduced motion — last, wins over every area |

An area file scopes its rules under `:root[data-clay]` (optionally `[data-clay-page="<route root>"]`) and builds only
from the primitives' tokens — it never invents a shadow stack, a selected look or a new colour.

### 7.2 Layers
One light, from the upper left by default. A body is moulded: a lit halo toward the light, the shadow away from it, a
contact shadow, a bright inner rim and a darker inner edge for its volume. Depth is hierarchy:

| Layer | Bodies | Token |
|---|---|---|
| **L0 ground** | the page (a faint light pool at the top; flat behind a reader) | `--clay-ground`, `--clay-ground-lit` |
| **L1 structure** | the header, the dock | `--clay-struct`, `--clay-struct-shadow`, `--clay-dock-shadow` |
| **L2 card** | cards, the reading-list card, ReaderNavigation, notices | `--clay-card`, `--clay-card-shadow` (`--clay-soft-shadow` = the app's `--shadow`) |
| **L2 row** | index rows in long lists | `--clay-card-a`, `--clay-row-shadow` (two cheap layers) |
| **L3 control / tile** | buttons, segments' track, TextSizeControl, Selector, icon tiles, badges | `--clay-control`, `--clay-control-shadow`, `--clay-tile-shadow` |
| **L4 floating** | the עוד sheet, the colour menu, Selector sheet/popover, dialogs, the prayer nav popover | `--clay-float`, `--clay-float-shadow`, `--clay-sheet-shadow` |
| **Wells** | fields, the search, a switch's groove, progress | `--clay-well`, `--clay-well-shadow` |

Shared classes for any page: `.clay-card`, `.clay-control`, `.clay-tile`, `.clay-well`, `.clay-press`, `.clay-progress`,
`details.clay-details` (inert in an ordinary build).

### 7.3 States
- **Rest** — the layer's body.
- **Hover** — only inside `@media (hover:hover)`: the body lightens to its lit stop. Never sticky on a phone.
- **Focus-visible** — the app's ring, `2px solid var(--focus)`, offset 3px, clear of the material.
- **Pressed** — the body sinks 1px in 130ms (`transform` + inset `--clay-pressed-shadow` + `--clay-control-down`).
- **Selected (owner decision 1)** — the control **sinks into the material** (`--clay-sunk` ground, inset shadow) with a
  **thin copper outline** in its own shape and **copper text**: `--sel-ring` = `--clay-selected-shadow` (three inset
  layers, the last `inset 0 0 0 1px var(--clay-sel-line)`). Never a copper-filled body, never a glow. Because `--sel-ring`
  is the shared Rule A token, every Rule A choice in the app (segments, menus, the Selector's rows, page numbers, tabs)
  sinks automatically. A switch: the groove takes the outline and the knob carries one small copper dot.
- **Disabled** — flat (no shadow), 50% opacity; its own `disabled` attribute still says it.

### 7.4 Tokens per palette (all eight kept; `tokens.css`)
Each palette re-points the app's own tokens (`--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--link`,
`--focus`, `--border`…) onto its material, and defines materials (two stops each), copper and icons, light and shadow
(shadows tinted with the palette's own shade), and the ring. Minimum contrast of each text colour over **every** material
stop of its palette (ground, structure, card, control, pressed, well, sunk, reading page):

| Palette | Ground | Card | Sunk | Copper | text | muted | copper | link | focus | outline on sunk |
|---|---|---|---|---|---|---|---|---|---|---|
| בהיר — ivory porcelain, copper | `#efe8dd` | `#fbf9f5→#f4efe8` | `#e5dccf` | `#96491f` | 12.15 | 4.61 | 4.73 | 5.20 | 5.20 | 4.73 |
| כהה — graphite, copper light | `#16191f` | `#272a30→#1e2127` | `#181b21` | `#d4915f` | 10.98 | 5.51 | 4.89 | 6.34 | 7.92 | 6.58 |
| מרווה — sage stoneware | `#e9efe6` | `#f9fbf8→#f0f4ee` | `#dae1d8` | `#3f634b` | 10.36 | 4.68 | 5.08 | 5.08 | 5.63 | 5.08 |
| כחול — blue-grey porcelain | `#e8eef3` | `#f9fafc→#eff3f7` | `#d8e0e6` | `#325a77` | 11.10 | 4.73 | 5.49 | 5.49 | 6.69 | 5.49 |
| שזיף — dusk plum clay | `#f0e9ee` | `#fbf9fa→#f5f0f3` | `#e2dae1` | `#6a4a63` | 10.71 | 4.72 | 5.54 | 5.54 | 6.71 | 5.54 |
| קורל ים — shell-pink clay | `#fbece6` | `#fefaf8→#fcf2ee` | `#f0ddd7` | `#a73f37` | 10.97 | 5.09 | 4.70 | 5.58 | 6.09 | 4.70 |
| טורקיז עמוק — sea-glass clay | `#e5f3f0` | `#f8fcfb→#edf7f5` | `#d5e5e3` | `#06696d` | 9.34 | 4.80 | 4.97 | 5.36 | 6.42 | 4.97 |
| זהב לילי — violet night, gold | `#1e1a28` | `#2f2b38→#262230` | `#201c2a` | `#e1a83b` | 11.38 | 6.72 | 5.77 | 6.93 | 8.71 | 7.82 |

The colour menu's swatches show each palette's clay (its ground with its copper at the centre). The dark palette is
graphite and copper in the Clay build (its green stays in the ordinary build).

### 7.5 Reading surfaces stay flat (owner decision 3)
The prayer, the Torah and Tanakh, Tehillim, the Talmud / Mishnah / commentaries, halacha answers, the library's readers,
תורת ש״י, חק לישראל and שלום רב are read on a flat page — no raised body, no shadow, no gradient. `reading-surface.css`
holds the one list (`.reading-text`, `.psalm-text`, `.library-text`, `.sr-text`, `.zemer-text`, `.chok-*`,
`.tc-article-body`, `.practical-answer`, `.halacha-excerpt`, `.gemara`, `.steinsaltz`, `.commentary-item`,
`.shnayim-*`, `.ts-verse`, `.tradition-body`, the chat answers…) with `box-shadow:none; text-shadow:none`; the siddur's
page is one flat sheet (`--clay-reading`). The clay is on the chrome around it. **Text is never embossed** anywhere
(no `text-shadow` in any clay file). Guard: no clay rule may raise a reading surface or give it a gradient.

### 7.6 Motion
A press is the only motion of the material: 1px in 130ms, `transform` / `box-shadow` / `background-color` only. Nothing
loops, nothing blurs (no `filter`, no `backdrop-filter`), nothing is tied to scrolling. Rule B is unchanged: the gold
motion is only the TitleOrnament's and the truly central (the current prayer, "you are here"). Reduced motion (the
device's or נגישות's): no transitions, no press travel, and the light stays fixed (§7.8).

### 7.7 Contrast (owner decision 4)
Every text colour passes WCAG AA (4.5:1 — the 15px meta lines too) over every material stop of its palette; a field's
frame, the selected outline, icons and the focus ring pass 3:1 (`tests/clayContrast.test.mjs`, read from `tokens.css`).
נגישות › ניגודיות גבוהה gives every body a full-strength edge (`a11y.css`): depth never replaces a line.

### 7.8 Light follows the sun
`services/claySun.mjs` turns the one light very slightly with the app's own zmanim: from the upper right (east) after
sunrise, from above at noon (shadows a little shorter), from the upper left (west) towards sunset; at night it rests at
the upper left and the copper's decorative glints (icons' lit side, the ring's light) turn a little cooler — text
colours never change. Every shadow offset is `calc(var(--clay-lx) * …)` / `calc(var(--clay-ly) * …)`; NewApp writes
the two properties on `<html>` at most every five minutes (and on a change of zmanim or of reduced motion). Only shadow
offsets move — never a size or a position, so there is no layout shift. Reduced motion: fixed upper-left.

### 7.9 Shadow budget (performance)
At most five layers on any body (plus one outline hairline), two on a row repeated in a long list (`--clay-row-shadow`,
no wide blur); no `will-change`; no shadow animation except the 130ms press. Measured (Playwright, 390×844@3x, CPU
throttled 4×, 240 frames of scripted scrolling): the halacha bank with every group open (2,382 rows) — no frame over
33ms and no long task in either build; main-thread time 992ms (clay) vs 894ms (ordinary). Halacha topics 268 vs 194ms,
Siddur home 44 vs 34ms.

### 7.10 Icons, the circle, haptics
- **ClayIcon** (`components/ui/ClayIcon.jsx`): one moulded drawing per place — היום, לוח שנה, תהילים, סידור, זמנים,
  הגדרות, הלכה, ספרים, תלמוד, פרשה, אותיות 26, שלום רב, כלים אישיים, לעצמי, המעגל הרוחני, אודות, עוד, the compass.
  Round 1.9 strokes on a 24 grid, a soft shadow to the lower right, a gradient body, a bright top-left rim; the palette's
  own colours (`--clay-icon-hi/ink/rim/shadow`). Decorative (`aria-hidden`): the button keeps its words. In the dock;
  in the עוד sheet, now a 3×4 grid of tiles (its eleven places, then הגדרות last); on Today's compass tile.
- **The circle** is the brand object (`ring.css`): a raised plate, a band standing on it with the ribbon on its crest,
  a sunken centre — on Today and on the circle page; the "סיימתי" plate sits inside its gold frame and sinks when done.
  Its dot is ivory-gold by day and the logo's blue by night (no green; palette only: gold, copper, ivory, the logo blue).
  Before the first circle, Today shows one compact pill — "המעגל הראשון · 12 מתוך 26 אורות" — not an empty tile.
- **Haptics**: a light tap (the app's native bridge, `UIImpactFeedbackGenerator(.light)`) on the dock, the עוד tiles,
  segments, primary actions, "סיימתי" and the resume tiles; at most once per 80ms; silent when נגישות › משוב מישושי is off.
  (No Capacitor Haptics plugin is installed; the bridge is the one channel.)

### 7.11 Today (Clay build)
- **"להמשיך מהיכן שהפסקת"**: always four equal tiles in a symmetric 2×2. The right column is fixed — תפילה חכמה above
  בשרי · חלבי; the left column is the two things most recently opened (a reading from the learning memory, with its
  position, or a place of the app), the newest on top; a new user sees סידור and שעשועון טריוויה. Every tile is kind ·
  title · detail, centred; a long title is cut with an ellipsis and the button's name stays whole.
- **Around the circle**: two mirror columns of four lines each (kicker, time, day, a fourth line — the candles at the
  start; Rabbenu Tam, or the stars, at the end), each line on one line, no "·". The name under the circle has no
  quotation marks.

### 7.12 Foundation round 2 (after the six areas merged)
- **Fill pairs:** `--selected` is each palette's text colour and `--accent-contrast` its ground, so any fill of either
  with the other's words passes AA (tested for every palette, with `--accent` under `--accent-contrast` too).
- **Siddur labels:** `--siddur-editorial` is set per palette (its red-copper, adjusted where needed), so the editorial
  colour and `--siddur-label` pass 4.5:1 on every ground, the reading page included (tested).
- **Fields:** every field is a framed well — `--clay-field-shadow` = the well + `--clay-field-frame` (a 1px frame of
  the control border at 62%). High contrast turns the frame full ink and gives every field a real 1px ink edge with
  `!important`, so no area rule can hide it. (The settings area's local `--st-field-*` is gone.)
- **Open accordions:** an open head is a quiet recess — `--clay-open-ground` (between the card and the well) with
  `--clay-open-shadow` (a soft inner shade and a hairline) — light in every palette, never the dark sunk bar.
- **Checkbox:** every native checkbox is a framed well; checked = sunk + the copper outline + a copper check (a mask in
  `currentColor`, the one small mark); focus ring; its label row is a 44px target.
- **ON / current, not chosen** (a reminder that is on, the city you are in, this month in the calendar's year): a thin
  copper outline only (`--clay-current-line`) — no fill, no outer shadow, no sinking.
- **List card** (`.clay-list`, and `.tc-list`, `.favorite-list`, `.tradition-list`, `.offline-pack-list`): one card,
  hairline rows, a row sinks when pressed.
- **Reader title row:** the title centred, the heart under it, in every reader.
- **Link buttons** in pages and readers (`button.link`, `.event-line button`, `.shnayim-save`, the library's credits)
  are 44px targets.
- **The light look over a dark theme** (`html.clay-light-look`, and the light quiz arena): the one בהיר set in
  `tokens.css`, not a copy.
- **`data-clay-page="search"`** while the header search shows its results.
- **Today's four tiles** are mirror-equal: each carries the same raised icon tile centred at its top (the compass — a
  button — on תפילה חכמה, the timer on בשרי · חלבי, the place's own icon on the two recents); no tile has a rim the others lack.
- **Dark sunk:** in כהה and זהב לילי the sunk ground sits just above the page ground (30% toward the card), so a chosen
  row reads as a calm recess, not a near-black bar.
- **Guards:** `filter:none` is allowed; a filter or a glow is allowed only by name with its reason (the quiz ladder's
  lozenges and rung, the week chart's current bar, the current rank's seal). The core rules are unchanged.

### 7.13 הגדרות — the settings page (round 3, owner-approved 2026-10-02)
- **One tap:** עוד › הגדרות (the last tile, after זמנים and every place; the last desktop destination too) opens
  `#settings` → `pages/SettingsPage.jsx` in both builds. `#settings/<section>` opens at a section; `#times` stays the
  zmanim page; `#accessibility` stays its own page (its back goes to הגדרות › נגישות). `navRootFor('settings' |
  'accessibility')` is `settings`.
- **Sections, in order**, each a raised card under a centred title: נגישות (the same `AccessibilityControls` as the
  accessibility page, embedded — its groups are parts of the card, hairline rows), מיקום (the active place, מעמד הלכתי,
  יום טוב שני, and the manual place by coordinates — `components/ManualLocationForm.jsx`, moved from זמנים with its logic
  and storage unchanged), נוסח (the Selector), ערכת צבעים (the eight palettes as a radio group of moulded tiles, 2×4,
  each with its clay swatch; chosen = sunk + copper outline), התראות (the permission line, a switch for every reminder of
  המזכיר היהודי with its details one tap away, and the rows to המזכיר היהודי, השעון היהודי, נר זיכרון).
- **Search** (`services/settingsSearch.mjs`): a framed well at the top; every setting has its words; niqqud, final
  letters, gershayim, a one-letter prefix and spelling without ו/י are folded; a word matches at the start of a word.
  While typing, the sections without a match step aside and the matches are listed; Enter or a tap jumps to the row,
  focuses its control, and marks it with a copper outline that fades (static under reduced motion). The count is a polite
  live region. A row of five section buttons sits under the field.
- **זמנים** keeps the times, the Jewish clock and the place (city search); "שינוי מיקום" opens הגדרות › מיקום. The
  ordinary build's look is `styles/settings.css`; the Clay material is `styles/clay/settings.css`.

### 7.14 The spiritual circle, round 3 (owner, 2026-10-02)
- **Progress is royal blue** — one colour wherever the open circle's progress shows: the ribbon, its tip and spark (Today,
  the circle page, the logo ring), the first-circle pill's count and arc, and the native widgets (iOS `KZPalette.progress`,
  Android `PROGRESS_DAY/NIGHT`). `#2a55d0` on the light palettes, `#789cf8` on כהה / זהב לילי and in widget dark mode;
  one source, `services/progressColor.mjs`, tokens `--kz-progress(-from/-to)` in `ring.css`. The band and track stay gold.
- **The halo is back** on the plate (Today and the circle page): a still oval wash of the logo's blue and a fine halo
  hugging the plate (`.clay-ring-halo`).
- **Circle page**: the ring is 160px on the same plate / band / sunken-centre instrument as Today; the count sits in the
  112px centre on one line, growing with the reader's text only to 108%. On entering, the lights fill 0 → count in 1s
  (eased out; still under reduced motion).
- **First-circle pill**: three mirrored columns (the seal in its progress arc, the two lines, an equal empty place),
  equal padding, 44px — the words on the page's axis.
- **The rank's name** stands in the dynamic gold circle (`RankRing`: gold line, jewel, breathing halo) on the card, the
  מעגלי עולם hero and Today; the path no longer repeats the hero's "N מעגלים ל…" under the next rank. **Rank-up
  ceremony**: the circle closes slowly around the new name with one light haptic — once per rank-up
  (`claimCeremony`, recorded before it plays); none under reduced motion.

### 7.15 Arrows — one mark, in a fine gold circle (owner, 2026-10-02)
"כל החצים באפליקציה: עטופים במעגל עדין בצבע זהב (של הפלטה), כמו במסך שכחתי תוספת."
- **One primitive**: `components/ui/ArrowMark.jsx` (`dir` forward | back | up | down, `size` row | inline, `as`,
  `className`, `legacy`, `clayOnly`); styles in `styles/clay/arrows.css`. No screen types ← → ‹ › ⌄ ▾ or draws a
  chevron of its own (`tests/arrowsUnified.test.mjs`, with a reasoned allow-list: breadcrumb separators and arrows
  inside sentences are words, not controls).
- **Look (Clay build only)**: the שכחתי תוספת micro disc, raised (`--clay-row-shadow`), in a fine ring of the
  palette's own `--gold` over a 9% gold-tinted control fill; the arrow drawn (one path, one 1.4px non-scaling
  stroke) in gold deepened toward the ink — ≥ 3:1 on its disc in all eight palettes. Two sizes only: 30px (a row's
  end, a stepper, a card) and 22px (after a text link's words, inside a pill).
- **Target**: ≥ 44×44px — a transparent `::after` around the disc; an arrow-only button is `.arrow-button` (a plain
  44px host, the disc its only body). The layout never moves for it.
- **Direction**: drawn pointing left (forward in RTL); back points right; an accordion's arrow points down and turns
  up when it opens. Arrows that pointed the wrong way (‹ mirrors in RTL; → typed on forward rows) now point forward.
- **States**: press sinks the disc with its host (never a fill); a disabled host's disc steps back; high contrast:
  full-ink ring and arrow (1.5px ring, 1.8px stroke); forced colours: the system's.
- **The non-Clay build** renders exactly the glyph it had (`legacy`), or nothing where it had none (`clayOnly`).

