// Three divrei torah for every Shabbat and festival, rotating with the week (Sunday → Motzaei Shabbat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLIDAY_DIVREI_TORAH, PARASHA_DIVREI_TORAH } from '../src/data/divreiTorah.mjs';
import { HOLIDAY_LABELS, comingShabbatKey, holidayIdFor, weeklyDivreiTorah } from '../src/services/weeklyDivreiTorah.mjs';

const PARASHOT = ['בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק', 'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'];

test('exactly three complete divrei torah for every parasha and every festival', () => {
  assert.deepEqual(Object.keys(PARASHA_DIVREI_TORAH).sort(), [...PARASHOT].sort());
  assert.deepEqual(Object.keys(HOLIDAY_DIVREI_TORAH).sort(), Object.keys(HOLIDAY_LABELS).sort());
  for (const [key, list] of [...Object.entries(PARASHA_DIVREI_TORAH), ...Object.entries(HOLIDAY_DIVREI_TORAH)]) {
    assert.equal(list.length, 3, key);
    assert.equal(new Set(list.map(d => d.title)).size, 3, `${key}: distinct titles`);
    for (const d of list) {
      assert.ok(d.title?.trim() && d.text?.length > 80 && d.source?.trim(), `${key}: ${d.title}`);
      assert.doesNotMatch(`${d.title} ${d.text} ${d.source}`, /[א-ת]["'][א-ת]|\s[,.:;]|יהוה/, `${key}: typography — ${d.title}`);
    }
  }
});

test('the week runs Sunday to Shabbat; after Motzaei Shabbat (a Sunday key) the next Shabbat is the focus', () => {
  assert.equal(comingShabbatKey('2026-10-04'), '2026-10-10');
  assert.equal(comingShabbatKey('2026-10-08'), '2026-10-10');
  assert.equal(comingShabbatKey('2026-10-10'), '2026-10-10');
  const week = weeklyDivreiTorah({ items: [], todayKey: '2026-10-04', parashaName: 'פרשת בראשית' });
  assert.equal(week.kind, 'parasha');
  assert.equal(week.name, 'פרשת בראשית');
  assert.equal(week.items.length, 3);
  assert.equal(weeklyDivreiTorah({ todayKey: '2026-10-04', parashaName: 'תזריע־מצורע' }).id, 'תזריע', 'combined readings use the first half');
});

test('a festival during the week — today, before Shabbat or on Shabbat — replaces the parasha', () => {
  const sukkot = [
    { category: 'holiday', date: '2026-09-27', title: 'Sukkot II (CH’’M)', hebrew: 'סוכות ב׳ (חוה״מ)' },
    { category: 'holiday', date: '2026-10-03', title: 'Shmini Atzeret', hebrew: 'שמיני עצרת' },
  ];
  assert.equal(weeklyDivreiTorah({ items: sukkot.slice(0, 1), todayKey: '2026-09-27', parashaName: 'בראשית' }).id, 'sukkot', 'Chol HaMoed today');
  assert.equal(weeklyDivreiTorah({ items: sukkot, todayKey: '2026-09-27', parashaName: 'בראשית' }).id, 'shmini-atzeret', 'Chol HaMoed today, but the Shabbat itself is שמיני עצרת');
  assert.equal(weeklyDivreiTorah({ items: sukkot.slice(1), todayKey: '2026-09-29', parashaName: 'בראשית' }).id, 'shmini-atzeret', 'festival on Shabbat');
  const chanukah = [{ category: 'holiday', date: '2026-12-08', title: 'Chanukah: 3 Candles', hebrew: 'חנוכה: ג׳ נרות' }];
  const midweek = weeklyDivreiTorah({ items: chanukah, todayKey: '2026-12-06', parashaName: 'וישב' });
  assert.equal(midweek.kind, 'holiday');
  assert.equal(midweek.name, 'חנוכה');
  assert.equal(weeklyDivreiTorah({ items: chanukah, todayKey: '2026-12-13', parashaName: 'מקץ' }).kind, 'parasha', 'past festivals do not linger');
  assert.equal(weeklyDivreiTorah({ items: [{ category: 'holiday', date: '2027-04-11', title: 'Purim' }], todayKey: '2027-03-28', parashaName: 'צו' }).kind, 'parasha', 'a festival after this Shabbat waits for its own week');
});

test('Erev days, Pesach Sheni and Purim Katan are not festivals', () => {
  assert.equal(holidayIdFor({ category: 'holiday', title: 'Erev Sukkot' }), null);
  assert.equal(holidayIdFor({ category: 'holiday', title: 'Pesach Sheni' }), null);
  assert.equal(holidayIdFor({ category: 'holiday', title: 'Purim Katan' }), null);
  assert.equal(holidayIdFor({ category: 'holiday', title: "Tish'a B'Av" }), 'tisha-bav');
  assert.equal(holidayIdFor({ category: 'holiday', title: 'Lag BaOmer' }), 'lag-baomer');
  assert.equal(holidayIdFor({ category: 'candles', title: 'Sukkot' }), null);
});
