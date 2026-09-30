// Search phrasings added to existing verified answers (stage 6). An answer that already covers a question people ask in
// their own words gets those words here — its ruling, source and wording are untouched. A phrase belongs to an answer
// only when that answer, as written, is the answer to it; a case that a condition changes gets its own entry instead.
export const HALACHA_ALIASES = {
  // Kitchen
  'hal-basic3-microwave-meat-dairy': ['חיממתי אוכל במיקרוגל בעבודה', 'מיקרוגל משותף בעבודה', 'מיקרוגל במשרד בשרי וחלבי', 'איך מכשירים מיקרוגל', 'מקרוגל בשרי וחלבי', 'לחמם בקופסה סגורה במיקרוגל'],
  'hal-bayit-egg-fried-in-meat-pan': ["צ'יפס שטוגן בשמן חדש במחבת בשרית", 'טיגנתי פרווה במחבת בשרית נקייה', 'חביתה במחבת של בשר עם גבינה', 'נותן טעם בר נותן טעם'],
  'hal-bayit-pareve-in-meat-pot': ['אורז שבושל בסיר בשרי עם גבינה', 'פרווה מסיר בשרי אחר כך חלבי', 'בישלתי פסטה בסיר של בשר', 'מאכל פרווה מסיר בשרי נקי'],
  'hal-bayit-pareve-cooked-with-meat': ['אכלתי רק את התפוחי אדמה מהחמין', 'אכלתי רק את הרוטב של הבשר', 'תבשיל של בשר בלי בשר שש שעות', 'אורז מהסיר של העוף'],
  'hal-bayit-six-hours-meat-to-dairy': ['כמה שעות בין בשר לחלב', 'שש שעות בין בשרי לחלבי', 'אחרי עוף מתי אפשר חלבי', 'כמה לחכות אחרי שניצל'],
  'hal-basic3-cheese-cut-meat-knife': ['חתכתי צהובה בסכין בשרית', 'סכין בשרית לגבינה קרה'],
  'hal-basic3-oven-dairy-after-meat': ['אפיתי פיצה בתנור בשרי', 'תנור בשרי ואחר כך חלבי'],
  'hal-basic3-dishwasher-meat-dairy': ['מדיח כלים לבשרי ולחלבי', 'מדיח אחד בבית'],
  'hal-trk-kosher-kitchen-cooked-dairy-in-old-meat-pot': ['בישלתי חלבי חריף בסיר בשרי ישן', 'שקשוקה חלבית בסיר בשרי', 'סיר בשרי לא בן יומו חלבי'],
  'hal-bayit-restaurant-untoveled': ['כלים במסעדה לא טבולים', 'אוכל במסעדה צריך טבילת כלים'],
  // Blessings
  'hal-brachot-shehakol-covers-all': ['בירכתי שהכל במקום מזונות', 'בירכתי שהכל על עוגה', 'בירכתי שהכל במקום האדמה', 'שהכל פוטר הכל', 'בירכתי שהכל בטעות'],
  'hal-basic2-fell-after-bracha': ['נפל לי האוכל אחרי הברכה', 'בירכתי והכוס נשפכה', 'נפל לי הפרי אחרי שבירכתי'],
  'hal-trk-daily-brachot-tasting-cooking': ['טועמת מהסיר תוך כדי בישול ברכה', 'לטעום מהאוכל כשמבשלים'],
  'hal-brachot-water-medicine': ['מים לכדור ברכה', 'שותה מים עם תרופה מברכים'],
  'hal-brachot-gum': ['מסטיק צריך ברכה'],
  // Prayer
  'hal-prayer-tefilat-haderech-flight': ['טסתי לחו"ל תפילת הדרך', 'תפילת הדרך בטיסה לחול', 'תפילת הדרך במטוס'],
  'hal-prayer-phone-ringing-amida': ['הטלפון צלצל באמצע התפילה', 'פלאפון מצלצל בשמונה עשרה'],
  'hal-prayer-doubt-if-prayed': ['לא זוכר אם התפללתי שחרית', 'ספק אם התפללתי מנחה'],
  // Between people
  'hal-chag-appease-before-yk': ['לבקש סליחה מחבר', 'פגעתי בחבר מה עושים'],
};
