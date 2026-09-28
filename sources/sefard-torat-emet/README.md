# Sefaria "Siddur Sefard", version "Torat Emet 357" — three leaves

The files in `raw/` are the **unaltered** responses of the Sefaria texts API (v3) for three leaves of the index
"Siddur Sefard" in the version "Torat Emet 357". `scripts/build-sefard-torat-emet.mjs` reads them offline and writes
`src/data/nusach/siddurSefardToratEmet.mjs` and `provenance.json`.

- **Work / rite:** סידור ספרד — Nusach Sefard (the Chassidic rite), the same Sefaria index the main Sefard pack is
  built from. The main pack already carries this version for most of its leaves; for these three Sefaria's default
  version is the Metsudah siddur (1981, CC BY), which lost words there.
- **Version:** Torat Emet 357 — versionSource http://www.toratemetfreeware.com/index.html?downloads
- **Licence:** Public Domain, as Sefaria records it on the version (checked on each cached response by the build).
  No attribution is required; the app names the version anyway (manifest, sources page, reader footer).
- **Fetched:** 2026-09-29 with `node scripts/build-sefard-torat-emet.mjs --fetch`.

| Cache file | Sefaria ref | Used for |
|---|---|---|
| `raw/birchat-hamazon.json` | Siddur Sefard, Birchat HaMazon, Birchat HaMazon | Ya'aleh VeYavo on Shavuot: ¶51 (opening), ¶54 "בשבועות: חַג הַשָּׁבֻעוֹת", ¶59 "הַזֶּה. זָכְרֵנוּ…" — Metsudah's ¶54 is empty |
| `raw/bedtime-shema.json` | Siddur Sefard, Bedtime Shema | ¶6 והיה אם שמוע, ¶7 ויאמר — the edition's note asks for them; Metsudah prints only the first paragraph |
| `raw/yom-tov-musaf-amidah.json` | Siddur Sefard, Holidays, Yom Tov Musaf Amidah | ¶26 only, split at "הַזֶּה, נַעֲשֶׂה" so the continuation, printed once after the last festival line, follows Pesach, Shavuot and Sukkot too |

The only change is that one split (markup: the paragraph's enclosing `<small>` is closed before the cut and reopened
after it). Joined, the two parts are byte-for-byte Sefaria's ¶26; `tests/siddurTextGaps.test.mjs` checks this and that
every other paragraph equals the cached response.
