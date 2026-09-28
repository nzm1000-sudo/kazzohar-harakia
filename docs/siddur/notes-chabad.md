# Nusach Chabad: composition notes

Composition: `src/data/nusach/compositions/chabad.mjs` (nusach id `chabad`, pack index `Weekday Siddur Chabad`). The
source is Sefaria's *Weekday Siddur Chabad*, a Wikisource transcription of Siddur Torah Or, licensed CC BY-SA. Every
section is a slice of this edition. No text comes from another rite, and no word is typed in.

QA (`node scripts/siddur-qa.mjs chabad`), 2026-09-28:

| Service | Level |
|---|---|
| weekday-shacharit | TEXT COMPLETE / CONDITIONS PENDING (unknown caption «בראשון בשבת:») |
| weekday-mincha | VERIFIED COMPLETE |
| weekday-maariv | VERIFIED COMPLETE |
| bedtime-shema | VERIFIED COMPLETE |
| birkat-hamazon | TEXT COMPLETE / CONDITIONS PENDING (unknown captions «ביום שאומרים בו תחנון:», «בעשרה:») |
| hallel | VERIFIED COMPLETE |
| rosh-chodesh-musaf | VERIFIED COMPLETE |
| omer | VERIFIED COMPLETE |
| festival-musaf | TEXT COMPLETE / CONDITIONS PENDING (the day of Sukkot, see below) |
| kabbalat-shabbat, shabbat-maariv, shabbat-kiddush, shabbat-shacharit, shabbat-musaf, shabbat-kiddush-day, shabbat-mincha | SOURCE GAP: the licensed edition, Siddur Torah Or for weekdays, has no Shabbat services |
| havdalah | SOURCE GAP: not printed in the edition |
| festival-amidah | SOURCE GAP: the edition has no Yom Tov services; its festival section is the Chol HaMoed Musaf only |

## How it was checked

- I read every leaf I used in the dump. For each paragraph I checked its opening and closing words. For every
  paragraph that could hold two parts (Amidah insertions, the Tachanun leaves, Kaveh ¶1, Birkat HaMazon ¶27/¶31,
  Bedtime ¶0/¶7/¶21, Hallel ¶15/¶20/¶22–27, the Musaf leaves, Maariv ¶5–15/¶27/¶58–66) I read the full text
  (`--full`).
- I read the full Mincha Amidah leaf from start to end.
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
- **Festival Musaf.** This is the Musaf of Chol HaMoed only, titled "מוסף לחול המועד".
  - The Pesach verses are marked `pesach`, and the Sukkot verses (¶21–44) `sukkot`.
  - Inside the Sukkot run are the per-day captions and the diaspora brackets. The app has no key for the day of Chol
    HaMoed Sukkot, so all of them show on every day. This is declared in `conditionsPending`.
  - There are no Yom Tov, Shabbat Chol HaMoed or Shavuot Musaf texts.

## Condition keys and labels needed

- **`fullHallel`** (Hallel), **`pesach`** and **`sukkot`** (Musaf). These are keys of `compositionConditions()`,
  taken from `dayConditionsFromContext`, but they have no `WHEN_LABELS`, so the full edition shows no label.
- **Compound conditions.** These have no labels:
  - `dayN&!roshChodesh&!cholHamoed` and `dayN&roshChodesh|dayN&cholHamoed` (Song of the Day).
  - `!roshChodesh&!cholHamoed`.
  - `roshChodesh|cholHamoed` on Kaddish.
  - `ledavid&…`, `hallel&fullHallel`, `!tishaBav&!cholHamoed`.
  - `cholHamoed&pesach`, `cholHamoed&sukkot`.
- **Missing keys:**
  - The day of Chol HaMoed Sukkot, and whether it is Hoshana Rabbah for the Musaf verses (`hoshanaRabbah` exists in
    the day conditions).
  - Motzaei Yom Tov, for Atah Chonantanu.
- **Captions the engine does not know:**
  - «בראשון בשבת:» (the Song of the Day's day heading). It is harmless, because each day is already its own section.
    "בשני בשבת:" … "בשישי בשבת:" are not flagged at all.
  - «ביום שאומרים בו תחנון:» (Birkat HaMazon ¶0). The section is already cut `tachanun`.
  - «בעשרה:» (zimun, Birkat HaMazon ¶14–16).
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
3. `tests/siddurCompositions.test.mjs` fails one test: "the full edition keeps every alternative…". It fails on
   Ashkenaz's `yaale-veyavo` whenLabel, which is null. The Chabad composition is not involved.

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
