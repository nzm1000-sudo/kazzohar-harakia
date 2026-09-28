# Open Siddur Project — Chabad (Nusach Ha-Ari), "Siddur Tehillat Hashem" transcriptions

The 18 `.txt` files in this folder are **byte-for-byte copies** of the plain-text editions published by the Open
Siddur Project. Nothing in them has been edited. `scripts/build-chabad-tehillat-hashem.mjs` reads them and writes
`src/data/nusach/siddurChabadTehillatHashem.mjs`. Every change made on the way is listed in
`docs/siddur/chabad-tehillat-hashem-import.md`.

## What the texts are

- **Work:** Nusach Ha-Ari Zal (Chabad) prayers, "Comparable to the Siddur Tehillat HASHEM … According to the Text of
  Rabbi Shneur Zalman of Liadi". Each file says: "Compiled and newly typeset by Shmuel Gonzales. The text is consistent
  with the text of the Siddur Tehillat Hashem." The Tikkun Chatzot file says "Comparable to the Siddur Torah Ohr"
  instead.
- **Transcriber and author of the English instructions:** Shmuel (Shmueli) Gonzales.
- **Versions:** each file has its own version line, from 3.0 (2010–2013) to 3.82 (April 2015). The build records every
  version line in `source.files[].version`.
- **Publication page:** https://opensiddur.org/?p=1260 (Open Siddur post 1260).
- **File URLs:** `https://opensiddur.org/wp-content/uploads/2010/08/<file name>`, for example
  https://opensiddur.org/wp-content/uploads/2010/08/Kabbalat-Shabbat-Nusaḥ-Ha-Ari-ḤaBaD.txt

## How the files were fetched

opensiddur.org returns HTTP 403 (Cloudflare) to scripted requests, including curl and WebFetch. Every file was
therefore downloaded from the Internet Archive's Wayback Machine, as the original bytes
(`id_` mode):

    https://web.archive.org/web/2024id_/https://opensiddur.org/wp-content/uploads/2010/08/<file name>

- **Downloaded and copied here:** 2026-09-28.
- **Not available:** the Chanukah file that the post links. The Wayback Machine has no copy of it and returned its
  404 page, so it is not included. (Correction, 2026-09-29: the file is archived under its earlier single-k name — https://web.archive.org/web/20150507155325id_/http://opensiddur.org/wp-content/uploads/2010/08/%E1%B8%A4anukah-Blessings-Nusa%E1%B8%A5-Ha-Ari-%E1%B8%A4aBaD.txt, v3.0, CC0 / CC BY. Not imported: Torah Or already holds the Chanukah blessings and no service lights candles.) The pack has no Chanukah leaf of its own, although the "Al HaNissim" inserts appear
  inside the Amidah and Birkat HaMazon files.

## Licence

**Recorded as: CC0 (Hebrew) / CC BY 4.0 (instructions).**

Each file ends with the transcriber's own licence statement. The Kabbalat Shabbat file is quoted here verbatim; the
other files use the same wording, apart from the liturgy's name and the spelling of the name ("Shmuel" or "Shmueli"):

> I am the original transcriber of this liturgy "Kabbalat Shabbat – Mincha – Maariv - Nusach Ari" and
> translator/author of its accompanying instructional text. I am licensing the transcriptions within it under the
> Creative Commons Zero License, and the instructions with the Creative Commons By Attribution license. Attribution
> may be given as ‘Contributors to the [http://www.opensiddur.org/ Open Siddur Project]’, with the transcriber/translators
> name Shmuel Gonzales included in the contributors list.

The Bedtime Shema file adds "except where noted":

> I am the original transcriber of this liturgy "Bedtime Shema (Siddur Tehillat Hashem, Nusach Ari, Chabad)" and
> translator/author of its accompanying instructional text except where noted. I am licensing the transcriptions within
> it under the Creative Commons Zero License, and the instructions with the Creative Commons By Attribution license.

The Open Siddur post's metadata (`open_content_license`) gives **CC BY 4.0** for the whole post. The Hebrew
transcription is therefore recorded as CC0, which is what the files themselves say. The English instructions are
recorded as CC BY 4.0: the files say "Creative Commons By Attribution" without a version, and the post metadata gives
4.0. In a 2023 comment on the page, a site admin mentions CC BY-SA. That contradicts both the files and the metadata,
and nothing in the pack depends on it.

**Attribution (required for the English instructions):** Contributors to the Open Siddur Project, transcribed by
Shmuel Gonzales.

## Files

SHA-256 of each copy, as downloaded:

| File | SHA-256 |
|---|---|
| Hallel-Musaf-Rosh-Ḥodesh-Nusaḥ-Ha-Ari-ḤaBaD.txt | a36b154fd89d514501189b56296013f6d0458161088c7ee604637d4798440458 |
| Kabbalat-Shabbat-Nusaḥ-Ha-Ari-ḤaBaD.txt | 8a853b3bf1724f5cef8617c6fd2b84688cae7a03728a58e8d440351919285cfc |
| Kiddush-Levana-Nusaḥ-Ha-Ari-ḤaBaD.txt | 3cf40f4e0c91823bc3a3499baf6c85af7e374a1b40f46cfc4987c387a96c71f1 |
| Maariv-Evening-Nusaḥ-Ha-Ari-ḤaBaD.txt | b63812ce97947808b6e7a950d0f0857fd2755b7be3c83aee167356f858ebb9dc |
| Megillat-Esther-Blessings-Nusaḥ-Ha-Ari-ḤaBaD.txt | 920789a733581181accc37536455a5142b8e36563114dc0c83e74ce55789c749 |
| Minḥah-Afternoon-Nusaḥ-Ha-Ari-ḤaBaD.txt | bdc571ba163583d8ddc84ea4ad18167b02205c8804f207aef8f63c89c6fbf592 |
| Minḥah-Shabbat-Afternoon-Nusaḥ-Ha-Ari-ḤaBaD.txt | 50c40ffd5687bf4d003eaff6a23e742f8044d210cdc86955aa257f15c15cb291 |
| Prayer-for-Travelers-Nusaḥ-Ha-Ari-ḤaBaD.txt | e52cebda48d8eb20dc71cc78738fed0234189bb73f6f5caf1d2d4664f890d1e9 |
| Sefirat-HaOmer-Nusaḥ-Ha-Ari-ḤaBaD.txt | 6b8764a66fcc41b58ce2c294df0e20fe906a1c2693a65702cbd758630f3faf31 |
| Shaḥarit-Morning-Nusaḥ-Ha-Ari-ḤaBaD.txt | 1ccef8bf43de3f823cf4a887ae0bb34c736e9c1c412906f5e26c8f5eec0202ba |
| Shaḥarit-Musaf-Shabbat-Nusaḥ-Ha-Ari-ḤaBaD.txt | 38dd7e498124fe3d04b937905e184b47fb9bda1897b4f9b6b57d9d7e8efe4530 |
| Shelosh-Regalim-Nusaḥ-Ha-Ari-ḤaBaD.txt | d75f0c24c5ab1d5fd52f0220b3804a0cf19f1a664b6c1990852cc6048855270e |
| The-Bedtime-Shema-Nusaḥ-Ha-Ari-ḤaBaD.txt | b9aee396df3577fae47912d5552c41e1584b37dda3ecba960ab7073424398de1 |
| The-Blessing-Book-Nusaḥ-Ha-Ari-ḤaBaD.txt | 933dea74948bcc875fd04d5287e760c1f48c7b7a3dd94ced13789628a867daca |
| The-Morning-Blessings-Nusaḥ-Ha-Ari-ḤaBaD.txt | a330842eb0c5ecbd44932b825073df9b5e4a2f55587a43ce219a2b207b3bdf41 |
| The-Shabbat-Book-Nusaḥ-Ha-Ari-ḤaBaD.txt | 56af983eefb8e76f8e7e3c8c96f5ea8d0463be6ed4592ea523502f7f43eb12d3 |
| Tikkun-Ḥatzot-Nusaḥ-Ha-Ari-ḤaBaD.txt | 5089dc388af00ad4c780ec1e0974d1027b7ebffec2e4067ea3c48c9bff51b1d2 |
| Ḥag-Sukkot-Nusaḥ-Ha-Ari-ḤaBaD.txt | 4342ecf44d9dfeac8c44abb23ba4665b5fc16bb21f2c35bc7f06edfbf4c5be23 |

## Two formats

- **Wiki format (6 files):** Hallel/Musaf Rosh Chodesh, Kabbalat Shabbat, Kiddush Levana, Weekday Shacharit, Bedtime
  Shema and Morning Blessings. They are MediaWiki exports of the ODT originals, with `<center>`, `'''bold'''`,
  `''italic''`, `{| … |}` tables and `<ref>` footnotes that hold the verse sources.
- **Plain format (12 files):** every other file. It is plain text from the ODT originals. Some files use CRLF line
  endings or a BOM, and footnote numbers are glued to the Hebrew (`חֲמָתוֹ:1`). The footnote text itself was not
  exported.
