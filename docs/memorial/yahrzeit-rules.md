# נר זיכרון — how the yahrzeit is calculated

The app does not implement its own recurrence. It wraps `HebrewCalendar.getYahrzeit` of @hebcal/core 6.9.2 (the
algorithm of Reingold & Dershowitz, *Calendrical Calculations*, p. 113, which follows the customary rules below),
in `src/services/memorialYahrzeit.mjs`, and adds only the Adar custom, where practice differs.

## Sources consulted
- Shulchan Aruch, Orach Chayim 568:7–8 with the Rema (Adar in a leap year; the first year).
- Magen Avraham 568:20 and Mishnah Berurah 568:42 (Cheshvan / Kislev 30: follow the first anniversary; Adar).
- @hebcal/hdate `anniversary.js` (`getYahrzeitHD`) — the documented implementation, read in the installed package.
- *Calendrical Calculations*, Reingold & Dershowitz.

## Behaviour adopted
| Death date | Yahrzeit in a later year |
|---|---|
| Any ordinary date | the same Hebrew day and month |
| 30 Cheshvan | as the first anniversary: if the year after the death has a 30 Cheshvan, then 30 Cheshvan (or 1 Kislev in a year without one); otherwise the day before 1 Kislev (29 Cheshvan, or 30 in a long year) |
| 30 Kislev | the same rule with Kislev / Tevet |
| Adar II (death in a leap year) | the last Adar of the year (Adar in a common year, Adar II in a leap year) |
| Adar I (death in a leap year) | Adar I in a leap year, Adar in a common year; 30 Adar I in a common year → 30 Shevat |
| Adar (death in a common year), remembered in a **leap year** | **custom differs** — see below |

## The Adar custom (a choice shown only when it matters)
A death in the Adar of a common year, in a leap year: the Rema (568:7) — Adar I; the Mechaber and the custom of many
Sephardim — Adar II; some keep both. The form asks only for such a date; the default follows the user's nusach
(Edot HaMizrach → Adar II; Ashkenaz, Sefard, Chabad → Adar I) and can be changed to either month or both.

## A civil date of death
The Hebrew day turns at sunset. The form asks whether the death was before or after sunset: before → the Hebrew
date of that civil day; after → the next Hebrew day. When the time is unknown both dates are shown; the user picks
one if the family knows it, or saves the record as *uncertain* — then no annual reminder is scheduled and the Today
card does not appear (nothing is guessed).

## When it shows and reminds
- The yahrzeit begins at the sunset before its civil day. The Today card follows the app's Jewish day (which turns at
  sunset), so it appears at that sunset: "הערב החלה האזכרה", then "היום האזכרה". In three-day mode it stays two more
  Jewish days with "האזכרה הייתה אתמול" / "לפני יומיים" — the yahrzeit itself is one day.
- Reminders: 1, 2 or 3 days before the civil day of the yahrzeit, at the chosen time (default 09:00, local). The
  next two yahrzeits of each memorial are scheduled (48 at most in all, within iOS's 64 pending), and reconciled on
  every save, edit, delete, launch and return to the app — deterministic ids, so nothing is duplicated.

## Privacy
Records live in `localStorage` on the device only (`ner-zikaron-v1`, versioned, parsed safely). No network, no
analytics, no logs.
