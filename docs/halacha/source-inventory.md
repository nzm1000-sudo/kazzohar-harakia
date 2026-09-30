# Halacha — source inventory (stage 6, checked 2026-09-30)

Every answer the app publishes rests on a **ruling source** that can be checked word for word on the device. Other
sites help find **which questions people ask** and how they phrase them; they are never shown as the authority, and no
text is taken from them. Roles: **primary** (the ruling is quoted from it), **secondary** (documents a primary ruling;
used to find candidates and to cross-check, not quoted), **discovery** (questions only).

| Source | Domain | Behind it / who answers | Role here | Rights | How it was used |
|---|---|---|---|---|---|
| קיצור שולחן ערוך ילקוט יוסף (מהדורת תשס"ז), הרב יצחק יוסף | bundled (`src/data/yalkutYosef.mjs`), from תורת אמת | Rishon LeZion Rav Yitzhak Yosef — the app's ruling line | **primary** | CC BY-NC-SA 2.5 (`docs/licenses/yalkut-yosef.md`) | Every stage 6 ruling is a verbatim excerpt of a section, checked mechanically (`scripts/halacha/verify.mjs`) |
| שולחן ערוך ונושאי כליו | sefaria.org (bundled locally in part) | Maran R. Yosef Karo | background for candidates | Public domain | Named as a candidate source in the review queue only |
| הלכה יומית | halachayomit.co.il | Presents the rulings of Maran Rav Ovadia Yosef (its own navigation: "שיעורים מפי מרן", "ביוגרפיה על הרב"); author not checked | secondary / discovery | "All rights reserved to their authors" | Page for the fried-oil question opened; the answer loads dynamically and could not be read — not used |
| משיב כהלכה | meshiv.co.il | Q&A "according to the rulings of Maran Rav Ovadia Yosef"; answering rabbi named per answer (the fried-oil answer: R. David Ochion) | discovery; opinion recorded in the review queue | No licence stated — research only | Opened; question found; its conclusion is recorded as one opinion, not as a ruling |
| דין – שאל את הרב | din.org.il | Beit Horaah "Din" (Yeshivat Maaneh Simcha), named rabbis | discovery; opinions recorded | © all rights reserved | Opened for fried oil, review sites, extra item; questions only |
| קו ההלכה הספרדי | kavhalacha.co.il | States: "300+ Sephardi morei horaah ruling by the rulings of Maran Rav Ovadia Yosef" (article titles name R. Moshe Yosef) | secondary (to check in future batches) | No licence found — research only | Home page opened; not yet used |
| ערוץ 2000 – מענה ההלכה העולמי | tv2000.co.il | News site publishing a letter of Rav Yitzhak Yosef | secondary documentation | News article — research only | The robot-mop letter recorded as a candidate in the review queue (unpublished: secondary only) |
| הידברות – שאל את הרב | hidabroot.org | Hidabroot, named rabbis | discovery | No licence — research only | Onion/meat-knife question page (loads) kept as where the question is asked |
| כיפה – שאל את הרב | kipa.co.il | Kipa, named rabbis | discovery | No licence — research only | Change-of-place question page kept as where it is asked |
| אתר ישיבה – שאל את הרב | yeshiva.org.il | Yeshiva.org.il, named rabbis (e.g. Kollel Dayanut Psagot) | discovery | No licence — research only | Search result for Google reviews; listed in the review queue |
| ישיבת כסא רחמים | ykr.org.il | Yeshivat Kisse Rahamim | discovery (seen in search results) | — | Not opened |
| דורש ציון | doresh-tzion.co.il | R. Ben Zion Mutzafi | discovery (seen in search results) | — | Not opened; a different Sephardi line, never quoted as this app's ruling |
| תורה והארץ, צומת, מכון הלכה חב"ד, תורת הר עציון, פורום לתורה | toraland.org.il, zomet.org.il, machon-halacha.co.il, etzion.org.il, tora-forum.co.il | Other lines / forums | discovery only | — | Seen in search results; forums are never a source |

## Rules kept
- A discovery page is recorded only after it loads (`verify.mjs` fetches every URL with a plain browser User-Agent and
  no personal data) and only as `use: 'question-only'`.
- A ruling that exists only in a secondary report (a news article, a Q&A answer) is **not published**: it goes to
  `scripts/halacha/practical/needs-review.json` with the unresolved point written down.
- No site was scraped in bulk; each page was opened individually. Nothing behind a login, CAPTCHA or paywall was used.
