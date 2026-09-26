# Smart Siddur Engine — prompt v2

**Goal:** the smartest Siddur there is. The user opens a prayer and receives exactly the right prayer for *this* moment and place — right additions, right omissions, in the right order — and can always ask *why*. Correctness beats automation: when unsure, show the printed Siddur with a visible note, never a confident guess.

Recommended model: **Claude Fable 5.1** for architecture stages (0–3) and each new rule family's design; **Claude Opus 5.5 at `xhigh`** for follow-on slices, UI wiring and device iterations.

## Lessons from past failures (must not repeat)

1. **Smart Maariv crashed the Siddur on every render** — the composer ran during render without a guard, and its hand-written pack did not match the composer's contract. 625 tests passed because none composed the real pack.
2. **A stored prayer session of an old shape crashed Mincha** — no schema version, no validation on read.
3. **UI wiring broke silently** — TOC panel never rendered, completion never recorded, IDs mismatched.
4. **Three independent calculations** of Hebrew date, "after sunset", and fasts; default time zone `UTC` in one place, `Asia/Jerusalem` in another.

## Non-negotiables

- Prayer text, nikud, nusach, order: untouched unless a task explicitly authorizes it.
- No invented rulings or sources. Unverified → `pending-rabbinic-review`. AI memory is never a source.
- **Unknown is not false.** Missing sunset, location, regime or source stays `unresolved`/`unsupported`, visibly.
- Layers flow one way: **facts → rules → session → composition plan → renderer.** Facts never contain rulings; the UI never contains rules.
- No second calendar engine: reuse `@hebcal/core` and existing helpers (`civilDate.jewishDateKey`, zmanim). Core correctness never depends on the network.
- Machine IDs, never display labels, drive logic.

## Safety mechanisms (new in v2)

1. **Crash-proof composition** — every composition goes through a `safeCompose()` that never throws; failure renders the printed Siddur text plus a note. The Siddur and the reader get their own error boundaries.
2. **Pack-contract tests** — compose each real pack for every day across one leap and one regular year. Rules-only tests are not "done".
3. **Versioned, validated sessions** — schema version in the key; invalid stored sessions are discarded, never dereferenced.
4. **Duplication becomes verification** — before migrating consumers, the new facts layer runs side-by-side with the three legacy calculations in a multi-year sweep; every disagreement is a bug found early. Then migrate consumers one at a time.
5. **Non-circular fixtures** — expected values are literals; Hebrew dates are cross-checked against an independent engine (ICU `he-u-ca-hebrew`); holiday facts marked for human verification against a printed luach.
6. **Kill switch per prayer** — one flag returns a prayer to the printed text instantly.
7. **Definition of done** — focused tests + full suite + a render-level test of the Siddur page and reader + a check on the physical iPhone.
8. **Compose once per session**, not per render or clock tick; cache keys include every input.

## Stages (stop and wait for approval after each gate)

- **0 — Inventory (read-only).** Map sources of truth: Jewish date, sunset, time zone, location, Israel/diaspora, holiday events, conditions, sessions, composers, tests.
- **1 — Facts contract.** One prayer-facing *facts* object (no rulings), documented field by field, with `schemaVersion`.
- **2 — Facts adapter.** Adapts the existing engines; sunset from app zmanim when valid for the day, otherwise local `@hebcal/core` solar calculation; provenance records which.
- **3 — Facts test matrix.** Weekday/Shabbat/Rosh Chodesh; every Sukkot and Pesach day (Israel and diaspora); Rosh Hashanah, Yom Kippur, Tisha B'Av, Purim (leap year); Chanukah 1/middle/8, + Rosh Chodesh, + Shabbat; real sunset transition; same instant in two places; DST; unresolved/unsupported; language independence; determinism; invariants; two-year sweep; host-time-zone independence.
- **4 — First rule slice** (after approval): Tachanun, Mashiv HaRuach/Morid HaTal, Veten Tal UMatar/Barchenu — each rule returns `{ruleId, status, value, reasonCode, sourceRefs, inputFacts, warnings}`.
- **5 — Composition plan** with included/excluded blocks and reasons; `safeCompose`; render-level tests; iPhone.
- Then one rule family at a time: Yaaleh Veyavo → Al HaNissim → Hallel → Omer → Aneinu → Mussaf → festival sections → Hoshanot → Torah readings.

## Git

Backup branch/tag before each stage. Stage only task files. Commit per approved stage and push to the feature branch (the user's standing rule); merge to `main` only when the user asks.
