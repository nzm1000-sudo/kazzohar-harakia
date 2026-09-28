# How the research corpus was built (2026-09-28)

1. **Sources extracted**: every Rema gloss on the Shulchan Arukh (Orach Chayim, Yoreh De'ah, Even HaEzer) that states a
   custom (768 glosses), and every Ben Ish Hai paragraph attributing a custom to Baghdad or Jerusalem (195 paragraphs,
   Wikisource edition). Hebrew Wikipedia articles on community customs (64 articles, CC BY-SA 4.0).
2. **Drafting** by several agents under `PROTOCOL.md`: one custom per record, a verbatim excerpt, the source's own scope
   and certainty, custom never presented as law.
3. **Mechanical verification** (`verify.mjs`) — a record is rejected unless its excerpt appears verbatim:
   - Rema: after the *last* "הגה:" of the cited siman/se'if (so it is certainly the Rema, not the Mechaber), and the
     reference matches that siman/se'if;
   - Ben Ish Hai: in a paragraph that names the community (Baghdad / Jerusalem / Beit El);
   - Wikipedia: in the article re-fetched from Wikipedia at the exact cited revision (`parse&oldid`).
   Communities, fields, calendar and life-cycle triggers are validated; duplicates removed.
4. **Editorial pass** (`editorial.mjs`): removed financial items, the author's own household customs ("בביתנו"),
   a passage Wikipedia marks "דרוש מקור"; removed calendar triggers that were approximations or diaspora-only dates,
   and seasonal ones (bakashot) that a plain Shabbat trigger would misplace.
5. **Import** (`convert.mjs`) → `src/data/tradition/research.mjs`; the app's own gate (`../check-corpus.mjs`) runs on it.

The drafts and fetched pages were working files and are not stored in the repository; the scripts document the rules.
