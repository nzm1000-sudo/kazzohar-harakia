// Small line drawings for the personal tools — one stroke weight, one 24px grid, drawn in the theme's accent.
const Svg = ({ children }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;

export const ToolIcon = {
  // דף שבת: two small candles
  shabbat: () => <Svg><path d="M8.5 3.2c1 1.2 1.5 2 1.5 2.8a1.5 1.5 0 0 1-3 0c0-.8.5-1.6 1.5-2.8zM15.5 3.2c1 1.2 1.5 2 1.5 2.8a1.5 1.5 0 0 1-3 0c0-.8.5-1.6 1.5-2.8z" /><rect x="6.8" y="9" width="3.4" height="11" rx=".8" /><rect x="13.8" y="9" width="3.4" height="11" rx=".8" /><path d="M5 20.5h14" /></Svg>,
  // מועדפים: a heart
  favorites: () => <Svg><path d="M12 19.5s-7-4.3-7-9.3A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.2c0 5-7 9.3-7 9.3z" /></Svg>,
  // המסורת שלי: a small globe
  tradition: () => <Svg><circle cx="12" cy="12" r="8" /><ellipse cx="12" cy="12" rx="3.4" ry="8" /><path d="M4.3 9.5h15.4M4.3 14.5h15.4" /></Svg>,
  // הפרשה שלי: an open book
  parasha: () => <Svg><path d="M12 6.5c-1.8-1.4-4.4-1.8-7.5-1.5v13c3.1-.3 5.7.1 7.5 1.5 1.8-1.4 4.4-1.8 7.5-1.5V5c-3.1-.3-5.7.1-7.5 1.5zM12 6.5v13" /></Svg>,
  // ממיר תאריכים: a calendar
  dates: () => <Svg><rect x="4.5" y="5.5" width="15" height="14" rx="2" /><path d="M4.5 9.5h15M8.5 3.5v4M15.5 3.5v4M8 13h2M11.5 13h2M15 13h1.5M8 16.2h2M11.5 16.2h2" /></Svg>,
  // הפסוק שלי: a parchment scroll
  verse: () => <Svg><path d="M7 5.5h10.5a2 2 0 0 1 0 4H17v8.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1 0-4H7z" /><path d="M7 16a2 2 0 0 1 2 2M7 5.5a2 2 0 0 0-2 2 2 2 0 0 0 2 2M10 10h4.5M10 12.8h4.5" /></Svg>,
  // שמות לתינוקות: a small baby
  baby: () => <Svg><circle cx="12" cy="7.5" r="3.3" /><path d="M11 4.4c.4-.9 1.4-1.2 2.1-.7" /><path d="M7.5 20c0-4.2 2-7.2 4.5-7.2s4.5 3 4.5 7.2" /><path d="M8.5 15.2l-2.2 1.3M15.5 15.2l2.2 1.3" /></Svg>,
  // מחשבון גימטריה: a calculator
  calculator: () => <Svg><rect x="6" y="3.5" width="12" height="17" rx="2" /><rect x="8.3" y="5.8" width="7.4" height="3.2" rx=".6" /><path d="M9 12.2h.01M12 12.2h.01M15 12.2h.01M9 15.2h.01M12 15.2h.01M15 15.2h.01M9 18.1h.01M12 18.1h.01M15 18.1h.01" strokeWidth="2.2" /></Svg>,
  // נר זיכרון: a single memorial candle in a small glass
  memorial: () => <Svg><path d="M12 3.2c1.3 1.6 2 2.7 2 3.7a2 2 0 0 1-4 0c0-1 .7-2.1 2-3.7z" /><path d="M12 9v1.6" /><path d="M8 11h8l-.9 8.2a1.5 1.5 0 0 1-1.5 1.3h-3.2a1.5 1.5 0 0 1-1.5-1.3z" /></Svg>,
  // מצב נסיעה: a plane
  travel: () => <Svg><path d="M21 12.5l-7.5-2.2V5a1.5 1.5 0 0 0-3 0v5.3L3 12.5v1.8l7.5-1.4V17l-2.2 1.6v1.4l3.7-1 3.7 1v-1.4L13.5 17v-4.1l7.5 1.4z" /></Svg>,
};
