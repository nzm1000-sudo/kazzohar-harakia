# שעשועון טריוויה יהודי — design research and what we adopted

The trivia gets its own young, energetic look. The rest of the app keeps its calm style. This note summarises the research
(October 2026) and lists which ideas went into `src/styles/quiz.css` ("the arena"), `src/components/quiz/ArenaParts.jsx`
and `src/services/quiz/records.mjs`.

## What the popular games do

| Game | Key design moves | Source |
|---|---|---|
| Trivia Crack | One fixed colour (and a mascot) per category; a short "crown" meter that fills with each right answer; a collection to complete | en.wikipedia.org/wiki/Trivia_Crack |
| QuizUp | Short rounds; a speed bonus with a floor (slow but right still counts) | en.wikipedia.org/wiki/QuizUp |
| Kahoot | Each answer has a **shape and a colour** (for colour-blind access); an answer-streak bonus, capped; a podium | support.kahoot.com (points), kahoot.fandom.com/wiki/Quiz |
| HQ Trivia | A timer ring; bright, simple shapes; one haptic per second | bighuman.com/work/hq-trivia |
| Who Wants to Be a Millionaire | A rising ladder with safe havens at 5 and 10; one-use lifelines; "final answer" suspense | en.wikipedia.org/wiki/Who_Wants_to_Be_a_Millionaire |
| Duolingo | Streak flame; staged celebrations; numbers that count up; quick feedback (press about 100 ms, banner about 200 ms, progress about 300 ms ease-out). It also uses guilt reminders, which we do **not** copy | blog.duolingo.com/how-duolingo-streak-builds-habit, blakecrosley.com/guides/design/duolingo |
| Wordle | One shared puzzle a day; a spoiler-free square grid to share; a countdown to the next puzzle; no ads, no endless play | en.wikipedia.org/wiki/Wordle, slate.com (Wardle interview) |
| Sporcle | Shows what you missed only when the game ends | sporcle.com/blog |
| Jewish quiz apps (JewPath, חידון התנ״ך, טריוויה יהדות) | Respectful tone, question formats such as "מי אמר?" and "השלם את הפסוק" | Play Store / App Store listings |

## Principles across the research

- **Game feel ("juice").** Layer small, quick feedback on top of mechanics that already work:
  - a short pop on a press;
  - a burst of light for a success;
  - a gentle nudge (never a screen shake) for a miss;
  - numbers that count up.

  Sources: Jonasson and Purho, "Juice it or lose it" (GDC 2012); Vlambeer, "The Art of Screenshake"; valdemird.com/blog/game-feel-on-the-web.
- **Timing.** About 100 ms feels instant and about 1 s keeps the flow (Nielsen Norman Group). We use 300–500 ms springs for
  pops, about 800 ms for a burst, and about 700 ms for count-ups. The ladder's held breath stays at 1.5 s.
- **Tiered celebrations.** A right answer < a run of 3 < a safe step / a run of 5 < a run of 10 < the whole ladder.
- **Leaderboards.** A global board demotivates most players (Yu-kai Chou, Octalysis). Personal bests and a board of your own
  weeks keep the competitive feeling without anyone losing to strangers.
- **Ethics.** Streak anxiety, guilt notifications and paid "fixes" are documented dark patterns. Reward real knowledge, give
  grace, and keep everything optional and local.
  Sources: nerdsip.com/blog/gamification-gone-wrong…, prototypr.io "ethical gamification".

## Adopted — and how

1. **A stage of its own.** A night-indigo arena derived from the theme: named colours are mixed with each theme's `--accent`
   and `--gold`, so all eight themes and dark get their own shade. It is lit in gold and an electric blue, with a quiet
   field of stars. Inside the arena the page's tokens point at the arena palette, so every older rule follows.
2. **Bold numbers** (Heebo 800, loaded only by the trivia) and gradient titles.
3. **HUD in the ladder**:
   - a progress ring around the step number;
   - points that **count up**, with the step's gain floating off;
   - a **combo meter**: a flame of light, never an emoji, dim at rest and brighter at runs of 2, 5 and 10 (`comboLevel`).
4. **Answer reveal choreography.** The held breath comes first. A right answer then pops with a spring, its lozenge turns solid
   gold, a **burst of twelve points of light** flies out and the verdict pops. A wrong answer gets a short nudge and a soft
   red outline. Nothing marks the correct option unless "להציג את התשובה הנכונה?" is on, exactly as before.
5. **Level-up badges** for a safe step and for runs of 3, 5 and 10 (`levelUpOf`). Each has its own short arpeggio when
   sounds are on, and a double haptic tap that follows the app's haptics setting.
6. **The climb.** Sparks of light rise from the rail at the new step, the halo travels, and the ring pops.
7. **Answer letters on coloured diamonds** (Kahoot's shape and colour): א electric, ב violet, ג mint, ד flame. The letter and
   the shape carry the meaning, never the colour alone.
8. **Category orbs.** Each area has a line icon in a coloured orb. Every icon is checked to be six-fold or non-crossing. The
   grid is **about 75% of its old width**, centred.
9. **Daily challenge, Wordle-style.**
   - The home button is tighter and narrower, with a pulsing "live" dot until the challenge is played.
   - The result shows a **share grid of fifteen squares**: three rows of five, so the safe steps close the first two rows.
   - A **countdown** shows the time to the next challenge, at the device's midnight.
   - The share text is unchanged: no questions, no answers.
10. **השיאים שלי** (on the home and in המסע). Four personal bests: ladder, daily, answers in a row, days in a row. Below them,
    **"השבוע שלי"** ranks this week's ladder points against the player's own weeks, with a six-week column chart. Local
    only: `ladder.log` keeps 120 days on the device.
11. **Medals gallery.** Each achievement is a six-sided medal on a ribbon, gold when earned and outlined with a lock when not,
    with a count of how many are earned.
12. **A pressable main button.** A lit gold lozenge with a solid lower edge that sinks when pressed. The secondary buttons keep
    their outline.

## Not adopted (on purpose)

- Money and casino imagery, loot boxes, paid streak freezes, energy timers.
- Push or guilt notifications.
- Global leaderboards.
- Screen shake.
- Countdown pressure in the ladder (there is no clock; the practice timer stays optional and off by default).

## Accessibility and reduced motion

- Every animation sits in the stylesheet's `prefers-reduced-motion: no-preference` blocks and also follows the app's own
  motion setting (`html[data-a11y-motion]`). Under reduced motion:
  - the numbers simply show their value;
  - the burst and sparks never appear;
  - the flame is still.
- All decorative parts are `aria-hidden`.
- The combo meter and the week chart carry their meaning in words (`aria-label`).
- Touch targets are at least 44 px.
- High-contrast mode turns the hairlines into clear lines.
