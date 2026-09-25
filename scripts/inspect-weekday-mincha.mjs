// Import-time inspection only: prints each Weekday Mincha segment's markup structure.
import siddurOffline from '../src/data/siddurOffline.mjs';

const SECTIONS = ['Offerings', 'Amida', 'Vidui', 'Alenu'];
const strip = s => s.replace(/<[^>]+>/g, '').replace(/[\u0591-\u05C7]/g, '').replace(/\s+/g, ' ').trim();
const short = s => (s.length > 70 ? `${s.slice(0, 45)} … ${s.slice(-20)}` : s);

for (const section of SECTIONS) {
  const he = siddurOffline.texts[`Siddur Edot HaMizrach, Weekday Mincha, ${section}`].he;
  console.log(`\n=== ${section} (${he.length}) ===`);
  he.forEach((markup, index) => {
    const pieces = [];
    const token = /<\/?(small|big)\b[^>]*>|<br\s*\/?>/gi;
    let depth = 0; let last = 0; let match;
    while ((match = token.exec(markup))) {
      const text = strip(markup.slice(last, match.index));
      if (text) pieces.push(`${depth ? `s${depth}` : 'r'}[${last}]:${short(text)}`);
      if (/^<br/i.test(match[0])) pieces.push('|br');
      else if (/^<\//.test(match[0])) depth = Math.max(0, depth - (/small/i.test(match[0]) ? 1 : 0));
      else if (/small/i.test(match[0])) depth += 1;
      else pieces.push('BIG');
      last = token.lastIndex;
    }
    const tail = strip(markup.slice(last));
    if (tail) pieces.push(`${depth ? `s${depth}` : 'r'}[${last}]:${short(tail)}`);
    console.log(`${index} len=${markup.length} ${pieces.join('  ')}`);
  });
}
