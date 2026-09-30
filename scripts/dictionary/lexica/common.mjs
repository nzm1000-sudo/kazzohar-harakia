// Shared helpers of the lexicon parsers (build time only).
import { normalizeLookupToken } from '../../../src/services/wordLookup/normalize.mjs';

export const stripTags = html => String(html).replace(/<[^>]*>/g, ' ');
export const tidy = text => String(text).replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
export const words = text => String(text).split(/\s+/).filter(Boolean);
export const MARKS = /[֑-ׇ]/g;
export const unpoint = text => String(text).replace(MARKS, '');
export const HEBREW_ONLY = /^[א-ת֑-ׇ׳״'"\s,\-־?]+$/;
export const keyOf = word => normalizeLookupToken(String(word).replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]/g, '').replace(/\s+(I{1,3}|IV|V|VI|VII)$/, '').trim());
export const lettersKey = word => keyOf(word).replace(/[״׳]/g, '');

// The corpus a citation points to, from a data-ref (Sefaria ref) or the dictionary's own abbreviation.
export function citationCorpus(ref, text = '') {
  const r = String(ref || '');
  const t = String(text || '');
  if (/^(Onkelos|Targum|Aramaic Targum)/.test(r) || /^תרג/.test(t) || /^Targ/.test(t)) return 'targum';
  if (/^Jerusalem Talmud/.test(r) || /^ירוש/.test(t) || /^Y\./.test(t)) return 'yerushalmi';
  if (/^Zohar/.test(r) || /^זהר|^זוהר/.test(t) || /^Zoh/.test(t)) return 'zohar';
  if (/^Mishnah /.test(r) || /פ״[א-ת]+ מ״[א-ת]+/.test(t)) return 'mishnah';
  if (/^(Tosefta)/.test(r) || /^תוס׳/.test(t) || /^Tosef/.test(t)) return 'tosefta';
  if (/Rabbah|Pesikta|Tanchuma|Sifra|Sifrei|Mekhilta|Yalkut|Midrash|Avot D|Pirkei|Tanna Debei|Seder Olam|Lamentations Rabbah/.test(r) || /^(ב״ר|שמו״ר|ויק״ר|במ״ר|דב״ר|איכ״ר|קה״ר|אסת״ר|רות ר|שה״ש ר|פסיק|תנחו|ילק|ספרא|ספרי|מכי|אדר״נ|פדר״א|מד׳ |מדרש)/.test(t) || /\b(R\.|Pesik|Tanḥ|Sifra|Sifré|Mekh|Yalk|Midr)/.test(t)) return 'midrash';
  if (/^[A-Z][A-Za-z' ]+ \d+[ab](:[\d-]+)?$/.test(r) || /ע״[אבגד]/.test(t) || /\d+[ᵃᵇ]/.test(t)) return 'bavli';
  if (/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|I |II |Isaiah|Jeremiah|Ezekiel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Psalms|Proverbs|Job|Song of Songs|Ruth|Lamentations|Ecclesiastes|Esther|Daniel|Ezra|Nehemiah|Chronicles)/.test(r)) return 'tanakh';
  return 'other';
}

// Consonants shared with a root: is `form` (a key) plausibly an inflection of `lemma` (a key)? Every radical of the
// lemma's stem (its letters without a final א/ה/י and without matres ו/י in the middle) must appear in order.
export function sharesRoot(form, lemma) {
  const stem = lemma.replace(/[אהי]$/, '').replace(/(?<=.)[וי](?=.)/g, '');
  if (stem.length < 2) return form.includes(lemma);
  let at = 0;
  for (const letter of stem) { const next = form.indexOf(letter, at); if (next < 0) return false; at = next + 1; }
  return true;
}
