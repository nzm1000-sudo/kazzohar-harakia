// שלום רב — the author's book as an independent library: complete, in its own order, with the explanations kept
// apart from the words said, attributions kept, names filled in on screen only, searchable, offline, and without
// touching the Siddur or the Halacha Engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import book from '../src/data/shalomRav/book.mjs';
import { searchShalomRav, personalize, personName, parseShalomRavRoute, tocRoute, neighbours, relatedEntries, entriesForNeed, entriesInCategory,
  foldHebrew, inlineParts, shalomRavRoute } from '../src/services/shalomRav.mjs';
import { FAVORITE_GROUPS } from '../src/services/favorites.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const byId = Object.fromEntries(book.entries.map(entry => [entry.id, entry]));
const allText = entry => entry.blocks.map(block => block.text || block.title || '').join('\n');
const saidText = entry => entry.blocks.filter(block => block.type === 'text' || block.type === 'source').map(block => block.text).join('\n');

test('the whole book: 45 entries in the book order, unique ids, every one traced to its printed and PDF pages', () => {
  assert.equal(book.entries.length, 45);
  assert.equal(new Set(book.entries.map(entry => entry.id)).size, 45);
  book.entries.forEach((entry, i) => {
    assert.equal(entry.order, i + 1, entry.id);
    const [a, b] = entry.printedPages;
    assert.ok(a >= 3 && b <= 110 && a <= b, entry.id);
    assert.deepEqual(entry.pdfPages, [Math.floor(a / 2) + 1, Math.floor(b / 2) + 1], entry.id);
    assert.ok(entry.blocks.length, entry.id);
    for (const block of entry.blocks) assert.ok(block.pages.every(page => page >= a && page <= b) || entry.id === 'lachash-ayin-hara', `${entry.id} block pages`);
  });
  // pages follow the book: every entry starts where the previous one ended or later
  for (let i = 1; i < book.entries.length; i++) assert.ok(book.entries[i].printedPages[0] >= book.entries[i - 1].printedPages[1] - (book.entries[i].id === 'lachash-ayin-hara' ? 1 : 0), book.entries[i].id);
  assert.equal(book.entries[0].id, 'hakdama');
  assert.equal(book.entries.at(-1).id, 'divrei-siyum');
  // the printed table of contents: 44 lines, every one reaches an entry (and the sandak its section)
  assert.equal(book.toc.length, 44);
  for (const item of book.toc) {
    const route = parseShalomRavRoute(tocRoute(item.target));
    assert.ok(byId[route.id], item.title);
    if (route.anchor) assert.ok(byId[route.id].blocks.some(block => block.anchor === route.anchor), item.title);
  }
});

test('topics and needs are navigation only, and every readable entry is reachable', () => {
  assert.deepEqual(book.categories.map(c => c.title), ['ישועה ובקשה', 'שמירה והגנה', 'אמונה וחיזוק', 'תפילה ועבודת היום', 'בית, משפחה ומצוות', 'סגולות ותיקונים']);
  const inTopics = new Set(book.categories.flatMap(category => entriesInCategory(book, category.key).map(entry => entry.id)));
  assert.equal(inTopics.size, 43, 'all but the introduction and the closing words');
  for (const id of ['tefila-lecholeh', 'shalom-bayit', 'tefilat-haem', 'leida-kala', 'parnasa-beshefa']) assert.equal(byId[id].category, 'yeshua', id);
  for (const id of ['lachash-ayin-hara', 'shmira-vehagana', 'tefilat-haderech', 'chayalei-israel', 'lehinatzel']) assert.equal(byId[id].category, 'shmira', id);
  for (const id of ['pidyon-nefesh', 'tikun-haklali', 'hatarat-nedarim', 'segula-parnasa', 'parashat-haman']) assert.equal(byId[id].category, 'segulot', id);
  // The owner's review (2026-09-29): דרך ונסיעה, סכנה and שמירה joined into בריאות — nine needs, a 3×3 grid.
  assert.deepEqual(book.needs.map(n => n.title), ['פרנסה', 'בריאות', 'זיווג', 'ילדים', 'משפחה', 'שלום בית', 'בית', 'חיזוק', 'שבת']);
  assert.deepEqual(entriesForNeed(book, 'parnasa').map(e => e.id), ['parnasa-beshefa', 'segula-parnasa', 'parashat-haman', 'parnasat-hamishpacha', 'rechishat-dira']);
  for (const need of book.needs) assert.ok(entriesForNeed(book, need.key).length >= 1, need.key);
  assert.deepEqual(relatedEntries(book, byId['parnasa-beshefa']).map(e => e.id).sort(), ['parashat-haman', 'parnasat-hamishpacha', 'rechishat-dira', 'segula-parnasa']);
});

test('the author\'s explanations are kept, apart from the words said', () => {
  const explained = book.entries.filter(entry => entry.blocks.some(block => block.type === 'explanation'));
  assert.ok(explained.length >= 20, `${explained.length} entries with an explanation`);
  const explanation = id => byId[id].blocks.find(block => block.type === 'explanation').text;
  assert.match(explanation('birchot-hashachar'), /^ברכות השחר - ברכות השחר נאמרות בכל בוקר/);
  assert.match(explanation('pitum-haketoret'), /מובא בזוהר הקדוש/);
  assert.match(explanation('pidyon-nefesh'), /צדקה תציל ממות/);
  assert.match(explanation('tikun-haklali'), /רבי נחמן מברסלב/);
  assert.match(explanation('lachash-ayin-hara'), /^עין הרע- השפעת עין הרע/, 'the note printed before the heading opens the entry it explains');
  for (const entry of explained) {
    for (const block of entry.blocks.filter(b => b.type === 'explanation')) {
      assert.ok(!saidText(entry).includes(block.text.slice(0, 40)), `${entry.id}: explanation inside the text`);
    }
  }
  // the words said never open with the explanation's words
  assert.match(byId['birchot-hashachar'].blocks.find(b => b.type === 'text').text, /^מודֶה \/ מודָה \/ אֲנִי/);
  assert.equal(byId.hakdama.blocks.filter(b => b.type === 'text').length, 0);
  assert.deepEqual(byId.hakdama.blocks.at(-1), { ...byId.hakdama.blocks.at(-1), type: 'signature', text: 'בברכה רבה הרב ברבי' });
});

test('attribution survives exactly as the book gives it', () => {
  assert.equal(byId['tefila-lecholeh'].attributedTo, 'החיד״א');
  assert.equal(byId['lachash-ayin-hara'].attributedTo, 'החיד״א, עבודת הקודש');
  assert.equal(byId['milchama-chida'].attributedTo, 'החיד״א');
  assert.equal(byId['igeret-haramban'].attributedTo, 'הרמב״ן');
  assert.equal(byId['inyan-hasimcha'].attributedTo, 'רבי נחמן מברסלב');
  assert.equal(byId['tikun-haklali'].attributedTo, 'רבי נחמן מברסלב');
  const zivug = byId.zivug.blocks.filter(block => block.type === 'section');
  assert.deepEqual(zivug.map(s => [s.title, s.origin, s.attributedTo]), [['זיווג סוד הקיום', 'attributed', 'השל״ה הקדוש'], ['תפילה נוספת לאיש- (הרב ש״י ברבי)', 'author', 'הרב ש״י ברבי']]);
  // the author is never credited with an attributed or traditional text
  for (const entry of book.entries) if (entry.origin !== 'author') assert.notEqual(entry.attributedTo, 'הרב שלום יוסף ברבי', entry.id);
  assert.deepEqual(book.entries.filter(e => e.origin === 'author').map(e => e.id), ['hakdama', 'divrei-siyum']);
  assert.match(read('../src/pages/ShalomRavPage.jsx'), /author: 'מאת הרב שלום יוסף ברבי'/);
  assert.match(read('../src/pages/ShalomRavPage.jsx'), /הסבר מתוך שלום רב/);
});

test('names the book leaves blank: filled on screen only, never guessed, each placeholder where the book puts it', () => {
  const withNames = book.entries.filter(entry => entry.personalization);
  assert.ok(withNames.length >= 9);
  for (const entry of withNames) {
    const text = allText(entry);
    for (const rule of entry.personalization.placeholders) {
      const count = text.split(rule.token).length - 1;
      assert.ok(count >= (rule.nth || 1), `${entry.id}: "${rule.token}" appears ${count}`);
      assert.ok(entry.personalization.people.some(person => person.key === rule.person), entry.id);
    }
  }
  const home = byId['shalom-bayit'];
  const text = home.blocks.find(block => block.text?.includes('לבין בעלי')).text;
  const parts = personalize(text, home.personalization, { a: { name: 'שרה', link: 'בת', mother: 'רחל' }, b: { name: 'יעקב', link: 'בן', mother: 'לאה' } }, {});
  assert.deepEqual(parts.filter(p => p.placeholder).map(p => p.filled), ['שרה בת רחל', 'יעקב בן לאה']);
  assert.ok(text.includes('(פב״פ)') || text.includes('(פב”פ)'), 'the stored text is untouched');
  // no connective chosen: the reader sees בן/בת, not a guess
  assert.equal(personName({ mother: true }, { name: 'משה', mother: 'רחל' }), 'משה בן/בת רחל');
  assert.equal(personName({ mother: true }, { name: '' }), '');
  const sick = byId['tefila-lecholeh'];
  const first = sick.blocks.find(block => block.text?.includes('[ויאמר את שם החולה'));
  assert.equal(personalize(first.text, sick.personalization, {}, {}).filter(p => p.placeholder).every(p => p.filled === ''), true, 'empty names keep the book\'s placeholder');
});

test('search finds the book by need, title, attribution and words', () => {
  const ids = q => searchShalomRav(book, q).map(result => result.entry.id);
  for (const id of ['parnasa-beshefa', 'parnasat-hamishpacha', 'segula-parnasa', 'parashat-haman']) assert.ok(ids('פרנסה').includes(id), id);
  assert.equal(ids('חולה')[0], 'tefila-lecholeh');
  assert.equal(ids('עין הרע')[0], 'lachash-ayin-hara');
  assert.equal(ids('שלום בית')[0], 'shalom-bayit');
  assert.ok(ids('החידא').includes('tefila-lecholeh'));
  assert.equal(ids('תפילת הדרך')[0], 'tefilat-haderech');
  assert.ok(ids('מחתה').includes('pitum-haketoret'), 'the words of the text itself');
  assert.equal(foldHebrew('שָׁלוֹם רָב'), 'שלומ רב');
  assert.deepEqual(ids('   '), []);
  assert.match(read('../src/pages/LearningSearch.jsx'), /<ShalomRavSearchGroup query=\{query\} onNav=\{onNav\}\/>/);
});

test('the text itself: pointed, complete to its last line, no doubled extraction, typography only normalized', () => {
  const pointed = book.entries.filter(entry => /[ְ-ּ]/.test(saidText(entry)));
  assert.ok(pointed.length >= 36);
  const last = id => byId[id].blocks.filter(b => b.text).at(-1).text;
  assert.match(last('tikun-haklali'), /אמן נצח סלה ועד:?$/);
  assert.match(last('hatarat-nedarim'), /וְלֹא יַעֲשׂוּ בָכֶם שׁוּם רֹשֶׁם כְּלָל\.$/);
  assert.match(saidText(byId['shir-hashirim']), /עַל, הָרֵי בְשָׂמִים\./);
  assert.match(last('kriat-shema-al-hamita'), /קְהִלַּת יַעֲקֹב:$/);
  assert.match(last('amida-shacharit'), /וְעַל כָּל עַמּוֹ יִשְׂרָאֵל, וְאִמְרוּ אָמֵן:$/);
  assert.match(saidText(byId['amida-shacharit']), /בָּרוּךְ אַתָּה יְהֹוָה, אֱלֹהֵינוּ וֵאלֹהֵי אֲבוֹתֵינוּ/);
  for (const entry of book.entries) {
    const texts = entry.blocks.map(block => block.text).filter(Boolean);
    texts.forEach((text, i) => { if (i) assert.notEqual(text, texts[i - 1], `${entry.id}: doubled block`); });
    assert.doesNotMatch(allText(entry), /[א-ת][֑-ׇ]*”[א-ת]/, `${entry.id}: gershayim normalized`);
    assert.doesNotMatch(allText(entry), /(^|\s)[֑-ׇ]/, `${entry.id}: a point without its letter`);
  }
  assert.deepEqual(inlineParts('אמר (בלחש) שלום').map(p => !!p.aside), [false, true, false]);
});

test('offline, favorites, reading in order, and the section in the menu', () => {
  assert.doesNotMatch(read('../src/services/shalomRav.mjs'), /fetch\(|https?:/, 'no network');
  assert.match(read('../src/services/shalomRav.mjs'), /import\('\.\.\/data\/shalomRav\/book\.mjs'\)/);
  assert.ok(FAVORITE_GROUPS.some(([kind, label]) => kind === 'shalom-rav' && label === 'שלום רב'));
  assert.match(read('../src/pages/ShalomRavPage.jsx'), /routeFavorite\('shalom-rav', shalomRavRoute\.entry\(entry\.id\)/);
  assert.deepEqual([neighbours(book, 'hakdama').previous, neighbours(book, 'hakdama').next.id], [null, 'birchot-hashachar']);
  assert.deepEqual([neighbours(book, 'divrei-siyum').previous.id, neighbours(book, 'divrei-siyum').next], ['tikun-haklali', null]);
  assert.deepEqual(parseShalomRavRoute('shalom-rav/e/brit-mila/sandak'), { view: 'entry', id: 'brit-mila', anchor: 'sandak' });
  assert.equal(shalomRavRoute.need('parnasa'), 'shalom-rav/need/parnasa');
  assert.match(read('../src/components/Shell.jsx'), /\['shalom-rav','שלום רב'\]/);
  assert.match(read('../src/NewApp.jsx'), /mode==='shalom-rav' \|\| mode\.startsWith\('shalom-rav\/'\) \? <ShalomRavPage/);
});

test('no impact on the Siddur or the Halacha Engine', () => {
  const siddurFiles = ['../src/data/nusach/siddurSefard.mjs', '../src/data/nusach/siddurAshkenaz.mjs', '../src/data/nusach/siddurChabad.mjs', '../src/data/siddurOffline.mjs', '../src/pages/BooksPage.jsx'];
  // (the Amida's own blessing "שלום רב" has the id 'shalom-rav' in the compositions — a different thing)
  const link = /shalomRav|ShalomRav|shalom-rav\//;
  for (const file of siddurFiles) assert.doesNotMatch(read(file), link, file);
  for (const file of readdirSync(new URL('../src/data/nusach/compositions', import.meta.url))) assert.doesNotMatch(read(`../src/data/nusach/compositions/${file}`), link, file);
  for (const file of ['../src/data/practicalHalachaQa.mjs', '../src/services/halachaSearch.mjs', '../src/services/halachaEngine.mjs']) assert.doesNotMatch(read(file), link, file);
});

test('every page was compared with the printed image; the two faults the review found cannot come back', () => {
  for (const entry of book.entries) {
    assert.equal(entry.verification.status, 'VISUALLY_VERIFIED', entry.id);
    assert.equal(entry.verification.reviewedPages, entry.verification.pages, entry.id);
    const text = allText(entry);
    // a pointed letter standing alone is a word the letter spacing split (the book has no one-letter pointed words)
    assert.doesNotMatch(text, /(^|\s)[\u05D0-\u05EA][\u0591-\u05C7]+(?=\s)/, `${entry.id}: split word`);
    // a dot on the shin read as a holam: a holam on a shin always comes with the shin's own dot in this book
    assert.doesNotMatch(text, /ש[\u05B0-\u05BC]*\u05B9(?![\u05BC]?[\u05C1\u05C2])/, `${entry.id}: sin dot encoded as holam`);
  }
  const reviews = readdirSync(new URL('../sources/shalom-rav/review', import.meta.url)).filter(name => /^review-.*\.json$/.test(name));
  const pages = reviews.flatMap(name => JSON.parse(read(`../sources/shalom-rav/review/${name}`)).pages.map(page => page.page)).sort((a, b) => a - b);
  assert.deepEqual(pages, Array.from({ length: 108 }, (_, i) => i + 3), 'printed pages 3–110, each reviewed once');
});
