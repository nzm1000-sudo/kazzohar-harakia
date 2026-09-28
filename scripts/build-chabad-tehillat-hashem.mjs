// Builds the offline "Siddur Tehillat Hashem" pack (Chabad, Nusach Ha-Ari) from the Open Siddur Project's plain-text
// transcriptions by Shmuel Gonzales, kept unchanged in sources/opensiddur-chabad/ (provenance: that folder's README).
//   node scripts/build-chabad-tehillat-hashem.mjs [--report <file.json>]
// Writes src/data/nusach/siddurChabadTehillatHashem.mjs in the shape of the Sefaria packs (source / schema / texts).
// Deterministic: the same sources always give the same bytes. The prayer words are never edited: the script only
// removes file furniture (credits, wiki markup, footnote markers, direction marks) and wraps the transcriber's English
// in small print. Every such change is counted, and --report writes the full list for docs/siddur/.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const SOURCE_DIR = new URL('sources/opensiddur-chabad/', ROOT);
const OUT = new URL('src/data/nusach/siddurChabadTehillatHashem.mjs', ROOT);
const args = Object.fromEntries(process.argv.slice(2).map((arg, i, list) => (arg.startsWith('--') ? [arg.slice(2), list[i + 1]] : null)).filter(Boolean));

const INDEX = 'Siddur Tehillat Hashem';
const HE_INDEX = 'סידור תהלת ה׳';
const LICENSE = 'CC0 (Hebrew) / CC BY 4.0 (instructions)';
const ATTRIBUTION = 'Contributors to the Open Siddur Project, transcribed by Shmuel Gonzales';
const POST_URL = 'https://opensiddur.org/?p=1260';
const FILE_URL = name => `https://opensiddur.org/wp-content/uploads/2010/08/${name}`;
const ARCHIVE_URL = name => `https://web.archive.org/web/2024id_/${FILE_URL(name)}`;

// One schema node per file, in the order of the day and the year. English titles follow each file's own title page;
// Hebrew titles follow its Hebrew heading, corrected where the heading is misspelt (docs/siddur/chabad-tehillat-hashem-import.md).
const FILES = [
  { stem: 'The-Morning-Blessings', en: 'The Morning Blessings', he: 'תפלת השחר' },
  { stem: 'Shaḥarit-Morning', en: 'The Weekday Morning Service', he: 'שחרית לחול' },
  { stem: 'Minḥah-Afternoon', en: 'The Afternoon Prayers for Weekdays', he: 'תפלת מנחה לחול' },
  { stem: 'Maariv-Evening', en: 'The Evening Prayers for Weekdays', he: 'תפלת ערבית לחול' },
  { stem: 'The-Bedtime-Shema', en: 'The Bedtime Shema', he: 'קריאת שמע על המטה' },
  { stem: 'Tikkun-Ḥatzot', en: 'Tikkun Chatzot', he: 'תקון חצות' },
  { stem: 'Kabbalat-Shabbat', en: 'Kabbalat Shabbat', he: 'קבלת שבת' },
  { stem: 'The-Shabbat-Book', en: 'The Shabbat Book', he: 'סדר תקוני שבת' },
  { stem: 'Shaḥarit-Musaf-Shabbat', en: 'Shacharit and Musaf for Shabbat and Festivals', he: 'שחרית ומוסף לשבת ויום טוב' },
  { stem: 'Minḥah-Shabbat-Afternoon', en: 'The Afternoon Prayers for Shabbat', he: 'תפלת מנחה לשבת' },
  { stem: 'Hallel-Musaf-Rosh-Ḥodesh', en: 'Hallel and Musaf for Rosh Chodesh', he: 'סדר הלל ומוסף לראש חודש בחול', heSource: 'סדר הלל ומסף לראש חודש בחול' },
  { stem: 'Shelosh-Regalim', en: 'Prayers for the Three Festivals', he: 'תפלות לשלש רגלים', heSource: 'תפלת לשלש רגלים' },
  { stem: 'Ḥag-Sukkot', en: 'The Holiday of Sukkot', he: 'חג הסוכות', heSource: 'הג הסכות' },
  { stem: 'The-Blessing-Book', en: 'The Blessings Book', he: 'סדר ברכות' },
  { stem: 'Sefirat-HaOmer', en: 'Counting the Omer', he: 'סדר ספירת העומר' },
  { stem: 'Kiddush-Levana', en: 'Sanctification of the Moon', he: 'סדר קידוש לבנה' },
  { stem: 'Megillat-Esther-Blessings', en: 'The Megillah Reading', he: 'קריאת המגילה' },
  { stem: 'Prayer-for-Travelers', en: 'Prayer for Travelers', he: 'תפילת הדרך' },
];

// Section (✶) headings whose spelling is wrong in the source. Only the schema title changes; the text has no heading line.
const HE_TITLE_FIXES = {
  'סדר קריאת התור': 'סדר קריאת התורה',
  'סדר קריאת התור לשבת ויום טוב': 'סדר קריאת התורה לשבת ויום טוב',
  'בירכת כהנים': 'ברכת כהנים',
  'סדר קרבנ פסח': 'סדר קרבן פסח',
  'סעורת לליל שבת': 'סעודת ליל שבת',
  'ברכת אחרונות': 'ברכות אחרונות',
  'הרחמן לברית מיל': 'הרחמן לברית מילה',
};
const EN_TITLE_FIXES = {
  'Yikzor – Prayer for the Souls of the Departed': 'Yizkor – Prayer for the Souls of the Departed',
};

const report = { splits: [], files: [], normalisation: [], artefacts: {}, footnotes: [], notes: [], tables: [], headings: [], credits: [], titleFixes: [], warnings: [] };
const bump = (key, n = 1) => { report.artefacts[key] = (report.artefacts[key] || 0) + n; };

const HEB_LETTER = /[\u05D0-\u05EA\u05F0-\u05F2]/g;
const LATIN = /[A-Za-z]/g;
const POINTS = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/g;
const count = (text, re) => (text.match(re) || []).length;
const plain = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const squash = text => text.replace(/[\t \u00A0]+/g, ' ').trim();

// The transcriber's credit block. It opens every file (or sits under the first heading) and is not prayer text.
const CREDIT_LINES = [
  /^Comparable to the$/i, /^Siddur Tehillat HASHEM$/i, /^Siddur Torah Ohr$/i, /^NUSACH HA-ARI ZAL$/i,
  /^According to the Text of$/i, /^Rabbi Shneur Zalman of Liadi$/i, /^Compiled and newly typeset by/i,
  /^Version \d/i, /^One should not rely only upon this text/i, /^When printed this text is/i,
];

// ---------------------------------------------------------------------------------------------------------------
// Reading a file

function normaliseSource(raw, file) {
  const stats = { file };
  let text = raw;
  stats.bom = count(text, /\uFEFF/g);
  text = text.replace(/\uFEFF/g, '');
  stats.crlf = count(text, /\r\n/g);
  text = text.replace(/\r\n?/g, '\n');
  stats.directionMarks = count(text, /[\u200E\u200F]/g);
  text = text.replace(/[\u200E\u200F]/g, '');
  // Hebrew presentation forms (U+FB1D–FB4F, e.g. "וֹ" as one code point) are replaced by their canonical
  // decomposition (letter + point). Canonically equivalent: the same letters and points, the same rendering, but
  // searchable and matched by the rest of the app (plainText strips U+0591–U+05C7 points, not presentation forms).
  stats.presentationForms = count(text, /[\uFB1D-\uFB4F]/g);
  text = text.replace(/[\uFB1D-\uFB4F]/g, ch => ch.normalize('NFD'));
  report.normalisation.push(stats);
  return text;
}

// Lines the script cannot read by rule: English directions whose Hebrew words are quoted in visual (reversed) order.
// "“יְהִי כְבוֹד” Stand while reciting until יְיָ מֶלֶךְ …" means: stand from "יְהִי כְבוֹד" until "יְיָ מֶלֶךְ …".
const FORCE_DIRECTION = [/Stand while reciting until/];

const cleanTitle = line => squash(line.replace(/<[^>]+>/g, '').replace(/'{2,}/g, '').replace(/[✶★]/g, ''));
const creditText = line => squash(line.replace(/\[\[Image:[^\]]*\]\]/g, '').replace(/\[(https?:\/\/\S+) ([^\]]+)\]/g, '$2').replace(/<[^>]+>/g, '').replace(/'{2,}/g, ''));
const isCredit = line => CREDIT_LINES.some(re => re.test(creditText(line)));

// ---------------------------------------------------------------------------------------------------------------
// One line of source → cleaned inline markup, its footnotes, and what kind of line it is

function inline(raw, where) {
  let s = raw;
  const notes = [];
  s = s.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/g, (_, inner) => {
    const note = squash(inner.replace(/<[^>]+>/g, '').replace(/'{2,}/g, ''));
    if (note) notes.push(note);
    report.notes.push({ ...where, note });
    bump('<ref>…</ref> footnote moved after its paragraph');
    return '';
  });
  s = s.replace(/<ref[^>]*\/>/g, () => { bump('<ref/> (empty) removed'); return ''; });
  const centered = /^\s*<center>/.test(s);
  s = s.replace(/\[\[Image:[^\]]*\]\]/g, () => { bump('[[Image:]] removed'); return ''; });
  for (const [re, label] of [
    [/<\/?center>/g, '<center> tag removed'], [/<div[^>]*>|<\/div>/g, '<div align> tag removed'], [/<\/?u>/g, '<u> tag removed'],
    [/<\/?nowiki>/g, '<nowiki> tag removed'], [/<\/?sup>/g, '<sup> tag removed (ordinal suffix kept as text)'], [/<references\/>/g, '<references/> removed'],
  ]) s = s.replace(re, () => { bump(label); return ''; });
  // Wiki emphasis: '''bold''' → <b>, ''italic'' → removed (italics mark the English, which is recognised by script).
  s = s.replace(/'''(.+?)'''/g, (_, inner) => { bump("'''bold''' → <b>"); return `<b>${inner}</b>`; });
  s = s.replace(/'''/g, () => { bump("unpaired ''' removed"); return ''; });
  s = s.replace(/''/g, () => { bump("'' italic marker removed"); return ''; });
  s = s.replace(/<b>(\s*)<\/b>/g, '$1');
  // Footnote markers glued to the Hebrew ("חֲמָתוֹ:1", "יַעֲנֵנוּ:</b>12"): the number goes, the words stay.
  s = s.replace(/([\u05D0-\u05EA\u05F0-\u05F2][\u0591-\u05C7]*[:.,;\u05C3)\]]?(?:<\/b>)?)(\d{1,3})(?!\d)/g, (m, before, digits, offset, all) => {
    const context = plain(all.slice(Math.max(0, offset - 40), offset) + before);
    report.footnotes.push({ ...where, marker: digits, after: context.split(' ').slice(-3).join(' ') });
    bump('footnote number removed');
    return before;
  });
  // One marker is set off by a space at the end of its line ("מִגְדּוֹל 10").
  s = s.replace(/([\u05D0-\u05EA\u05F0-\u05F2][\u0591-\u05C7]*[:.,;\u05C3]?)\s+(\d{1,3})\s*$/, (m, before, digits, offset, all) => {
    report.footnotes.push({ ...where, marker: digits, after: plain(all.slice(0, offset) + before).split(' ').slice(-3).join(' ') });
    bump('footnote number removed');
    return before;
  });
  s = squash(s.replace(/\s+/g, ' '));
  s = s.replace(/<b>\s+/g, ' <b>').replace(/\s+<\/b>/g, '</b> ').replace(/\s+/g, ' ').trim();
  return { html: s, notes, centered, star: /★/.test(raw) };
}

const ACRONYM = /^[\u05D0-\u05EA]{2}"[\u05D0-\u05EA] [\u05D0-\u05EA]{2}"[\u05D0-\u05EA]$/;

function classify(html, { centered }) {
  const text = plain(html);
  if (!text) return 'empty';
  if (ACRONYM.test(text)) return 'acronym';
  const heb = count(text, HEB_LETTER);
  const hebUnquoted = count(text.replace(/“[^”]*”|"[^"]*"/g, ''), HEB_LETTER);
  const lat = count(text, LATIN);
  const firstLetter = text.match(/\p{L}/u)?.[0] || '';
  // Said words with a bracketed English condition: "עשֶֹׁה שָׁלוֹם (During the Ten Days … - הַשָּׁלוֹם) בִּמְרוֹמָיו",
  // "(Say in an undertone - בּוֹאִי כַלָּה …)". These are prayer lines with inline English, not directions.
  const hebrewFirst = HEB_LETTER.test(firstLetter) && hebUnquoted * 2 >= lat;
  HEB_LETTER.lastIndex = 0;
  const bracketedAddition = /^\(.*\)$/.test(text) && /[-:–]\s*[\u05D0-\u05EA\u05F0-\u05F2][^A-Za-z]*\)$/.test(text);
  if (lat && lat > hebUnquoted && !hebrewFirst && !bracketedAddition) return 'english';
  if (!heb) return /\p{L}/u.test(text) ? 'english' : 'other';
  const words = text.split(' ').length;
  const pointed = count(text, POINTS) / heb;
  if (!lat && pointed < 0.25 && words <= 8 && (centered || !/[:.]$/.test(text))) return 'hebrew-heading';
  return 'hebrew';
}

// A short English line is a heading ("Psalm 95", "The Mourners Kaddish"), not an instruction.
function isEnglishTitle(text, { centered, afterHeading }) {
  if (!/^[A-Z0-9]/.test(text) || /[:.;,]$/.test(text) || text.split(' ').length > 8) return false;
  if (/^[^a-z]+$/.test(text) && /[A-Z]{4}/.test(text)) return false; // "THE MEGILLAH IS NOW READ" is a direction
  return centered || afterHeading || /^Psalms? \d/.test(text);
}

// English inside a Hebrew paragraph ("(Cong: אָמֵן)") → <small class="en">Cong:</small>, brackets left outside.
function wrapEnglish(html) {
  return html.split(/(<[^>]+>)/).map(part => {
    if (part.startsWith('<')) return part;
    return part.replace(/[A-Za-z][^\u0590-\u05FF]*/g, run => {
      let core = run;
      let tail = '';
      const move = n => { tail = core.slice(-n) + tail; core = core.slice(0, -n); };
      for (;;) {
        if (/[\s(“"‘]$/.test(core)) move(1);
        else if (/\)[,.;:]*$/.test(core) && count(core, /\(/g) < count(core, /\)/g)) move(core.match(/\)[,.;:]*$/)[0].length);
        else break;
      }
      bump('inline English wrapped in <small class="en">');
      return `<small class="en">${core}</small>${tail}`;
    });
  }).join('');
}

// A line that opens with a direction and runs on into the prayer ("Bow while saying the words “…" עָלֵינוּ לְשַׁבֵּחַ …",
// "If no Kohen is present, the gabbai substitutes saying: “…” וְתִגָּלֶה …"). The cut is the first point, after an
// English letter or a closing quotation mark, where the rest starts with Hebrew, holds three or more Hebrew words, has
// no English (brackets such as "(name)" aside) before its fifth Hebrew word, and leaves the direction with no bracket or quotation open.
function splitDirection(html) {
  const HEB_START = /^(?:<b>)?[\u05D0-\u05EA\u05F0-\u05F2]/;
  let inTag = false;
  for (let i = 0; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (inTag || !/[A-Za-z”"]/.test(ch)) continue;
    const head = squash(html.slice(0, i + 1));
    const tail = html.slice(i + 1).trim();
    if (!HEB_START.test(tail) || !/[A-Za-z]/.test(plain(head))) continue;
    const tailText = plain(tail);
    const hebrewWords = tailText.split(' ').filter(word => /[\u05D0-\u05EA\u05F0-\u05F2]/.test(word)).length;
    const firstLatin = tailText.replace(/\([^()]*\)/g, m => ' '.repeat(m.length)).search(/[A-Za-z]/);
    const wordsBeforeLatin = (firstLatin < 0 ? tailText : tailText.slice(0, firstLatin)).split(' ').filter(word => /[\u05D0-\u05EA\u05F0-\u05F2]/.test(word)).length;
    if (hebrewWords < 3 || (firstLatin >= 0 && wordsBeforeLatin < 5)) continue;
    const quotes = count(head, /[“”"]/g);
    if (count(head, /\(/g) !== count(head, /\)/g) || quotes % 2 === 1 || count(head, /“/g) > count(head, /[”"]/g)) continue;
    return [head, tail];
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Paragraph builder for one leaf

function makeLeafBuilder(where) {
  const paras = [];
  let lastWasHeading = false;
  const pushNotes = notes => { if (notes.length) paras.push({ kind: 'note', html: `<small class="en note">${notes.join(' · ')}</small>` }); };

  function render(item, context = {}) {
    const kind = classify(item.html, item);
    const text = plain(item.html);
    if (kind === 'empty') return null;
    if (kind === 'acronym') return { kind, html: text };
    if (kind === 'english' || kind === 'other') {
      const heading = kind === 'english' && isEnglishTitle(text, { centered: item.centered, afterHeading: context.afterHeading });
      return { kind: heading ? 'en-heading' : 'english', html: `<small class="${heading ? 'en heading' : 'en'}">${item.html}</small>` };
    }
    if (kind === 'hebrew-heading') {
      report.headings.push({ ...where, heading: text });
      return { kind: 'heading', html: `<big>${item.html}</big>` };
    }
    return { kind: 'prayer', html: wrapEnglish(item.html) };
  }

  function addLine(raw) {
    const item = inline(raw, where);
    const text = plain(item.html);
    // "קדושת השם – Holiness of God's Name": a Hebrew heading with its English name on the same line.
    const pair = text.match(/^([\u05D0-\u05EA\u05F0-\u05F2"'\s]+?)\s+[–-]\s+([A-Z][^\u0590-\u05FF]*)$/);
    if (pair && !item.notes.length && pair[1].split(' ').length <= 6) {
      paras.push({ kind: 'heading', html: `<big>${pair[1]}</big>` }, { kind: 'en-heading', html: `<small class="en heading">${pair[2]}</small>` });
      report.headings.push({ ...where, heading: text, pair: true });
      bump('Hebrew – English heading line → <big> + English heading');
      lastWasHeading = true;
      return;
    }
    // A direction and the prayer it introduces on one line ("Bow while saying the words “…" עָלֵינוּ לְשַׁבֵּחַ …"):
    // two paragraphs, the direction first.
    const split = !item.star && /^[^\p{L}]*[A-Za-z]/u.test(text) && splitDirection(item.html);
    if (split) {
      paras.push({ kind: 'english', html: `<small class="en">${split[0]}</small>` }, { kind: 'prayer', html: wrapEnglish(split[1]) });
      report.splits.push({ ...where, direction: plain(split[0]), prayer: plain(split[1]).slice(0, 60) });
      bump('direction + prayer on one line → two paragraphs');
      pushNotes(item.notes);
      lastWasHeading = false;
      return;
    }
    if (item.star) {
      // "★ קדיש יתום ★" or "★ קרבנות – Offerings ★": a sub-heading inside the leaf.
      const text = plain(item.html).replace(/★/g, '').trim();
      const [he, en] = /[A-Za-z]/.test(text) && /[\u05D0-\u05EA]/.test(text) ? text.split(/\s+[–-]\s+/) : [text, ''];
      if (/[\u05D0-\u05EA]/.test(he)) paras.push({ kind: 'heading', html: `<big>${squash(he)}</big>` });
      else paras.push({ kind: 'en-heading', html: `<small class="en heading">${squash(he)}</small>` });
      if (en) paras.push({ kind: 'en-heading', html: `<small class="en heading">${squash(en)}</small>` });
      report.headings.push({ ...where, heading: text, star: true });
      bump('★ sub-heading → <big>');
      lastWasHeading = true;
      pushNotes(item.notes);
      return;
    }
    if (FORCE_DIRECTION.some(re => re.test(text))) {
      paras.push({ kind: 'english', html: `<small class="en">${item.html}</small>` });
      bump('direction in visual order kept whole as <small class="en"> (FORCE_DIRECTION)');
      pushNotes(item.notes);
      lastWasHeading = false;
      return;
    }
    const out = render(item, { afterHeading: lastWasHeading });
    if (!out) { pushNotes(item.notes); return; }
    paras.push(out);
    pushNotes(item.notes);
    lastWasHeading = out.kind === 'heading';
  }

  function addRaw(para) { paras.push(para); lastWasHeading = false; }

  return { paras, addLine, addRaw, render, pushNotes };
}

// Wiki tables ({| … |}). Each is linearised in reading order; see the import doc for the table-by-table list.
function addTable(lines, builder, where, tableNo) {
  const rows = [[]];
  let cell = null;
  for (const line of lines.slice(1)) {
    if (line.startsWith('|}')) break;
    if (line.startsWith('|-')) { rows.push([]); cell = null; continue; }
    if (line.startsWith('|')) {
      const content = line.replace(/^\|\|?/, '').replace(/^\s*style="[^"]*"\s*\|/, '');
      cell = [content];
      rows.at(-1).push(cell);
    } else if (cell) cell.push(line);
  }
  const cellItems = cellLines => cellLines.filter(line => line.trim()).map(line => inline(line, where));
  const table = { ...where, table: tableNo, rows: rows.filter(r => r.length).length, cols: Math.max(...rows.map(r => r.length)) };
  const parsed = rows.filter(row => row.length).map(row => row.map(cellItems));
  const allSingle = parsed.every(row => row.every(items => items.filter(i => plain(i.html)).length <= 1));
  const isAcronymCell = items => items.length > 1 && items.every(i => ACRONYM.test(plain(i.html)));
  let mode = allSingle ? 'row-per-paragraph' : 'cell-by-cell';
  for (let cells of parsed) {
    // Hodu (Hallel): the response column "כִּי לְעוֹלָם חַסְדּוֹ" is the first cell but is said after the verse.
    const bare = items => (items.length === 1 ? plain(items[0].html).replace(/[\u0591-\u05C7]/g, '') : '');
    if (cells.length === 3 && bare(cells[0]).startsWith('כי לעולם חסדו') && cells[1].length) {
      cells = [cells[1], cells[0], cells[2]];
      mode = 'row-per-paragraph, verse before response';
    }
    // "(Others respond: “אָמֵן.”)" stands in the first cell but answers the blessing in the second.
    if (cells.length === 2 && /^\(?Others respond/.test(bare(cells[0])) && cells[1].length) {
      cells = [cells[1], cells[0]];
      mode = 'row-per-paragraph, blessing before response';
    }
    if (allSingle) {
      const parts = [];
      const notes = [];
      for (const [item] of cells.filter(c => c.length)) {
        const out = builder.render(item);
        notes.push(...item.notes);
        if (out) parts.push(out);
      }
      if (!parts.some(p => p.kind === 'prayer')) parts.forEach(p => builder.addRaw(p));
      else builder.addRaw({ kind: 'prayer', html: parts.map(p => p.html).join(' ') });
      builder.pushNotes(notes);
    } else {
      for (const items of cells) {
        if (isAcronymCell(items)) mode = 'kavanah columns (prayer / Divine-Name acronyms)';
        const texts = items.map(i => plain(i.html));
        // A caption over a short option ("Summer:" / "מוֹרִיד הַטָּל:") is read as one line.
        if (items.length === 2 && classify(items[0].html, items[0]) === 'english' && classify(items[1].html, items[1]) === 'hebrew') {
          if (/do not respond/i.test(texts[0])) builder.addRaw({ kind: 'english', html: `<small class="en">${items[0].html} ${items[1].html}</small>` });
          else builder.addRaw({ kind: 'prayer', html: `<small class="en">${items[0].html}</small> ${wrapEnglish(items[1].html)}` });
          builder.pushNotes([...items[0].notes, ...items[1].notes]);
          continue;
        }
        for (const item of items) {
          const out = builder.render(item);
          if (out) builder.addRaw(out);
          builder.pushNotes(item.notes);
        }
      }
    }
  }
  table.mode = mode;
  table.first = parsed.flat(2).map(i => plain(i.html)).join(' | ').slice(0, 90);
  report.tables.push(table);
  bump('wiki table linearised');
}

// Sefirat HaOmer: the day chart was flattened to one cell per line (day, count, sefirah, Ana Bekoach word, Psalm 67
// word, letter of "ישמחו"). Each day becomes one paragraph; the count is said, the rest is kavanah.
function omerRow(lines, i) {
  const cells = [];
  let j = i + 1;
  while (cells.length < 5 && j < lines.length) { if (lines[j].trim()) cells.push(squash(lines[j])); j += 1; }
  if (cells.length < 5 || !/^הַיּוֹם/.test(cells[0])) return null;
  return { next: j, html: `<small class="en">${lines[i].trim()}</small> ${cells[0]} <small class="kavanah">${cells.slice(1).join(' · ')}</small>` };
}

// Pair a run of Divine-Name acronym lines with the prayer lines just before it (Ana Bekoach).
function pairAcronyms(paras, where) {
  const out = [];
  for (let i = 0; i < paras.length; i += 1) {
    if (paras[i].kind !== 'acronym') { out.push(paras[i]); continue; }
    let j = i;
    while (j < paras.length && paras[j].kind === 'acronym') j += 1;
    const run = paras.slice(i, j);
    const targets = out.slice(-run.length);
    if (targets.length === run.length && targets.every(p => p.kind === 'prayer')) {
      targets.forEach((p, k) => { p.html = `${p.html} <small class="kavanah">${run[k].html}</small>`; });
      bump('Divine-Name acronym paired with its line as <small class="kavanah">', run.length);
    } else {
      run.forEach(p => out.push({ kind: 'kavanah', html: `<small class="kavanah">${p.html}</small>` }));
      report.warnings.push({ ...where, warning: `acronyms not paired (${run.length})` });
    }
    i = j - 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Files → leaves

const available = readdirSync(SOURCE_DIR).filter(name => name.endsWith('.txt'));
const texts = {};
const schemaNodes = [];
const fileSources = [];
const versions = [];

for (const spec of FILES) {
  const name = available.find(candidate => candidate.normalize('NFC').startsWith(`${spec.stem.normalize('NFC')}-Nusa`));
  if (!name) throw new Error(`missing source file for ${spec.stem}`);
  const displayName = name.normalize('NFC');
  const lines = normaliseSource(readFileSync(new URL(encodeURIComponent(name), SOURCE_DIR), 'utf8'), displayName).split('\n');

  const backStart = lines.findIndex(line => /am the original transcriber/.test(line));
  const back = backStart < 0 ? [] : lines.slice(backStart);
  const body = backStart < 0 ? lines : lines.slice(0, backStart);
  const starIdx = body.map((line, i) => (/✶/.test(line) ? i : -1)).filter(i => i >= 0);
  const front = body.slice(0, starIdx[0]).map(creditText).filter(Boolean);
  const credits = [];
  const fileNode = { nodes: [], title: spec.en, heTitle: spec.he, key: spec.en, titles: [{ text: spec.en, lang: 'en', primary: true }, { text: spec.he, lang: 'he', primary: true }] };
  const version = [...front, ...body.map(creditText)].find(line => /^Version \d/i.test(line)) || '';
  const versionTitle = `Siddur Tehillat Hashem (Nusach Ha-Ari), Open Siddur Project, transcribed by Shmuel Gonzales${version ? ` · ${spec.en}, ${version.replace(/\s+/g, ' ')}` : ''}`;
  if (spec.heSource) report.titleFixes.push({ file: displayName, level: 'file', before: spec.heSource, after: spec.he });

  const usedKeys = new Set();
  for (const [n, start] of starIdx.entries()) {
    const end = n + 1 < starIdx.length ? starIdx[n + 1] : body.length;
    let heTitle = cleanTitle(body[start]);
    // English title: the next line; a title that ends in a dash continues on the line after ("Birkat haMazon -").
    let cursor = start + 1;
    while (cursor < end && !body[cursor].trim()) cursor += 1;
    let enTitle = cleanTitle(body[cursor] || '');
    cursor += 1;
    if (/[-–]$/.test(enTitle)) {
      while (cursor < end && !body[cursor].trim()) cursor += 1;
      enTitle = `${enTitle} ${cleanTitle(body[cursor])}`;
      cursor += 1;
    }
    const heFixed = HE_TITLE_FIXES[heTitle];
    if (heFixed) { report.titleFixes.push({ file: displayName, level: 'leaf', before: heTitle, after: heFixed }); heTitle = heFixed; }
    const enFixed = EN_TITLE_FIXES[enTitle];
    if (enFixed) { report.titleFixes.push({ file: displayName, level: 'leaf', before: enTitle, after: enFixed }); enTitle = enFixed; }
    let key = enTitle;
    for (let k = 2; usedKeys.has(key); k += 1) key = `${enTitle} (${k})`;
    usedKeys.add(key);

    const where = { file: displayName, leaf: key };
    const builder = makeLeafBuilder(where);
    const leafLines = body.slice(cursor, end);
    let tableNo = 0;
    for (let i = 0; i < leafLines.length; i += 1) {
      const line = leafLines[i];
      if (!line.trim()) continue;
      if (isCredit(line)) { credits.push(creditText(line)); report.credits.push({ ...where, line: creditText(line) }); continue; }
      if (line.startsWith('{|')) {
        let j = i;
        while (j < leafLines.length && !leafLines[j].startsWith('|}')) j += 1;
        tableNo += 1;
        addTable(leafLines.slice(i, j + 1), builder, where, tableNo);
        i = j;
        continue;
      }
      if (/^\d{1,2}$/.test(line.trim())) {
        const row = omerRow(leafLines, i);
        if (row) { builder.addRaw({ kind: 'prayer', html: row.html }); bump('Omer chart row → one paragraph'); i = row.next - 1; continue; }
      }
      // The Omer chart's column captions ("Day", "Count", "Sefirah") are read as one caption.
      if (line.trim() === 'Day' && leafLines[i + 1]?.trim() === 'Count' && leafLines[i + 2]?.trim() === 'Sefirah') {
        builder.addRaw({ kind: 'en-heading', html: '<small class="en heading">Day · Count · Sefirah</small>' });
        i += 2;
        continue;
      }
      builder.addLine(line);
    }
    const paras = pairAcronyms(builder.paras, where);
    const he = paras.map(p => p.html).filter(Boolean);
    if (!he.length) { report.warnings.push({ ...where, warning: 'empty leaf' }); continue; }
    const ref = `${INDEX}, ${spec.en}, ${key}`;
    texts[ref] = {
      ref, heRef: `${HE_INDEX}, ${spec.he}, ${heTitle}`, he,
      versionTitle, license: LICENSE,
      heVersionTitle: versionTitle, heVersionSource: POST_URL, heLicense: LICENSE,
    };
    fileNode.nodes.push({ depth: 1, title: key, heTitle, key, titles: [{ text: key, lang: 'en', primary: true }, { text: heTitle, lang: 'he', primary: true }] });
  }
  schemaNodes.push(fileNode);
  versions.push({ version: versionTitle, leaves: fileNode.nodes.length });
  const licenceStatement = back.map(creditText).find(line => /am the original transcriber/.test(line)) || '';
  fileSources.push({
    file: displayName, title: spec.en, heTitle: spec.he, url: FILE_URL(displayName), fetchedFrom: ARCHIVE_URL(displayName),
    version, header: front.filter(line => !/^Version \d/i.test(line)), credits, licenceStatement,
  });
  report.files.push({ file: displayName, node: spec.en, leaves: fileNode.nodes.map(node => ({ title: node.title, heTitle: node.heTitle, paragraphs: texts[`${INDEX}, ${spec.en}, ${node.key}`].he.length })) });
}

const source = {
  index: INDEX, heTitle: HE_INDEX, nusach: 'chabad', edition: 'tehillat-hashem', provider: 'Open Siddur Project',
  url: POST_URL, accessedAt: '2026-09-28', license: LICENSE, attribution: ATTRIBUTION, transcriber: 'Shmuel Gonzales',
  basis: 'Consistent with the text of the Siddur Tehillat Hashem, Nusach Ha-Ari Zal, according to the text of Rabbi Shneur Zalman of Liadi',
  fetch: 'opensiddur.org answers HTTP 403 to scripted requests; every file was fetched from the Wayback Machine (web.archive.org/web/2024id_/<file url>).',
  versions, excludedLeaves: [], missing: [{ file: 'Hanukkah (Nusach Ha-Ari)', why: 'linked from the post but not archived (404)' }],
  files: fileSources,
};

writeFileSync(OUT, `// Generated by scripts/build-chabad-tehillat-hashem.mjs from the Open Siddur Project's Chabad (Nusach Ha-Ari) texts — do not edit by hand.\n// Sources and licence: sources/opensiddur-chabad/README.md (${LICENSE}; attribution: ${ATTRIBUTION}). Import notes: docs/siddur/chabad-tehillat-hashem-import.md.\nexport default ${JSON.stringify({ source, schema: { nodes: schemaNodes }, texts })};\n`);
if (args.report) writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`);

const paragraphs = Object.values(texts).reduce((sum, text) => sum + text.he.length, 0);
console.log(INDEX, '→', OUT.pathname, '·', schemaNodes.length, 'files ·', Object.keys(texts).length, 'leaves ·', paragraphs, 'paragraphs');
for (const node of schemaNodes) console.log('  ', node.title, '×', node.nodes.length);
for (const warning of report.warnings) console.log('   warning:', warning.file, '·', warning.leaf, '·', warning.warning);
