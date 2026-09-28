# Nusach Chabad: composition notes

Composition: `src/data/nusach/compositions/chabad.mjs` (nusach id `chabad`). Two licensed Chabad editions are used,
and each service is composed from one edition only:

- **Siddur Torah Or** (pack index `Weekday Siddur Chabad`): Sefaria's Wikisource transcription, CC BY-SA. Used for
  the weekday services, Bedtime Shema, Birkat HaMazon, Hallel, the Rosh Chodesh Musaf and the Omer.
- **Siddur Tehillat Hashem** (`extraIndexes: ['Siddur Tehillat Hashem']`): the Open Siddur transcription by Shmuel
  Gonzales, CC0 for the Hebrew and CC BY 4.0 for the instructions. Used for Shabbat, Havdalah and Yom Tov. See the
  "Shabbat and Yom Tov" section below.

Every section is a slice of one of these editions. No word is typed in, and nothing comes from another rite.

QA (`node scripts/siddur-qa.mjs chabad`), 2026-09-28:

| Service | Edition | Level |
|---|---|---|
| weekday-shacharit | Torah Or | VERIFIED COMPLETE |
| weekday-mincha | Torah Or | VERIFIED COMPLETE |
| weekday-maariv | Torah Or | VERIFIED COMPLETE |
| bedtime-shema | Torah Or | VERIFIED COMPLETE |
| kabbalat-shabbat | Tehillat Hashem | VERIFIED COMPLETE |
| shabbat-maariv | Tehillat Hashem | VERIFIED COMPLETE |
| shabbat-kiddush | Tehillat Hashem | VERIFIED COMPLETE |
| shabbat-shacharit | Tehillat Hashem | TEXT COMPLETE / CONDITIONS PENDING (Birkat HaChodesh, Av HaRachamim) |
| shabbat-musaf | Tehillat Hashem | VERIFIED COMPLETE (but see the Kedusha doubt below) |
| shabbat-kiddush-day | Tehillat Hashem | VERIFIED COMPLETE |
| shabbat-mincha | Tehillat Hashem | TEXT COMPLETE / CONDITIONS PENDING (Tzidkatcha) |
| havdalah | Tehillat Hashem | VERIFIED COMPLETE |
| birkat-hamazon | Torah Or | VERIFIED COMPLETE |
| hallel | Torah Or | VERIFIED COMPLETE |
| rosh-chodesh-musaf | Torah Or | VERIFIED COMPLETE |
| omer | Torah Or | VERIFIED COMPLETE |
| festival-amidah | Tehillat Hashem | TEXT COMPLETE / CONDITIONS PENDING (no key for which prayer is being said) |
| festival-musaf | Tehillat Hashem | TEXT COMPLETE / CONDITIONS PENDING (the day within the festival) |

No source gaps remain.

## How it was checked

- I read every leaf I used in the dump. For each paragraph I checked its opening and closing words. For every
  paragraph that could hold two parts (Amidah insertions, the Tachanun leaves, Kaveh ¶1, Birkat HaMazon ¶27/¶31,
  Bedtime ¶0/¶7/¶21, Hallel ¶15/¶20/¶22–27, the Musaf leaves, Maariv ¶5–15/¶27/¶58–66) I read the full text
  (`--full`).
- I read the full Mincha Amidah leaf from start to end.
- **Tehillat Hashem.**
  - For every leaf used I checked each paragraph's opening and closing words, including the English ones.
  - I read in full every Hebrew paragraph longer than the dump's excerpt for Kabbalat Shabbat, Shabbat Maariv, the
    Shabbat Book leaves, Shabbat Pesukei Dezimra and Shema, the Shabbat Amidah, the Song of the Day, the Torah
    Reading, the Musaf Kedushat HaYom, and the festival Amidah and Musaf.
  - I composed Shabbat Shacharit, Musaf, Mincha and Maariv in prayer mode for a Shabbat, and the festival Musaf for
    Chol HaMoed Sukkot.
- I checked the ordering against the edition's own node order (Upon Arising, Morning Blessings, Tzitzit and Tallit,
  Tefillin, Morning Prayer, Kaddish DeRabbanan, Hodu, Pesukei Dezimra, …, Song of the Day, Mourner's Kaddish, Kaveh,
  Aleinu, Rabbenu Tam, Six Remembrances), against the edition's instructions, and against standard Chabad practice.
- I composed each service in prayer mode for sample days: an ordinary Monday, Rosh Chodesh with half Hallel,
  Motzaei Shabbat, Chanukah Mincha, and Tisha B'Av Mincha. The right sections came and went each time.

## Weekday Shacharit

Order:

1. Modeh Ani, then Netilat Yadayim.
2. Asher Yatzar, then Elokai Neshama.
3. Birchot HaShachar, then Birchot HaTorah (with the Birkat Kohanim verses and Elu Devarim).
4. Tzitzit, then Tallit Gadol.
5. Tefillin.
6. Hareini, Mah Tovu, Adon Olam.
7. The Akeida. Its Yehi Ratzon before and Ribono shel Olam after are marked `tachanun`, as the edition says: "ביום
   שאין אומרים תחנון אין אומרים זה".
8. Le'olam Yehei Adam.
9. Korbanot:
   - Terumat HaDeshen.
   - Yehi Ratzon (`tachanun`).
   - Tamid.
   - Ketoret.
   - Abaye.
   - Ana Bekoach.
   - Ribon HaOlamim (`tachanun`).
   - Eizehu Mekoman.
   - Rabbi Yishmael.
10. Kaddish DeRabbanan.
11. Hodu, then Mizmor Shir Chanukat HaBayit, then Kaddish Yatom. The edition prints no Kaddish here. It is taken from
    the edition's own Mourner's Kaddish leaf.
12. Hashem Melech, Hoshienu, and Lamenatzeach Binginot. These are all in the Hodu leaf.
13. Pesukei Dezimra:
    - Baruch She'amar, which opens with the edition's Leshem Yichud.
    - Mizmor LeToda.
    - Yehi Chevod.
    - Ashrei. Its concept is `pesukei-dezimra`, so that the spine's `ashrei` is the one after Tachanun.
    - Halleluyah.
    - Vayevarech David.
    - Shirat HaYam.
    - Yishtabach.
    - Shir HaMa'alot MiMa'amakim (`aseret`).
    - Half Kaddish, then Barchu.
14. Shema and its blessings. The Amidah, blessing by blessing:
    - The Kedusha (Nekadishach), Modim DeRabbanan, the chazzan's Aneinu (`fast`) and Birkat Kohanim are `repetition`.
    - Ya'aleh VeYavo is marked `roshChodesh|cholHamoed`.
    - Al HaNisim, with Bimei Matityahu (`chanukah`) and Bimei Mordechai (`purim`) as their own sections.
    - Sim Shalom every day, following Nusach HaAri.
15. Hallel (`hallel`).
16. Tachanun:
    - Vidui and the 13 Attributes.
    - Nefilat Apayim (Ledavid Elecha).
    - The Monday/Thursday supplications ¶9–30, marked `mondayThursday&tachanun`. The edition closes them with "ע"כ מה
      שמוסיפין בשני ובחמישי".
    - Avinu Malkeinu (`avinuMalkeinu`).
    - The short Avinu Malkeinu, then Va'anachnu Lo Neda (`tachanun`).
17. The rest of the order depends on the day, following the edition's instruction after Hallel (Hallel ¶25–27):

    **An ordinary day**, and also Chanukah:
    1. Half Kaddish.
    2. When there is a reading: El Erech Apayim (`mondayThursday&tachanun`), taking out the Torah, the reading,
       HaGomel, Baruch Shepetarani, half Kaddish, and Hagbaha. The half Kaddish is only an instruction in the edition
       (Torah Reading ¶15); its text is taken from the Mourner's Kaddish leaf ¶0.
    3. Ashrei, Lamenatzeach (`tachanun`), Uva LeZion.
    4. Kaddish Titkabal, then Yehalelu (`torahReading`). The edition prints this order in the leaf, and its Chanukah
       instruction repeats it.
    5. Tefila LeDavid (`tachanun`).
    6. Beit Yaakov, then Shir HaMa'alot LeDavid.
    7. The Song of the Day. Each day is its own section, marked `dayN&!roshChodesh&!cholHamoed`.
    8. Kaddish Yatom.
    9. LeDavid Hashem Ori, then Kaddish Yatom, both in the Elul season.

    **Rosh Chodesh and Chol HaMoed:**
    1. Kaddish Shalem after Hallel.
    2. The Song of the Day.
    3. Kaddish Yatom.
    4. Barchi Nafshi, then Kaddish Yatom (Rosh Chodesh).
    5. LeDavid, then Kaddish Yatom (in its season).
    6. The Torah reading.
    7. Ashrei and Uva LeZion.
    8. Yehalelu.
    9. Musaf. For Rosh Chodesh it is the whole Rosh Chodesh leaf, which opens with half Kaddish and ends with Kaddish
       Titkabal. For Chol HaMoed it is the Musaf for Festivals leaf, followed by Kaddish Titkabal.
    10. Beit Yaakov, and on from there.
18. Kaveh, Ein Keloheinu, Pitum HaKetoret, Tana Devei Eliyahu, Kaddish DeRabbanan.
19. Aleinu, Kaddish Yatom, Al Tira.
20. Rabbenu Tam Tefillin, then the Six Remembrances.

Conditions I added from practice, not printed in the edition:

- Tallit Gadol is marked `!tishaBav`.
- Tefillin and Rabbenu Tam are marked `!tishaBav&!cholHamoed`. There are no Tefillin at Shacharit of Tisha B'Av, and
  in Chabad custom no Tefillin on Chol HaMoed.
- Kaddish Yatom after LeDavid.
- Kaddish Titkabal after the Chol HaMoed Musaf.

Doubts:

- The Monday/Thursday Vehu Rachum (¶9–30) comes after Nefilat Apayim, as the edition prints it. Shomer Yisrael is
  inside that run, so it is said only on Monday and Thursday. That is the edition's statement, and I did not change it.
- Psalm 67, Lamenatzeach Binginot (Hodu ¶7), is printed before Baruch She'amar. I kept it as printed.
- On Rosh Chodesh, Rabbenu Tam Tefillin stay in their printed place after Aleinu. The edition says the Rashi Tefillin
  are removed before the Kaddish that precedes Musaf (Hallel ¶27), and the composition does not repeat that.
- Tisha B'Av Shacharit (Kinot, no Tefillin) is not in the edition. Only the Tallit and Tefillin conditions reflect it.
- The Hallel instruction ¶25–27 stays in Shacharit as printed. It describes the same Rosh Chodesh and Chol HaMoed
  order that the conditions now produce.

## Weekday Mincha

Order:

1. Tamid, then Ketoret. Ketoret includes the closing verses, and Ana Bekoach follows.
2. Ashrei, then half Kaddish.
3. The Amidah:
   - Aneinu for the individual in Shomea Tefila (`fast`) and for the chazzan (role `repetition`, `fast`).
   - Nachem (`tishaBav`).
   - Birkat Kohanim on a fast day (`repetition`, `fast`).
   - Sim Shalom every day.
4. Tachanun:
   - Vidui and the 13 Attributes.
   - Nefilat Apayim.
   - Avinu Malkeinu (`avinuMalkeinu`).
   - The short Avinu Malkeinu and Va'anachnu Lo Neda.
5. Kaddish Titkabal.
6. LeDavid Hashem Ori (`ledavid`). The edition places it before Aleinu at Mincha: "מר"ח אלול עד הושענא רבא אומרים
   כאן".
7. Aleinu, Kaddish Yatom, Al Tira.

Doubts:

- **Nachem.** Mincha Amidah ¶22 ends with "ברוך אתה יי, בונה ירושל͏ם" and carries the note "(בתשעה באב אומרים כאן
  נחם)". ¶23 (Nachem) ends with its own chatima, "מנחם ציון ובונה ירושלים". The composition works at paragraph level,
  so on Tisha B'Av both endings are shown. Fixing this needs a text-level rule.
- The Torah reading at Mincha of a fast day (Vayechal) is not in the edition.

## Weekday Maariv

Order:

1. Vehu Rachum. The edition prints it before Shir HaMa'alot Hinei Barchu, which is also concept `vehu-rachum`.
2. Half Kaddish, then Barchu.
3. HaMa'ariv Aravim, Ahavat Olam, Shema, Emet VeEmuna, Hashkiveinu.
4. Half Kaddish.
5. The Amidah, with Atah Chonantanu (`motzaeiShabbat`). There is no repetition.
6. The Kaddish depends on the night, following ¶58: "קדיש שלם (וכשאומרים ויהי נועם, חצי קדיש)".
   - An ordinary night: Kaddish Titkabal (`!motzaeiShabbat`).
   - Motzaei Shabbat: half Kaddish, Vihi Noam with Yoshev BeSeter, Ve'atah Kadosh, then Kaddish Titkabal. The Kaddish
     is the same ¶59–62, marked `rewind`.
7. The Counting of the Omer (`omer`), the whole Omer leaf.
8. Aleinu, Kaddish Yatom, Al Tira.

Doubts:

- The edition has no Vayiten Lecha and no Havdalah.
- Atah Chonantanu is also said on Motzaei Yom Tov, but the composer has no key for that night. It is marked only
  `motzaeiShabbat`.
- Chabad counts the Omer before Aleinu. On Motzaei Shabbat the Omer comes after Ve'atah Kadosh and its Kaddish.

## Other services

- **Bedtime Shema.** The sections run in the edition's order:
  1. Ribono shel Olam HaReini Mochel.
  2. Hashkiveinu.
  3. Shema.
  4. Ya'alzu Chasidim.
  5. Yoshev BeSeter.
  6. Vidui.
  7. Yehi Ratzon, over the letters of the Name.
  8. Ana Bekoach.
  9. Psalm 51, then Psalm 121.
  10. The protective verses.
  11. Ribon HaOlamim.
  12. The note and the charm before marital union (¶23–24, kept as printed and titled "קודם הזיווג").
  13. HaMapil, last, as in the Alter Rebbe's order.
- **Birkat HaMazon.**
  - Al Naharot Bavel and Psalm 67 (`tachanun`), or Shir HaMa'alot and Psalm 87 (`!tachanun`).
  - Avarcha, Mayim Acharonim, Zimun.
  - The four blessings: Al HaNisim, Chanukah and Purim as their own sections, and Ya'aleh VeYavo marked
    `roshChodesh|cholHamoed`.
  - HaRachaman, then Yiru.
  - The Rosh Chodesh and Sukkot HaRachaman lines and "מגדול" stay as printed. The engine handles their captions.
- **Hallel.** On half-Hallel days, the verses skipped from Lo Lanu and Ahavti are sections marked `fullHallel`. The
  edition's caption "בראש חודש ובחוה"מ פסח מדלגין:" says Rosh Chodesh, yet the day engine reads it as a condition. I
  put it at the end of the section before the skip. There it governs nothing: it is shown on Rosh Chodesh and hidden
  on Chanukah. VeAvraham Zaken (¶22–24) is `optional`, `roshChodesh`.
- **Rosh Chodesh Musaf.** The whole leaf: half Kaddish, the Amidah (Keter, Modim DeRabbanan, Birkat Kohanim as
  `repetition`, Al HaNisim marked `chanukah`), and Kaddish Titkabal. Suspicious: ¶12 has no "ולכפרת פשע" for a leap
  year.
- **Omer.** Sections: the blessing, the 49 days, HaRachaman, Lamenatzeach, Ana Bekoach, Ribono shel Olam.
- **Festival Musaf (Torah Or).** The Chol HaMoed Musaf leaf (Pesach verses `pesach`, Sukkot ¶21–44 `sukkot`) is used
  only inside weekday Shacharit on Chol HaMoed. The `festival-musaf` service is now composed from Tehillat Hashem,
  which is complete for Yom Tov and Chol HaMoed.

## Shabbat and Yom Tov (Siddur Tehillat Hashem)

The English captions of this edition cannot be read by the day engine. So every insertion they govern is its own
section with a `when`:

- the Ten Days' additions (`aseret`);
- מוריד הטל / משיב הרוח (`summer` / `winter`);
- Ya'aleh VeYavo with its day names (`roshChodesh`, `cholHamoed&pesach`, `cholHamoed&sukkot`);
- Al HaNisim (`chanukah`);
- the festival names (`pesach`, `shavuot`, `sukkot`, `sheminiAtzeret`);
- the Shabbat additions (`shabbat`);
- Vatodienu (`motzaeiShabbat`).

Anchors are the edition's own English captions and Hebrew sub-headings (`^אבות$`, `^קדושת השם$`, "From Rosh HaShanah
to Yom Kippur" …). A Kaddish ends at `^עשה שלום`, because the English bowing notes quote those words.

- **Kabbalat Shabbat.**
  1. Before Mincha on Friday: Psalm 107 (`!yomTov&!cholHamoed`), Patach Eliyahu, Yedid Nefesh. The edition says
     weekday Mincha follows, without Tachanun.
  2. Lechu Neranena to Psalm 99 (`!yomTov&!cholHamoed`), then Psalm 29 and Ana Bekoach.
  3. Lecha Dodi, Psalms 92–93, Kaddish Yatom.
  4. Kegavna, and the added Zohar passage for one praying without a minyan.
- **Shabbat Maariv.**
  1. Shir HaMa'alot is marked `!shabbat`; it is for a Yom Tov night on a weekday.
  2. Half Kaddish, Barchu, the blessings, Shema, and Hashkiveinu in its Shabbat form.
  3. The verses of the day (ושמרו …) are omitted, because the edition says they are "not the Chabad tradition".
  4. Half Kaddish, then the Amidah (אתה קדשת).
  5. Vayechulu, then the chazzan's Magen Avot.
  6. Kaddish Titkabal, Psalm 23, half Kaddish, Barchu.
  7. The Omer, from Tehillat Hashem's own Omer leaf (`omer`).
  8. Aleinu, Kaddish Yatom, Al Tira.
- **Shabbat meal.** Shalom Aleichem and Eshet Chayil, then Mizmor LeDavid and Atkinu, then Kiddush. The Sukkah
  blessing is marked `sukkot`. Azamer Bishvachin follows.
- **Kiddusha Rabba.** Mizmor LeDavid, Atkinu, VeShamru and Im Tashiv, then the Kiddush. The Sukkah blessing is
  `sukkot`. Netilat Yadayim, then Asader.
- **Shabbat Shacharit.**
  1. Hodu, Mizmor Shir Chanukat HaBayit, Hashem Melech.
  2. The Shabbat psalms, which Nusach HaAri says before Baruch She'amar: Psalms 19, 33, 34, 90, 91, 98, 121–124, 135,
     136, then HaAderet VeHaEmunah.
  3. Baruch She'amar, then Psalms 92–93, Yehi Chevod, Ashrei and the Halleluyahs.
  4. Vayevarech David, Shirat HaYam, Nishmat, Yishtabach, then MiMa'amakim (`aseret`).
  5. Half Kaddish and Barchu.
  6. Yotzer, then El Adon and LaKel Asher Shavat (`shabbat`). HaMe'ir is `!shabbat`, for Yom Tov on a weekday. Then
     Ahavat Olam, Shema and Emet VeYatziv.
  7. The Amidah (Yismach Moshe; the Kedusha and Birkat Kohanim as `repetition`), then Kaddish Titkabal.
  8. The Song of the Day, Barchi Nafshi (`roshChodesh`), LeDavid (`ledavid`), Kaddish Yatom.
  9. The Torah service:
     - Ata Hareita and Vayehi Binsoa.
     - The 13 Attributes and Ribono shel Olam (`yomTov&!shabbat`).
     - Brich Shmei and taking out the Torah.
     - The reading, HaGomel, Baruch Shepetarani and the Mi Sheberach prayers. The weekday prayer for the sick is
       `!shabbat`.
     - Half Kaddish and Hagbaha.
     - The Haftarah blessings: the Shabbat ending is `!yomTov`, the festival ending `yomTov`.
     - Yekum Purkan (`shabbat`), Birkat HaChodesh and Av HaRachamim (both pending), Ashrei, Yehalelu, and the half
       Kaddish before Musaf.
- **Shabbat Musaf.**
  1. The Amidah: Tikanta Shabbat `!roshChodesh`, Ata Yatzarta `roshChodesh`; the Kedusha and Birkat Kohanim as
     `repetition`.
  2. Kaddish Titkabal.
  3. Kaveh, Ein Keloheinu, Pitum HaKetoret, Tana Devei Eliyahu, Kaddish DeRabbanan.
  4. Aleinu, Kaddish Yatom, Al Tira.
  5. The Showbread passage and the Six Remembrances.
- **Shabbat Mincha.**
  1. The Tamid and Ketoret, Ana Bekoach, Ashrei, Uva LeZion.
  2. Half Kaddish, then Va'ani Tefilati.
  3. The Torah reading (`shabbat`): taking out, three aliyot, Hagbaha, half Kaddish, Yehalelu.
  4. The Amidah (Ata Echad).
  5. Tzidkatcha, which is pending.
  6. Kaddish Titkabal, then Aleinu, Kaddish Yatom, Al Tira.

  **The only mixed-leaf use: Kaddish Titkabal.** The Shabbat Mincha leaves say "followed by the Full-Kaddish" but
  print none. The Kaddish Shalem is therefore taken from the same edition's Musaf leaf (¶94–103). The rest of that
  leaf is `omit`, with the reason that it belongs to Shabbat Musaf.
- **Havdalah.** Hineh El Yeshuati, then the blessings. Vayiten Lecha follows ("For the Conclusion of Shabbat"),
  because the edition says it is read "upon completion of Havdalah". So it is here, not in weekday Maariv.
- **Festival Amidah.** It covers Shacharit, Mincha and Maariv of Yom Tov:
  - Both Kedushot are printed, one for Shacharit and one for Mincha; see pending.
  - Vatodienu (`motzaeiShabbat`).
  - The festival names in Ata Bechartanu and in Ya'aleh VeYavo.
  - The chazzan's Birkat Kohanim.
  - The edition's closing directions for each prayer.
- **Festival Musaf.** This is Tehillat Hashem's full Musaf of the Three Festivals, chosen over Torah Or's Chol HaMoed
  leaf because it is complete for Yom Tov too.
  - The Kedusha (Keter) for Yom Tov and Shabbat is `yomTov|shabbat`; the Chol HaMoed Kedusha is `cholHamoed&!shabbat`.
  - The day's names and the offerings for each festival and day.
  - Tal (`pesach&yomTov`) and Geshem (`sheminiAtzeret`), from their own leaves, as the chazzan's repetition after
    Gevurot.
  - The Priestly Blessing leaf (`yomTov`) and the chazzan's Birkat Kohanim.

Doubts (Tehillat Hashem):

- **Shabbat Musaf Kedusha.** The edition prints "נקדישך ונעריצך" (Musaf ¶24). Chabad Musaf of Shabbat and Rosh Chodesh
  uses "כתר יתנו לך", as the edition's own festival Musaf and Torah Or's Rosh Chodesh Musaf both do. This looks like
  a transcription copy of the Shacharit Kedusha. I kept it as printed; please check it against a printed Tehillat
  Hashem.
- **Missing from Shabbat Shacharit:** there is no "הכל יודוך" or "אין ערוך" before El Adon, and no Kaddish Yatom after
  Mizmor Shir. The morning blessings and Korbanot are not repeated; they are in weekday Shacharit.
- **Pending conditions** (declared in `conditionsPending`):
  - Birkat HaChodesh and Av HaRachamim.
  - Tzidkatcha.
  - The festival Kedushot, and the day within Pesach and Sukkot.
  - Tal and Geshem.

Suspicious words (Tehillat Hashem, not fixed):

- Kabbalat Shabbat Amidah ¶54, Shabbat Shacharit ¶82 and the other Shabbat Amidot print "…כאחד באור פניך נתת לנו…"
  without "כי באור פניך", and "וטו בעיניך".
- Verses of Praise ¶156 (Nishmat): "אלא אתהת" and "לדודת ברכי נפשי", which look like leftover footnote marks.
  ¶1: "מתי מספ", "מלפנ יי".
- Torah Reading ¶4–17: the personal Ribono shel Olam is split into fragments. The Hebrew words "ואת", "אשתי", "ובני" …
  stand as paragraphs of their own between English options.
- Festival Musaf ¶73 "ולראות ולראות". In ¶108 (fourth day of Chol HaMoed), "וביום הששי … תמימם:" is followed by a
  stray repeated "וביום הרביעי…" line.
- Each Chol HaMoed Sukkot paragraph (¶99–111) holds two days' verses, the diaspora custom for a doubtful day.
- Shabbat Torah Reading ¶54 "חרגל"; Yehalelu "לכ חסידיו".

## Condition keys and labels needed

- **Labels still missing:** `summer` and `winter` (the Gevurot words in Tehillat Hashem), `shavuot`,
  `sheminiAtzeret`, `hoshanaRabbah` and `shabbat`. The engine update covered the other labels.
- **Missing keys:**
  - The day of Chol HaMoed Sukkot, and whether it is Hoshana Rabbah for the Musaf verses (`hoshanaRabbah` exists in
    the day conditions).
  - Motzaei Yom Tov, for Atah Chonantanu.
- **More missing keys (Tehillat Hashem):**
  - Shabbat Mevarchim, for Birkat HaChodesh and to omit Av HaRachamim.
  - A "festive Shabbat" (a Shabbat that would have no Tachanun on a weekday), for Tzidkatcha and Av HaRachamim.
    `tachanun` is always false on Shabbat.
  - The prayer being said (Shacharit / Mincha / Maariv), for the festival Amidah's two Kedushot.
  - The day within the festival: first or last days of Pesach, the first day of Pesach for Tal, each day of Chol
    HaMoed Sukkot, and Shemini Atzeret as distinct from Simchat Torah abroad for Geshem.
  - Praying alone or with a minyan, for the Kegavna addition.
- **Captions:** after the engine update, the Torah Or captions are all known.
- **Concepts.** No concept exists for:
  - Chabad's pre-Song-of-the-Day psalms (Tefila LeDavid, Beit Yaakov, Shir HaMa'alot LeDavid), which use
    `closing-passages`.
  - Shir HaMa'alot Hinei Barchu in Maariv, which uses `vehu-rachum`.
  - Rabbenu Tam Tefillin, which uses `tefillin`.
  - The Six Remembrances, which use `closing-passages`.
  - The Amidah of Musaf. It uses `musaf` for each blessing; the Kedusha, Modim DeRabbanan and Birkat Kohanim keep
    their own concepts.

## Engine observations

These are outside the composition.

1. In edition mode (context `{}`), sections that open with a known caption come out empty and are dropped. This
   happens to Aneinu ("בתענית צבור אומר הש"ץ כאן עננו"), the individual Aneinu at Mincha, and Al HaNisim ("בחנוכה
   ופורים אומרים כאן") in Shacharit, Mincha, Maariv and Birkat HaMazon. The caption is read with no day and judged
   false, so the full edition loses these alternatives.
2. The edition prints many said texts entirely in small print:
   - Avinu Malkeinu.
   - Nachem, Aneinu, Ya'aleh VeYavo, Al HaNisim, Birkat Kohanim.
   - Eizehu Mekoman (Morning Prayer ¶32–39).
   - "היום יום ראשון בשבת שבו היו הלוים אומרים".
   - LeDavid at Mincha (Aleinu ¶0).

   Check that the reader shows them as prayer and not as notes.
3. `tests/siddurCompositions.test.mjs` now passes (9/9).
4. **Tehillat Hashem: inline English captions inside a Hebrew paragraph.** Examples: "( During the Ten Days of
   Penitence substitute - המלך הקדוש:) האל הקדוש", "( On Shabbat add : שבתות למנוחה ו)", "( During Festivals add -
   בשמחה)". The English is hidden in prayer mode, but its Hebrew alternative stays, so both wordings show every day.
   This can only be resolved at text level: the engine would need to read these English captions.
5. **Tehillat Hashem: Hebrew said text inside an English paragraph.** Weekday and Yom Tov Maariv's "- Say three
   times יי צבאות עמנו…" (Maariv For Shabbat and Festivals ¶2/4/6) is classed English, so it is hidden in prayer mode.
   In the Shabbat Maariv it falls in a `!shabbat` section, so it is not shown on Shabbat anyway.

## Suspicious words in the text (not fixed)

- Hallel ¶15 ends "…מאת זה היום עשה יי נגילה ונשמחה בו: זה". There are also cue fragments inside, such as "אודך אבן
  מאסו" and "מאת זה היום". Hallel ¶20 ends "…הודו ליי כי טוב כי לעולם חסדו: הודו ליי". These look like cues for
  repeated verses that were flattened into the text.
- Musaf for Festivals ¶20, ¶23, ¶27, ¶31, ¶35 and ¶39 end with "…כהלכתם: אלהינו ואלהי אבותינו". ¶45 opens with
  "אלהינו ואלהי אבותינו מלך רחמן", so the words appear twice on Pesach and on Sukkot.
- Endings with no final colon:
  - Al Tira: Shacharit Aleinu ¶6, Mincha Aleinu ¶7, Maariv ¶73.
  - Maariv ¶64 (Vihi Noam) and ¶65.
  - Rabbenu Tam ¶6.
  - Six Remembrances ¶2 and ¶5.
  - Ashrei Uva LeZion ¶2 (Lamenatzeach).
  - Birkat HaMazon ¶2, which ends "…כל אפסי ארץ אברכה". The next paragraph opens with "אברכה".
- A paseq ("|") appears in the Shema and Kedusha verses and in Tachanun. The audit lists them.
- Morning Prayer ¶31 (Ribon HaOlamim) and ¶32–39 (Eizehu Mekoman) are in small print.
- Maariv ¶6 has the variant note "( נ"א אל תסיר)".
