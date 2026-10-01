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
| **Segmented** | `.seg` (pill, 12 files), `Segmented` (alarms/accessibility), `.personal-seg`, `.personal-switch` pills, `.trope-seg`, `.talmud-text-choice` | Several skins of one idea. Documented below. A visual merge is a follow-up and was deliberately left out of this pass. |
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
  - Each reader multiplies its own designed size by it: siddur 25px, Tehillim 22, library/Tanakh 24, Talmud 21, Shalom Rav 22, Zemirot 24, and the CSS sizes of דברי תורה, שולחן שבת and שניים מקרא.
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
- A 999px pill frame. The chosen segment is `--selected` with `--accent-contrast` text.
- Uses `role="radiogroup"`/`radio` or `aria-pressed`.
- Use it for 2–4 mutually exclusive views (טעמים, נוסח הגמרא, מקרא/מפרשים).

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
- A centred title gets the quiet `gold-divider` under it.
- Page titles are not changed by this map. Their alignment belongs to the page-title pass.

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

## 5. Allow-list (tests/uiDesignSystem.test.mjs)
- `type="range"` is allowed only for continuous values that are not text: the auto-scroll fine speed (`AutoScrollControl.jsx`) and the ambient volume (`HitbodedutPage.jsx`).
- Comments may name forbidden characters. The scan reads code only.

## 6. Follow-ups (not done in this pass)
- Merge the segmented skins (`.seg`, `.personal-seg`, `.personal-switch`) into one `SegmentedControl` look.
- Give halacha answers the shared reading size.
- The quiz's own back and switch belong to the quiz pass.
