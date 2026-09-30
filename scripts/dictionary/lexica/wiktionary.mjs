// Parser of the Hebrew Wiktionary pages (CC BY-SA 4.0, revision-pinned) the word lookup draws on — build time only.
//   aramaic:        [{ key, gloss, pageTitle, revid, hebrewPage }] — senses marked {{ארמית}} (or pages of the Aramaic
//                   category), short plain Hebrew only; hebrewPage: the page also has Hebrew senses (a homograph)
//   abbreviations:  [{ key, expansions: [..], pageTitle, revid }] — Jewish-bookshelf senses only
//   idioms:         [{ words: [keys], gloss, pageTitle, revid }] — the Aramaic idioms category, short senses only
import { tidy, words, HEBREW_ONLY } from './common.mjs';
import { normalizeLookupToken, isAbbreviationKey } from '../../../src/services/wordLookup/normalize.mjs';

const JEWISH_LABELS = /^(ארון הספרים היהודי|יהדות|ארמית|תלמוד|הלכה|קבלה|תפילה|ברכות|חסידות|תורה|מקרא|חז"ל|חזל)$/;
function cleanWiki(text) {
  return tidy(text
    .replace(/<\/?br\s*\/?>.*$/i, '')
    .replace(/<ref[^>]*>.*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/<small>.*?<\/small>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''|''/g, '')
    .replace(/\s+–\s+.*$/, '')).replace(/\.$/, '').replace(/'/g, '׳').replace(/"/g, '״').trim();
}

export function parseWiktionary(rawText) {
  const out = { aramaic: [], abbreviations: [], idioms: [] };
  for (const line of rawText.split('\n')) {
    if (!line) continue;
    const page = JSON.parse(line);
    const sections = page.wikitext.split(/^==(?!=)\s*(.+?)\s*==\s*$/m);
    const abbreviationPage = page.categories.some(c => c.includes('ראשי תיבות'));
    const idiomPage = page.categories.some(c => c.includes('ניבים'));
    const aramaicCategory = page.categories.some(c => c === 'קטגוריה:ערכים בשפה הארמית');
    for (let i = 1; i < sections.length; i += 2) {
      const heading = sections[i].replace(/\{\{.*?\}\}/g, '').trim();
      const body = sections[i + 1] || '';
      const headingWords = heading.replace(/"/g, '״').replace(/'/g, '׳').split(/\s+/).filter(Boolean);
      const key = normalizeLookupToken(headingWords.join(' '));
      if (!key) continue;
      const plene = (body.match(/\|\s*כתיב מלא\s*=\s*([^|}\n]+)/) || [])[1]?.replace(/\[\[|\]\]/g, '').trim();
      const senses = body.split('\n').filter(raw => /^#(?![:*])/.test(raw)).map(raw => raw.replace(/^#\s*/, ''));
      const hebrewPage = senses.some(text => !text.includes('{{ארמית}}'));
      if (idiomPage && headingWords.length > 1) {
        const first = senses[0] ? cleanWiki(senses[0].replace(/\{\{[^}]*\}\}/g, '')) : '';
        const wordsOf = (plene || heading).split(/\s+/).map(w => normalizeLookupToken(w.replace(/\[\[|\]\]/g, ''))).filter(Boolean);
        if (first && words(first).length <= 5 && HEBREW_ONLY.test(first) && !/\d/.test(first)) out.idioms.push({ words: wordsOf, gloss: first.replace(/[,;]\s*$/, ''), pageTitle: page.title, revid: page.revid });
        continue;
      }
      const abbrExpansions = [];
      for (const raw of senses) {
        let text = raw;
        if (text.includes('{{ארמית}}') || (aramaicCategory && !abbreviationPage)) {
          text = text.replace(/\{\{רובד\|[^}]*\}\}|\{\{חזל\}\}|\{\{ארמית\}\}|\{\{משלב\|ארמית\}\}/g, '').trim();
          if (/\{\{/.test(text)) continue;
          const gloss = cleanWiki(text);
          if (!gloss || words(gloss).length > 4 || !HEBREW_ONLY.test(gloss) || /\d/.test(gloss)) continue;
          out.aramaic.push({ key, gloss: gloss.replace(/[,;]\s*$/, ''), pageTitle: page.title, revid: page.revid, hebrewPage, aramaicPage: aramaicCategory, plene: plene ? normalizeLookupToken(plene) : null });
          continue;
        }
        if (!abbreviationPage || !isAbbreviationKey(key)) continue;
        const label = (text.match(/\{\{(?:משלב\/ר"ת|הקשר\/ר"ת|משלב|הקשר)\|([^}|]+)\}\}/) || [])[1];
        if (label && !JEWISH_LABELS.test(label.trim())) continue;
        text = text.replace(/\{\{(?:משלב\/ר"ת|הקשר\/ר"ת|משלב|הקשר)\|[^}]*\}\}/g, '').trim();
        if (/\{\{/.test(text)) continue;
        const gloss = cleanWiki(text);
        if (!gloss || words(gloss).length > 6 || !HEBREW_ONLY.test(gloss) || /\d|[()]/.test(gloss)) continue;
        abbrExpansions.push(gloss);
      }
      if (abbrExpansions.length) out.abbreviations.push({ key, expansions: [...new Set(abbrExpansions)], pageTitle: page.title, revid: page.revid });
    }
  }
  return out;
}
