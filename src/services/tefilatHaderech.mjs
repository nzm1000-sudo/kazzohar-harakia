import { REVIEW_STATES } from './forgottenAdditions.mjs';

// Text and source metadata are stored apart; practical scope stays below production-approved.
export const TEFILAT_HADERECH = Object.freeze({
  id: 'tefilat-haderech',
  title: 'תפילת הדרך',
  source: { primary: 'תלמוד בבלי, ברכות כ״ט ע״ב', secondary: 'שולחן ערוך אורח חיים ק״י' },
  reviewState: REVIEW_STATES.SOURCE_VERIFIED,
  note: 'נהוג לאומרה לאחר היציאה מן העיר, בלשון רבים.',
  // Distance, urban continuity and unusual flight or sea cases are deliberately not ruled on.
  openQuestions: [
    'שיעור הדרך המחייב',
    'רצף עירוני ויציאה מן העיר',
    'טיסה, הפלגה ונסיעות חריגות',
  ],
  text: [
    'יְהִי רָצוֹן מִלְּפָנֶיךָ ה׳ אֱלֹהֵינוּ וֵאלֹהֵי אֲבוֹתֵינוּ, שֶׁתּוֹלִיכֵנוּ לְשָׁלוֹם וְתַצְעִידֵנוּ לְשָׁלוֹם וְתַדְרִיכֵנוּ לְשָׁלוֹם, וְתַגִּיעֵנוּ לִמְחוֹז חֶפְצֵנוּ לְחַיִּים וּלְשִׂמְחָה וּלְשָׁלוֹם.',
    'וְתַצִּילֵנוּ מִכַּף כָּל אוֹיֵב וְאוֹרֵב וְלִסְטִים וְחַיּוֹת רָעוֹת בַּדֶּרֶךְ, וּמִכָּל מִינֵי פֻּרְעָנֻיּוֹת הַמִּתְרַגְּשׁוֹת לָבוֹא לָעוֹלָם.',
    'וְתִשְׁלַח בְּרָכָה בְּכָל מַעֲשֵׂה יָדֵינוּ, וְתִתְּנֵנִי לְחֵן וּלְחֶסֶד וּלְרַחֲמִים בְּעֵינֶיךָ וּבְעֵינֵי כָל רוֹאֵינוּ, וְתִשְׁמַע קוֹל תַּחֲנוּנֵינוּ.',
    'בָּרוּךְ אַתָּה ה׳, שׁוֹמֵעַ תְּפִלָּה.',
  ],
});

export function tefilatHaderechPractical() {
  return {
    practical: TEFILAT_HADERECH.reviewState === REVIEW_STATES.PRODUCTION_APPROVED,
    notice: 'פרטי ההלכה דורשים בירור לפי תנאי הדרך',
  };
}
