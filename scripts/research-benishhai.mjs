// Research helper: scan Ben Ish Hai year-1/2 halachot openings and verify Peninei chapter refs.
const idx = await (await fetch('https://www.sefaria.org/api/v2/raw/index/Ben%20Ish%20Hai')).json();
const en = n => n.titles?.find(t => t.lang === 'en' && t.primary)?.text || n.key;
const years = idx.schema.nodes.filter(n => /Halachot/.test(en(n)));
const jobs = [];
for (const y of years) for (const p of y.nodes) jobs.push(`Ben Ish Hai, ${en(y)}, ${en(p)}`);
const out = [];
for (let i = 0; i < jobs.length; i += 10) {
  await Promise.all(jobs.slice(i, i + 10).map(async ref => {
    const d = await (await fetch('https://www.sefaria.org/api/texts/' + encodeURIComponent(ref) + '?context=0&commentary=0')).json();
    const he = (Array.isArray(d.he) ? d.he.flat() : [d.he]).filter(x => typeof x === 'string');
    out.push({ ref, n: he.length, first: he[0]?.replace(/<[^>]+>/g, '').slice(0, 110) });
  }));
}
out.sort((a, b) => a.ref.localeCompare(b.ref)).forEach(o => console.log(o.ref, '|', o.n, '|', o.first));
const chapters = ['Peninei Halakhah, Prayer 18', 'Peninei Halakhah, Berakhot 10', 'Peninei Halakhah, Kashrut 25', 'Peninei Halakhah, Shabbat 10', "Peninei Halakhah, Women's Prayer 2", 'Peninei Halakhah, Family Purity 5', 'Peninei Halakhah, Prayer 18:1'];
for (const ref of chapters) { const d = await (await fetch('https://www.sefaria.org/api/texts/' + encodeURIComponent(ref) + '?context=0&commentary=0')).json(); console.log('PH', ref, '->', d.ref, d.heLicense, Array.isArray(d.he) ? d.he.length : typeof d.he); }
