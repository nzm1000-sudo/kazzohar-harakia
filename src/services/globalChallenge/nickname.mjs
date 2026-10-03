// האתגר העולמי — the leaderboard nickname. Shared by the app (to say at once what is wrong) and the server (which
// decides: server/challenge-worker imports this very file). Pure.
//
// A nickname: 2–20 characters of Hebrew or English letters, digits and single spaces, with at least one letter. No run
// of six digits or more (a phone or an ID number is personal information, and the board stores none). Not a word of
// the small blocklist (Hebrew and English), not a reserved word (the app's name, staff words, rabbinic titles — the
// board must never look like it speaks for a rabbi or for the app), and unique: two nicknames are the same when their
// keys are (case, final letters and spaces ignored).

export const NICK_MIN = 2;
export const NICK_MAX = 20;

const ALLOWED = /^[A-Za-z0-9א-ת ]+$/;
const LETTER = /[A-Za-zא-ת]/;
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };

// Whole words only (short, or a common word in another sense): matched against each word of the nickname.
const BLOCK_WORDS = ['ass', 'rape', 'nazi', 'nazis', 'shit', 'arse', 'cum', 'fag', 'tit', 'tits', 'sex', 'kkk', 'cock', 'dick', 'piss',
  'כוס', 'זין', 'תחת', 'חרא', 'זונה', 'זונות', 'הומו', 'קוקסינל', 'שרמוטה', 'שרמוטות', 'מזדיין', 'זיון', 'לזיין', 'מניאק', 'מניאקים', 'דביל', 'אידיוט', 'מפגר', 'מטומטם', 'נאצי', 'נאצים', 'היטלר', 'ערס', 'כושי', 'כושים'];
// Anywhere in the nickname (distinctive enough never to be innocent).
const BLOCK_STEMS = ['fuck', 'bitch', 'cunt', 'pussy', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'hitler', 'porn', 'penis', 'vagina', 'bastard', 'retard', 'asshole', 'dildo',
  'שרמוט', 'בנזונה', 'כוסאמ', 'כוסעמ', 'מזדינ', 'קוקסינל', 'היטלר'];
// (Never a stem that hides inside an innocent word: 'nazi' is in Ashkenazi, 'rape' in grape, 'shit' in Shittim, זיונ in
// חזיונות — those are whole words above.)
// Reserved — the app and its staff, and rabbinic titles (words, and stems anywhere).
const RESERVED_WORDS = ['admin', 'mod', 'root', 'staff', 'support', 'system', 'official', 'team', 'rav', 'rebbe', 'rabbi', 'rabbanit',
  'רב', 'הרב', 'רבי', 'רבינו', 'רבנו', 'רבנית', 'הרבנית', 'מרן', 'הגאון', 'גאון', 'אדמור', 'האדמור', 'חכם', 'החכם', 'שליטא', 'זצל', 'זצוקל', 'הרהג', 'הגרי', 'ראשלצ', 'רבה',
  'מנהל', 'מנהלת', 'הנהלה', 'צוות', 'תמיכה', 'מערכת', 'רשמי', 'מפתח', 'מפתחים'];
const RESERVED_STEMS = ['admin', 'moderator', 'kazzohar', 'kazohar', 'zoharharakia', 'harakia', 'administrator',
  'כזוהר', 'זוהרהרקיע', 'הרקיע', 'האדמור', 'הרבהראשי', 'רבראשי'];

// The nickname as it is stored: trimmed, inner spaces collapsed.
export const tidyNickname = value => String(value ?? '').replace(/\s+/g, ' ').trim();
// The comparison key: lower case, final letters as their ordinary form, no spaces.
export const nicknameKey = value => tidyNickname(value).toLowerCase().replace(/[ךםןףץ]/g, ch => FINALS[ch]).replace(/ /g, '');
const words = value => tidyNickname(value).toLowerCase().replace(/[ךםןףץ]/g, ch => FINALS[ch]).split(' ').filter(Boolean);
const deLeet = text => text.replace(/[0-9]/g, d => LEET[d] ?? d);
const finalsOff = list => list.map(w => w.replace(/[ךםןףץ]/g, ch => FINALS[ch]));
const SETS = {
  blockWords: new Set(finalsOff(BLOCK_WORDS)), blockStems: finalsOff(BLOCK_STEMS),
  reservedWords: new Set(finalsOff(RESERVED_WORDS)), reservedStems: finalsOff(RESERVED_STEMS),
};

// { ok, nickname, key, reason } — reason: 'length' · 'chars' · 'letter' · 'digits' · 'blocked' · 'reserved'.
export function checkNickname(value) {
  const nickname = tidyNickname(value);
  const fail = reason => ({ ok: false, nickname, key: nicknameKey(nickname), reason });
  if (nickname.length < NICK_MIN || nickname.length > NICK_MAX) return fail('length');
  if (!ALLOWED.test(nickname)) return fail('chars');
  if (!LETTER.test(nickname)) return fail('letter');
  if (/\d{6,}/.test(nickname.replace(/ /g, ''))) return fail('digits');
  const key = nicknameKey(nickname);
  const variants = [key, deLeet(key)];
  const ws = words(nickname);
  const wordVariants = [...ws, ...ws.map(deLeet)];
  if (wordVariants.some(w => SETS.blockWords.has(w)) || variants.some(v => SETS.blockStems.some(s => v.includes(s)))) return fail('blocked');
  if (wordVariants.some(w => SETS.reservedWords.has(w)) || variants.some(v => SETS.reservedStems.some(s => v.includes(s)))) return fail('reserved');
  return { ok: true, nickname, key, reason: null };
}

// What the app says for each reason.
export const NICKNAME_MESSAGES = Object.freeze({
  length: `כינוי של ${NICK_MIN} עד ${NICK_MAX} תווים`,
  chars: 'רק אותיות בעברית או באנגלית, ספרות ורווחים',
  letter: 'כינוי צריך לכלול לפחות אות אחת',
  digits: 'בלי מספרים ארוכים — הכינוי לא צריך פרטים אישיים',
  blocked: 'הכינוי הזה אינו מתאים',
  reserved: 'הכינוי הזה שמור — אפשר לבחור אחר',
  taken: 'הכינוי כבר תפוס — אפשר לבחור אחר',
  set: 'כבר נבחר כינוי',
});
