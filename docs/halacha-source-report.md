# Sephardic Halacha Source Report

Research date: 2026-09-18

This report records what the application can safely display based on source metadata and provider terms. It is a product/legal-risk boundary, not legal advice.

## Findings

| Source | Author / tradition | Digital availability | Text status | License / terms observed | Full text in app | Cache | Recommended use |
|---|---|---|---|---|---|---|---|
| Shulchan Arukh, Orach Chayim | R. Yosef Karo; foundational source | Sefaria API, structured | Hebrew sections available | Sefaria returned `Public Domain` for Maginei Eretz (Lemberg, 1893); also exposes a Wikisource `CC-BY-SA` version | Yes, only the explicitly licensed version | Yes, with provenance and license retained | Primary open source corpus |
| Shulchan Arukh, Yoreh Deah | R. Yosef Karo; kashrut, vows, mourning and medicine | Sefaria API, structured | Hebrew sections available | Tested reference returned `Public Domain` for Ashlei Ravrevei, Lemberg 1888 | Yes, verified version only | Yes, with provenance | Expands kashrut and life-cycle coverage |
| Shulchan Arukh, Choshen Mishpat | R. Yosef Karo; civil law and interpersonal matters | Sefaria API, structured | Hebrew sections available | Tested reference returned `Public Domain` for Lemberg 1898 edition | Yes, verified version only | Yes, with provenance | Expands money, damages, neighbors and lost property |
| Shulchan Arukh, Even HaEzer | R. Yosef Karo; marriage and family law | Sefaria API, structured | Hebrew sections available | Tested reference returned `Public Domain` for Apei Ravrevei, Lemberg 1886 | Yes, verified version only | Yes, with provenance | Marriage and family-law source layer |
| Beit Yosef, Orach Chayim | R. Yosef Karo; Sephardic legal foundation | Sefaria API, structured references | Hebrew sections available | Tested Sefaria response returned `Public Domain` metadata for the Hebrew edition | Yes, only the verified returned version | Yes, with per-version metadata | Primary open source corpus, clearly labeled as source not final ruling |
| Kaf HaChayim on Orach Chayim | R. Yaakov Chaim Sofer; Sephardic/Ashkenazic practice synthesis with strong Sephardic relevance | Sefaria API, structured | Hebrew sections available | Tested response returned `Public Domain`; edition metadata: Jerusalem 1910-1933, NLI source | Yes, only the verified returned version | Yes, with provenance | High-priority Sephardic source corpus |
| Ben Ish Hai | R. Yosef Chaim of Baghdad | Sefaria index exists | Exact tested text reference did not resolve; no verified ingestible version was selected | No license was established for an ingestible version | No | No | Bibliographic/link-only until a version and license are verified |
| Chida | R. Chaim Yosef David Azulai | Sefaria search/index probing was not enough to identify a safe halachic corpus | No verified work/version selected in this pass | Unverified | No | No | Bibliographic research queue |
| Yabia Omer | R. Ovadia Yosef; modern | No usable Sefaria index record returned in tested endpoint | No verified full text | Modern copyright presumed; no permission found | No | No | Bibliographic references only, pending authorization |
| Yechaveh Da'at | R. Ovadia Yosef; modern | No usable Sefaria index record returned in tested endpoint | No verified full text | Modern copyright presumed; no permission found | No | No | Bibliographic references only, pending authorization |
| Chazon Ovadia | R. Ovadia Yosef; modern | No usable Sefaria index record returned in tested endpoint | No verified full text | Modern copyright presumed; no permission found | No | No | Bibliographic references only, pending authorization |
| Halichot Olam | R. Ovadia Yosef; modern | No usable Sefaria index record returned in tested endpoint | No verified full text | Modern copyright presumed; no permission found | No | No | Bibliographic references only, pending authorization |
| Yalkut Yosef | R. Yitzhak Yosef; modern | No usable Sefaria index record returned in tested endpoint | No verified full text | Modern copyright presumed; no permission found | No | No | Bibliographic references only, pending authorization |
| Wikisource Hebrew | Community-edited; individual text licenses vary | Structured pages and API | Shulchan Arukh version is exposed by Sefaria as `CC-BY-SA` | CC-BY-SA requires attribution and share-alike; page/version must be recorded | Yes for a specifically verified CC-BY-SA version, with attribution/share-alike notice | Yes, with license metadata | Secondary open provider for verified versions |
| HebrewBooks | Society for Preservation of Hebrew Books | Large scan library; site reported 66,212 books during research | Scans/OCR, not a blanket reusable text dataset | Terms grant limited personal-use access, prohibit commercial use and scraping/robots, and restrict redistribution beyond the stated license | No bulk ingestion under current terms | No automated cache/scrape | Links and bibliographic research only |

## Provider constraints

- Sefaria's developer documentation says the API provides structured access without API keys and exposes index, version, text, related-text, and topic endpoints. It also directs developers to version metadata rather than treating the library as one blanket license.
- Sefaria's Hebrew accessibility page describes public-domain and licensed text goals and a live API. The application therefore uses per-version license metadata, not a blanket assumption that every Sefaria text is reusable.
- HebrewBooks is explicitly excluded from automated ingestion under its current terms. The presence of a downloadable scan does not grant redistribution rights.

## Safe corpus size for this pass

The verified full-text corpus is six structured source families with hundreds-to-thousands of section references available through Sefaria's index/text APIs:

1. Shulchan Arukh, Orach Chayim, Public Domain version.
2. Beit Yosef, Orach Chayim, Public Domain version returned by the tested API.
3. Kaf HaChayim on Shulchan Arukh, Orach Chayim, Public Domain version returned by the tested API.
4. Shulchan Arukh, Yoreh Deah, Public Domain version returned by the tested API.
5. Shulchan Arukh, Choshen Mishpat, Public Domain version returned by the tested API.
6. Shulchan Arukh, Even HaEzer, Public Domain version returned by the tested API.

The application does not copy modern responsa or HebrewBooks scans. It stores source definitions and retrieves only approved references with their returned edition/license metadata.

## Ingestion architecture

The library uses structured source records rather than JSX hard-coding:

- `sourceWork`: work, author, tradition, provider, source root, license policy.
- `sourceUnit`: canonical reference, title, topic/subtopic, content type, source chain, license snapshot, URL, retrieval date.
- `topic`: hierarchical Hebrew taxonomy with aliases and keywords.
- `contentType`: `source`, `ruling`, `custom`, `opinion`, `note`, `dispute`, or `reference`.
- `copyrightStatus`: `public-domain`, `cc-by-sa`, `link-only`, or `unverified`.

Search results are filtered to approved source families before text is opened. Classical source text is never silently presented as a contemporary Sephardic ruling.

## Not imported

No full text was imported for Yabia Omer, Yechaveh Da'at, Chazon Ovadia, Halichot Olam, Yalkut Yosef, Ben Ish Hai, Chida, or HebrewBooks scans. Those require a verified edition/license or an authorized provider connection.

---

## Pass 2 (2026-09-18): practical question layer

### Role of each site checked

| Site | Checked | Used for | Not used for |
|---|---|---|---|
| halachayomit.co.il | Yes — list page and recent Q&A titles | Demand research (recurring topics: יום כיפור, בין המצרים, שבת, נטילת ידיים) | Content. Footer: "כל הזכויות … שמורות למחברן, ואין לעשות בהן שימוש בלא ליטול ממנו רשות" |
| yalkutyosef.co.il | Yes — daily page | Demand research only; © notice, no reuse terms | Content |
| hebrew.yoatzot.org/faq | Yes — FAQ list | Demand research (recurring: חציצה, מקווה בחו"ל, שבעה נקיים, בדיקות, כתמים, כלה, טבילה בזמן אירוח) | Content; no asker details stored |
| shutpuah.org.il | Yes — recent Q&A | Demand research (recurring: צום יום כיפור בהריון/הנקה/אחרי ניתוח, עגילים בטבילה, מקווה מרוחק) | Content |
| ph.yhb.org.il / Sefaria "Peninei Halakhah" | Yes — site + API | **Content.** Hebrew version on Sefaria carries `CC-BY-NC`. App is non-commercial; attribution to הרב אליעזר מלמד / ישיבת הר ברכה is shown on every source row and in פרטי מקור | Attribution to Rabbi Ovadia Yosef — Peninei Halakhah is labeled as its own author/derech |
| zomet.org.il | Yes — home + FAQ | Demand research for appliances (מקרר, התקן שבת) | Content; device rulings are model-specific and Zomet-branded |
| developers.sefaria.org copyright page | Yes | Confirms license is per-version, per-language; public-domain reusable; CC may require attribution/NC | — |
| yeshiva.org.il/ask | Blocked (HTTP 403) | — | — |

### Sources newly integrated (verified via API on 2026-09-18)

| Work | License returned | Use |
|---|---|---|
| Ben Ish Hai (Halachot, years 1–2) | Public Domain (Wikisource) | Sephardic layer, full text internal |
| Peninei Halakhah — Berakhot, Shabbat, Prayer, Women's Prayer, Kashrut, Family Purity, Zemanim, Festivals, Pesach, Sukkot, Likkutim I–II | CC-BY-NC | Modern-Hebrew layer, full text internal, attribution shown |
| Shulchan Arukh OC / YD / CM / EH | Public Domain | Foundation layer |

Also verified but not yet wired: Kitzur Shulchan Arukh (PD), Arukh HaShulchan (CC-BY-SA), Chayei Adam (PD). Mishnah Berurah returned `unknown` license — not used.

### Still pending permission (not copied)

Yalkut Yosef, Chazon Ovadia, Yabia Omer, Yechaveh Da'at, Halichot Olam, Halacha Yomit articles. A permission request draft can be prepared on request; nothing has been sent.

### Coverage matrix (question layer)

188 distinct questions · 388 unique verified references · 14 categories · 130 topics.

| Category | Topics | Questions | Refs | With Sephardic source | With modern Hebrew | Personal-flag |
|---|---|---|---|---|---|---|
| תפילה ובית הכנסת | 15 | 20 | 49 | 6 | 19 | 0 |
| ברכות ואכילה | 5 | 18 | 48 | 10 | 18 | 0 |
| כשרות והמטבח | 13 | 23 | 47 | 6 | 23 | 1 |
| שבת בבית ובמשפחה | 19 | 24 | 55 | 10 | 24 | 0 |
| הלכות נשים | 10 | 13 | 29 | 1 | 12 | 2 |
| טהרת המשפחה ומקווה | 11 | 13 | 23 | 2 | 13 | 5 |
| חגים, ראש חודש וצומות | 14 | 19 | 67 | 6 | 16 | 0 |
| משפחה ומעגל החיים | 9 | 11 | 27 | 3 | 4 | 2 |
| בריאות ונגישות | 6 | 7 | 14 | 0 | 6 | 3 |
| בין אדם לחברו ודיגיטל | 7 | 8 | 12 | 1 | 4 | 0 |
| כסף, עבודה ועסקים | 5 | 9 | 22 | 2 | 5 | 0 |
| מצוות ושגרת היום | 5 | 9 | 25 | 5 | 8 | 0 |
| נסיעות ואירוח | 5 | 6 | 17 | 0 | 6 | 0 |
| חשמל וטכנולוגיה | 6 | 8 | 8 | 0 | 8 | 1 |

Reviewed summaries: **0**. Every question is `reviewStatus: unreviewed`; the UI shows "תקציר: ממתין לבדיקה הלכתית" and exposes only verified sources plus the factors that change the ruling. No short answer is authored by the model.

### Known gaps / backlog

- Sephardic-layer coverage is thin in בריאות, נסיעות, טכנולוגיה (Ben Ish Hai has no direct chapter; Kaf HaChaim mapping not yet done per question).
- לשון הרע cites only Peninei Halakhah; Chafetz Chaim on Sefaria still needs license/ref verification.
- Copyright/העתקת תוכן question omitted — no verified classical or licensed modern source located.
- Human halachic review of any summary text before flipping `reviewStatus`.
- Wikisource CC-BY-SA versions not yet used (share-alike implications to confirm).

## Pass 3: segment-level answers, book browsing, Talmud reader

### Segment-level references

- Questions may now cite a single סעיף (`Shulchan Arukh, Orach Chayim 208:7`), a Peninei Halakhah הלכה (`Peninei Halakhah, Berakhot 8:13`) or a Ben Ish Hai סעיף (`Ben Ish Hai, Halachot 1st Year, Pinchas 18`). Each was read via the API before being cited (rice: SA 208:7 "הכוסס את האורז…", PH 8:13 "אורז, פריכיות אורז ופופקורן", BIH Pinchas 18 "אורז מבושל…").
- The reader opens the segment alone and offers "הרחבה להקשר המלא": the parent `sectionRef` is loaded and the segment is highlighted by its `sections` index (original array positions are preserved after empty-segment filtering).
- New questions: `berachot-rice-after` (ברכה אחרונה על אורז), `prayer-nusach` (נוסח התפילה; SA OC 68:1, PH Prayer 6:1/6:2/6:4). 190 questions, 396 unique refs, all verified (`scripts/verify-halacha-refs.mjs`).

### Book browsing (ספרייה → ספר → חלק → סימן → סעיף)

- Route `#halacha/b`, `#halacha/b/<work>`, `#halacha/b/<work>/<unit>`; structure comes from `/api/shape/<index>` and the `Topic` alt-struct of `/api/v2/raw/index/<index>` — never from array position alone.
- Shulchan Arukh (4 parts): units are the named הלכות groups (e.g. "הלכות שאר ברכות", סימנים 215–241); Beit Yosef / Kaf HaChayim: blocks of 50 simanim; Ben Ish Hai: הלכות שנה א / שנה ב → parasha (opened as a full `1-N` range because depth-2 nodes return only the first seif on a bare request); Peninei Halakhah: 12 books → chapters → הלכות (depth 3, same quirk).
- Drashot and introductions of Ben Ish Hai are not browsed (not halacha).

### Talmud reader (תלמוד בבלי עם ביאור שטיינזלץ)

- Base text: William Davidson Edition – Vocalized Aramaic; commentary: William Davidson Edition – Steinsaltz Hebrew (both **CC-BY-NC**: non-commercial use with attribution). The UI states the app is not an official product of Sefaria, Koren or the Steinsaltz Center. Rashi/Tosafot come from Sefaria's public-domain indices, linked per segment via `/api/links` `anchorRef` (never by array position).
- Coverage: all 37 Bavli tractates in the six sedarim have a Steinsaltz index. Sefaria's "Talmud/Bavli" shape also lists 12 minor tractates and 3 Tziyyun LeNefesh Chayyah commentaries; those are not tractates and are excluded from the reader. Daf Yomi Shekalim is Yerushalmi and is flagged as unsupported.
- Alignment: Steinsaltz is shown beside a segment only when both arrays have identical length for the amud; otherwise it is shown as a separate block with a notice.
- Not done / backlog: offline download of amudim (would need a storage budget and license note), Halacha→Talmud cross-links per question (no Talmud refs are cited in the question layer yet), human review of any summaries.
