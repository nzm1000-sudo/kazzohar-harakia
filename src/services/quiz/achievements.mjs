// שעשועון טריוויה יהודי — achievements: few, quiet, earned by learning (never bought, never random). `test` reads the state after a
// session ends (with `stage` and the `session` just played).
import { CATEGORY_IDS } from './catalog.mjs';

export const ACHIEVEMENTS = [
  { id: 'first', title: 'צעד ראשון', detail: 'סבב ראשון הושלם', test: s => s.sessions >= 1 },
  { id: 'perfect', title: 'בלי שגיאה', detail: 'סבב של עשר שאלות ומעלה, כולו נכון', test: s => s.session.answered >= 10 && s.session.correct === s.session.answered },
  { id: 'days-3', title: 'שלושה ימים', detail: 'שלושה ימים ברציפות', test: s => s.days.streak >= 3 },
  { id: 'days-7', title: 'שבוע שלם', detail: 'שבעה ימים ברציפות', test: s => s.days.streak >= 7 },
  { id: 'days-30', title: 'חודש של לימוד', detail: 'שלושים ימים ברציפות', test: s => s.days.streak >= 30 },
  { id: 'correct-100', title: 'מאה', detail: 'מאה תשובות נכונות', test: s => s.correct >= 100 },
  { id: 'correct-500', title: 'חמש מאות', detail: 'חמש מאות תשובות נכונות', test: s => s.correct >= 500 },
  { id: 'advanced', title: 'במעלה', detail: 'חמש תשובות נכונות ברצף ברמה מתקדמת', test: s => s.session.maxDifficultyRun >= 5 },
  { id: 'breadth', title: 'בכל התחומים', detail: 'חמש תשובות נכונות בכל תחום', test: s => CATEGORY_IDS.every(id => (s.byCategory[id]?.correct || 0) >= 5) },
  { id: 'ladder-5', title: 'מדרגת ביטחון', detail: 'חמש מעלות ראשונות בסולם', test: s => (s.ladder?.best || 0) >= 5 },
  { id: 'ladder-10', title: 'עשר מעלות', detail: 'מדרגת הביטחון השנייה בסולם', test: s => (s.ladder?.best || 0) >= 10 },
  { id: 'ladder-15', title: 'סיום הסולם', detail: 'כל חמש עשרה המעלות', test: s => (s.ladder?.wins || 0) >= 1 },
  { id: 'daily', title: 'אתגר יומי', detail: 'אתגר יומי ראשון הושלם', test: s => Object.keys(s.ladder?.daily || {}).length >= 1 },
  { id: 'stage-7', title: 'קרני אור', detail: 'המגן הגיע לשלב השמיני', test: s => s.stage >= 7 },
  { id: 'stage-14', title: 'מגן שלם', detail: 'כל חמישה עשר השלבים', test: s => s.stage >= 14 },
];
