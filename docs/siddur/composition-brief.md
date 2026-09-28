# Composing a rite's Siddur — authoring brief

The app (Hebrew RTL siddur, React/Vite/Capacitor, fully offline) must present each rite as a professionally composed
Siddur, not as a raw Sefaria tree. A **composition** maps the rite's own bundled edition onto the canonical prayer
schema. No word of prayer is ever typed: every section is a slice (by anchors) of the rite's own pack.

## Files

- Canonical schema (services, concepts, required/spine): `src/data/nusach/prayerSchema.mjs` — read it first.
- Vocabulary: `src/data/nusach/compositions/dsl.mjs` (`sec`, `omit`, `service`, `leaf`).
- Template (done): `src/data/nusach/compositions/ashkenaz.mjs` → `weekday-mincha`.
- Your file: `src/data/nusach/compositions/<rite>.mjs` — edit ONLY this file (and your notes file).
- Composer: `src/services/prayer/riteServiceComposer.mjs` (anchor resolution, conditions `WHEN_LABELS`, `ROLE_LABELS`).
- QA: `src/services/prayer/siddurQa.mjs`; run `node scripts/siddur-qa.mjs <nusach-id>` (nusach ids: `edot-hamizrach`,
  `ashkenaz`, `sefard`, `chabad`). Do not run it without the id (that rewrites the shared docs).
- Leaf dump: `node scripts/siddur/dump-leaf.mjs <nusach-id> "<regex on the full ref>" [--full]` — paragraph index, `S` =
  paragraph opens in small print (instruction/caption/note), `B` = opens bold, then the unpointed words.

## How a section is cut

`sec(id, concept, title, ref, { start, end, when, role, continues, rewind, range })`

- `start` / `end`: short **unpointed** phrases (as the dump prints them: no nikud, maqaf = space, quotes as `"`), found
  with `includes` in the paragraph. `start` = the section's first paragraph; `end` = its last paragraph (inclusive).
  Without `end`, the section runs up to the next section of the same leaf (which then needs a `start`) or the leaf end.
- Sections of one leaf must follow the leaf's order (a cursor moves forward). `rewind: true` restarts the search at
  the top of the leaf (only for a passage the rite really says again, e.g. a Kaddish reused).
- Granularity is the paragraph. If one paragraph mixes two parts, keep them together and name the section honestly.
- Avoid divine names and very common words in anchors; prefer the opening words of the paragraph.
- Every paragraph of every leaf you use must be in a section or in `omit(id, ref, { start, end, why })` with a real
  reason (e.g. "a halachic note for the reader, shown in the full-edition mode" is NOT a reason to omit — keep notes
  inside sections; the reader hides notes in prayer mode by itself. Omit only what does not belong to this service,
  e.g. a leaf that also holds the next service, or a duplicate printing).
- Sections may come from any leaf **of the same rite's pack** (e.g. a Kaddish printed elsewhere in the same edition).
  Never reference another rite's pack.

## Titles, concepts, roles, conditions

- `title`: the proper Hebrew name as a professional siddur of THIS rite prints it (ברכת אבות, גבורות, קדושת השם, ברכת
  השנים, שומע תפילה, מודים, ברכת כהנים, אלהי נצור, תחנון, קדיש תתקבל, עלינו לשבח …). Never a generic "ברכה" / "תפילה".
  `''` = continuation of the previous part without its own heading (use with `continues: true`), typically the text
  that resumes after a conditional insertion (יעלה ויבוא, על הנסים, עננו…).
- `concept`: from `CONCEPTS` in prayerSchema.mjs. The Amidah's blessings are all concept `amidah`; Kedusha is `kedusha`.
  If a concept you need is missing, use the nearest and list it in your notes (do not edit the schema).
- `role`: `repetition` (said only in the chazzan's repetition: Kedusha, Modim DeRabbanan, Birkat Kohanim, chazzan's
  Aneinu) — shown collapsed in prayer mode; `minyan` (Kaddish, Barchu, Torah reading); `mourners` (Kaddish Yatom);
  `congregation` / `chazzan`; `optional` (said by some: "יש אומרים").
- `when`: a key or expression over the keys in `compositionConditions()` / `WHEN_LABELS` of riteServiceComposer.mjs:
  `tachanun`, `!tachanun`, `mondayThursday`, `torahReading`, `roshChodesh`, `hallel`, `fast`, `avinuMalkeinu`,
  `aseret`, `omer`, `ledavid`, `motzaeiShabbat`, `chanukah`, `purim`, `cholHamoed`, `tishaBav`, `diaspora`, `israel`,
  `erevShabbat`, `day0`…`day6` (Sunday…Shabbat), combined with `|` (or), `&` (and), `!` (not). A section whose
  condition does not hold today is left out in prayer mode and labelled in full-edition mode. Conditions INSIDE a
  paragraph (small-print captions like "בעשי״ת:", "בקיץ:") are handled by the text engine — do not cut for those.
  Cut a separate section when a whole paragraph (or run) is said only on certain days AND is not introduced by a
  caption the engine knows (e.g. על הנסים's opening line "על הנסים ועל הפורקן", Avinu Malkeinu, Tachanun, the Torah
  reading on Mon/Thu, the Song of the Day per weekday: `when: 'day0'` …).
- Tachanun days, Hallel days etc. are decided by the app; you only mark the section.

## Services

Compose every service of `SERVICES` (prayerSchema.mjs) the edition supports, in the rite's real order. For a service
the licensed edition does not contain, add `sourceGaps: { '<service-id>': 'reason' }`. For a required concept the
edition lacks inside a service, add `missing: [{ concept, why }]` to that service. Do not borrow text from another
rite, and do not invent. Use your knowledge of the rite's standard order (and the edition's own instructions) to place
sections — including Kaddish positions, Tachanun/Vidui, Aleinu, the Song of the Day, Ledavid (Elul), Barchi Nafshi
(Rosh Chodesh), Omer in Maariv, Motzaei Shabbat additions (ויהי נועם, ואתה קדוש, ויתן לך) where the edition has them.

## Review and `reviewed: true`

Set `reviewed: true` on a service ONLY after you have read every section's full text in the dump (`--full`), checked
that each begins and ends where its title says, that nothing belonging elsewhere is inside, that the order matches the
rite, and the QA for that service shows no problems. Record in your notes what you checked and anything doubtful.
Leave `reviewed: false` where you are not sure — an honest UNVERIFIED is required over a false VERIFIED.

## Notes file

Write `docs/siddur/notes-<nusach-id>.md`: per service — what you composed, the source leaves, doubts, source gaps,
suspicious words you saw in the text (exact ref ¶ and words; do not fix text), and concepts/conditions you needed but
the schema/composer lacks.

## Do not

- Edit any file other than your composition file and your notes file.
- Run git commands that change anything (no commit, no checkout, no stash).
- Change any prayer text, nusach or halacha. Fabricate sources or halachic claims.
