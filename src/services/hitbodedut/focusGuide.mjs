// The short, honest explainer: how to make an iOS Focus called "התבודדות". The app cannot silence notifications
// itself (no app can) — the screen says so plainly and never claims it did.
export const FOCUS_NAME = 'התבודדות';

export const FOCUS_INTRO = 'כזוהר הרקיע אינה יכולה להשתיק התראות בעצמה — אף אפליקציה אינה יכולה. מצב מיקוד של iPhone יכול, ואפשר להגדיר אותו פעם אחת.';

export const FOCUS_STEPS = Object.freeze([
  { title: 'פותחים את ההגדרות', text: 'הגדרות ← מצבי ריכוז (Focus), ושם ＋ להוספה.' },
  { title: 'בוחרים „מותאם אישית”', text: `נותנים שם: „${FOCUS_NAME}”, ובוחרים סמל וצבע.` },
  { title: 'מי ומה מותר', text: 'בוחרים אנשים ואפליקציות שמותר להם להגיע (אפשר אף אחד). אפשר לאפשר שיחות חוזרות לשעת חירום.' },
  { title: 'הפעלה', text: 'ממרכז הבקרה: נגיעה ארוכה ב„מצבי ריכוז” ← „התבודדות”. או אוטומטית — ראו למטה.' },
]);

export const FOCUS_AUTOMATION = 'אוטומטית: באפליקציית קיצורים ← אוטומציה ← „מצב ריכוז” ← „התבודדות” ← „כאשר מופעל”, ובוחרים את הפעולה „התחל התבודדות” של כזוהר הרקיע. כך הדלקת המצב תפתח את מסך ההתבודדות.';

export const FOCUS_HONEST = 'המצב פועל במכשיר שלך ובשליטתך. האפליקציה אינה רואה אותו ואינה יודעת אם הופעל.';
