# Hebrew Wikisource — Shabbat zemirot (זמירות לשבת), raw wikitext

The `.wiki` files in this folder are the **unaltered wikitext** of Hebrew Wikisource pages, one file per page, as
returned by the MediaWiki API. `scripts/build-zemirot.mjs` reads them (offline) and writes
`src/data/liturgy/zemirot.mjs`. Every change made on the way is listed in `docs/siddur/zemirot-import.md`.

- **Source:** Hebrew Wikisource (ויקיטקסט העברי), https://he.wikisource.org/
- **Index page:** [זמירות לשבת](https://he.wikisource.org/wiki/%D7%96%D7%9E%D7%99%D7%A8%D7%95%D7%AA_%D7%9C%D7%A9%D7%91%D7%AA), revision 3019040
- **Licence:** Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
  The poems themselves are public domain (medieval and early-modern authors); the Wikisource transcription, pointing
  and layout are the contributors' work under CC BY-SA 4.0. **Share-alike applies** to these files and to the
  generated pack.
- **Attribution:** "ויקיטקסט העברי" (Hebrew Wikisource contributors). Each page's own contributors are listed in its
  history: `https://he.wikisource.org/w/index.php?title=<title>&action=history`.
- **Fetched:** 2026-09-28, with `node scripts/build-zemirot.mjs --fetch`, through
  `https://he.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main`,
  following redirects, with a descriptive User-Agent.
- **Pinned revisions:** `manifest.json` records, per file, the requested title, the resolved title, page id,
  revision id, revision timestamp, page URL and a permanent `oldid` URL. A later `--fetch` asks for exactly these
  revision ids, so it reproduces the same bytes; delete `manifest.json` to take the current revisions instead.

Daat (daat.ac.il, copyrighted) and Hamichlol were consulted **only as indexes** (which zemirot exist, at which meal,
in what order). No text from them is in this folder or in the pack.

## Files

| File | Wikisource page | Revision | Revision date (UTC) |
|---|---|---|---|
| `index.wiki` | זמירות לשבת (index) | 3019040 | 2026-06-08 |
| `shalom-aleichem.wiki` | שלום עליכם מלאכי השרת | 3015815 | 2026-05-10 |
| `ribon-kol-haolamim.wiki` | ריבון כל העולמים | 3017667 | 2026-05-26 |
| `eshet-chayil.wiki` | אשת חיל (זמר) | 3016398 | 2026-05-14 |
| `atkinu.wiki` | אתקינו סעודתא | 3023498 | 2026-07-08 |
| `azamer-bishvachin.wiki` | אזמר בשבחין | 1457480 | 2022-12-24 |
| `kol-mekadesh.wiki` | כל מקדש שביעי | 3017619 | 2026-05-26 |
| `menucha-vesimcha.wiki` | מנוחה ושמחה | 3017623 | 2026-05-26 |
| `ma-yedidut.wiki` | מה ידידות | 3017621 | 2026-05-26 |
| `ashir-lael.wiki` | אשיר לאל | 3016391 | 2026-05-14 |
| `ma-yafit.wiki` | מה יפית | 3017622 | 2026-05-26 |
| `yom-shabbat-kodesh-hu.wiki` | יום שבת קדש הוא | 3018026 | 2026-05-28 |
| `yah-ribon.wiki` | יה ריבון | 3079419 | 2026-08-27 |
| `tzur-mishelo.wiki` | צור משלו | 3017661 | 2026-05-26 |
| `yom-ze-leyisrael.wiki` | יום זה לישראל | 3016455 | 2026-05-14 |
| `yah-echsof.wiki` | י-ה אכסוף | 3016409 | 2026-05-14 |
| `asader-lisudata.wiki` | אסדר לסעודתא | 3021388 | 2026-06-23 |
| `chai-hashem.wiki` | חי ה' | 3016406 | 2026-05-14 |
| `baruch-hashem-yom-yom.wiki` | ברוך ה' יום יום | 3017971 | 2026-05-28 |
| `baruch-el-elyon.wiki` | ברוך אל עליון | 3016400 | 2026-05-14 |
| `yom-ze-mechubad.wiki` | יום זה מכובד | 3016451 | 2026-05-14 |
| `yom-shabbaton.wiki` | יום שבתון | 3040514 | 2026-08-09 |
| `ki-eshmera.wiki` | כי אשמרה שבת | 3040223 | 2026-08-08 |
| `shimru-shabtotai.wiki` | שמרו שבתותי | 3040468 | 2026-08-09 |
| `dror-yikra.wiki` | דרור יקרא | 3024509 | 2026-07-15 |
| `shabbat-hayom-lashem.wiki` | שבת היום לה' | 3017645 | 2026-05-26 |
| `yom-hashabbat-ein-kamohu.wiki` | יום השבת אין כמוהו | 3016417 | 2026-05-14 |
| `al-ahavatcha.wiki` | על אהבתך | 3017663 | 2026-05-26 |
| `tzama-nafshi.wiki` | צמאה נפשי | 3083873 | 2026-09-19 |
| `bnei-heichala.wiki` | בני היכלא | 3024303 | 2026-07-14 |
| `tehillim-23.wiki` | תהלים כג/ניקוד | 2989159 | 2026-02-17 |
| `yedid-nefesh.wiki` | ידיד נפש | 3016239 | 2026-05-12 |
| `el-mistater.wiki` | אל מסתתר | 3016244 | 2026-05-12 |
| `hamavdil.wiki` | המבדיל בין קודש לחול | 3083009 | 2026-09-14 |
| `eliyahu-hanavi.wiki` | אליהו הנביא | 3021751 | 2026-06-27 |
| `melave-malka.wiki` | זמירות למלווה מלכה | 3018249 | 2026-05-31 |
| `bemotzaei-yom-menucha.wiki` | במוצאי יום מנוחה | 3021749 | 2026-06-27 |
| `chadesh-sasoni.wiki` | חדש ששוני | 3018234 | 2026-05-31 |
| `agil-veesmach.wiki` | אגיל ואשמח | 3018025 | 2026-05-28 |
| `elokim-yisadenu.wiki` | אלהים יסעדנו | 3018793 | 2026-06-04 |
| `eli-chish-goali.wiki` | אלי חיש גואלי | 3018214 | 2026-05-31 |
| `adir-ayom-venora.wiki` | אדיר איום ונורא | 3021759 | 2026-06-27 |
| `ish-chasid.wiki` | איש חסיד | 3026838 | 2026-07-25 |
| `amar-hashem-leyaakov.wiki` | אמר ה' ליעקב | 3018250 | 2026-05-31 |
| `ribon-haolamim-motzash.wiki` | רבון העולמים למוצאי שבת | 3015345 | 2026-05-09 |
| `bar-yochai.wiki` | בר יוחאי | 3019338 | 2026-06-09 |
| `beyom-shabbat-ashabeach.wiki` | ביום שבת אשבח | 3020680 | 2026-06-18 |
| `el-eliyahu.wiki` | אל אליהו | 3018206 | 2026-05-31 |
| `laner-velivsamim.wiki` | לנר ולבשמים | 3020438 | 2026-06-17 |
| `al-bayit-ze.wiki` | על בית זה ויושביהו | 3018500 | 2026-06-02 |

The last five pages are not linked from the Wikisource index page; they were added because the Daat index lists
them among the Shabbat zemirot. Titles: the index links `יה אכסוף`, whose page is titled `י-ה אכסוף`;
`אשיר לאל אשר שבת` redirects to `אשיר לאל`.
