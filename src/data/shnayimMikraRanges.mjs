// Canonical weekly Torah readings from Hebcal leyning.torah. The primary Torah
// reading is kept separate from optional maftir references.
const HEBREW = {"Bereshit":"בראשית","Noach":"נח","Lech-Lecha":"לך לך","Vayera":"וירא","Chayei Sara":"חיי שרה","Toldot":"תולדות","Vayetzei":"ויצא","Vayishlach":"וישלח","Vayeshev":"וישב","Miketz":"מקץ","Vayigash":"ויגש","Vayechi":"ויחי","Shemot":"שמות","Vaera":"וארא","Bo":"בא","Beshalach":"בשלח","Yitro":"יתרו","Mishpatim":"משפטים","Terumah":"תרומה","Tetzaveh":"תצוה","Ki Tisa":"כי תשא","Vayakhel":"ויקהל","Pekudei":"פקודי","Vayikra":"ויקרא","Tzav":"צו","Shmini":"שמיני","Tazria":"תזריע","Metzora":"מצורע","Achrei Mot":"אחרי מות","Kedoshim":"קדושים","Emor":"אמור","Behar":"בהר","Bechukotai":"בחוקותי","Bamidbar":"במדבר","Nasso":"נשא","Beha’alotcha":"בהעלותך","Sh’lach":"שלח","Korach":"קרח","Chukat":"חוקת","Balak":"בלק","Pinchas":"פינחס","Matot":"מטות","Masei":"מסעי","Devarim":"דברים","Vaetchanan":"ואתחנן","Eikev":"עקב","Re’eh":"ראה","Shoftim":"שופטים","Ki Teitzei":"כי תצא","Ki Tavo":"כי תבוא","Nitzavim":"נצבים","Vayeilech":"וילך","Ha’azinu":"האזינו","Vezot Haberakhah":"וזאת הברכה"};
const hebrewName = name => HEBREW[name] || name.split('-').map(part => HEBREW[part]).join('־');
const reading = (name, reference, combined = false) => ({ id: name.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-'), name, he: hebrewName(name), reference, combined });

export const SHNAYIM_MIKRA_CANONICAL_RANGES = Object.freeze([
  reading('Bereshit', 'Genesis 1:1-6:8'), reading('Noach', 'Genesis 6:9-11:32'),
  reading('Lech-Lecha', 'Genesis 12:1-17:27'), reading('Vayera', 'Genesis 18:1-22:24'),
  reading('Chayei Sara', 'Genesis 23:1-25:18'), reading('Toldot', 'Genesis 25:19-28:9'),
  reading('Vayetzei', 'Genesis 28:10-32:3'), reading('Vayishlach', 'Genesis 32:4-36:43'),
  reading('Vayeshev', 'Genesis 37:1-40:23'), reading('Miketz', 'Genesis 41:1-44:17'),
  reading('Vayigash', 'Genesis 44:18-47:27'), reading('Vayechi', 'Genesis 47:28-50:26'),
  reading('Shemot', 'Exodus 1:1-6:1'), reading('Vaera', 'Exodus 6:2-9:35'),
  reading('Bo', 'Exodus 10:1-13:16'), reading('Beshalach', 'Exodus 13:17-17:16'),
  reading('Yitro', 'Exodus 18:1-20:23'), reading('Mishpatim', 'Exodus 21:1-24:18'),
  reading('Terumah', 'Exodus 25:1-27:19'), reading('Tetzaveh', 'Exodus 27:20-30:10'),
  reading('Ki Tisa', 'Exodus 30:11-34:35'), reading('Vayakhel', 'Exodus 35:1-38:20'),
  reading('Pekudei', 'Exodus 38:21-40:38'), reading('Vayikra', 'Leviticus 1:1-5:26'),
  reading('Tzav', 'Leviticus 6:1-8:36'), reading('Shmini', 'Leviticus 9:1-11:47'),
  reading('Tazria', 'Leviticus 12:1-13:59'), reading('Metzora', 'Leviticus 14:1-15:33'),
  reading('Achrei Mot', 'Leviticus 16:1-18:30'), reading('Kedoshim', 'Leviticus 19:1-20:27'),
  reading('Emor', 'Leviticus 21:1-24:23'), reading('Behar', 'Leviticus 25:1-26:2'),
  reading('Bechukotai', 'Leviticus 26:3-27:34'), reading('Bamidbar', 'Numbers 1:1-4:20'),
  reading('Nasso', 'Numbers 4:21-7:89'), reading('Beha’alotcha', 'Numbers 8:1-12:16'),
  reading('Sh’lach', 'Numbers 13:1-15:41'), reading('Korach', 'Numbers 16:1-18:32'),
  reading('Chukat', 'Numbers 19:1-22:1'), reading('Balak', 'Numbers 22:2-25:9'),
  reading('Pinchas', 'Numbers 25:10-30:1'), reading('Matot', 'Numbers 30:2-32:42'),
  reading('Masei', 'Numbers 33:1-36:13'), reading('Devarim', 'Deuteronomy 1:1-3:22'),
  reading('Vaetchanan', 'Deuteronomy 3:23-7:11'), reading('Eikev', 'Deuteronomy 7:12-11:25'),
  reading('Re’eh', 'Deuteronomy 11:26-16:17'), reading('Shoftim', 'Deuteronomy 16:18-21:9'),
  reading('Ki Teitzei', 'Deuteronomy 21:10-25:19'), reading('Ki Tavo', 'Deuteronomy 26:1-29:8'),
  reading('Nitzavim', 'Deuteronomy 29:9-30:20'), reading('Vayeilech', 'Deuteronomy 31:1-30'),
  reading('Ha’azinu', 'Deuteronomy 32:1-52'), reading('Vezot Haberakhah', 'Deuteronomy 33:1-34:12'),
  reading('Vayakhel-Pekudei', 'Exodus 35:1-40:38', true), reading('Tazria-Metzora', 'Leviticus 12:1-15:33', true),
  reading('Achrei Mot-Kedoshim', 'Leviticus 16:1-20:27', true), reading('Behar-Bechukotai', 'Leviticus 25:1-27:34', true),
  reading('Chukat-Balak', 'Numbers 19:1-25:9', true), reading('Matot-Masei', 'Numbers 30:2-36:13', true),
  reading('Nitzavim-Vayeilech', 'Deuteronomy 29:9-31:30', true),
]);