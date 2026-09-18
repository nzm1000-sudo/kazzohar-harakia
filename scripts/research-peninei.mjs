// Research helper: prints Peninei Halakhah chapter structure from Sefaria for question mapping.
const titles = ['Peninei Halakhah, Berakhot', 'Peninei Halakhah, Shabbat', 'Peninei Halakhah, Prayer', "Peninei Halakhah, Women's Prayer", 'Peninei Halakhah, Kashrut', 'Peninei Halakhah, Family Purity', 'Peninei Halakhah, Zemanim', 'Peninei Halakhah, Likkutim II', 'Peninei Halakhah, Likkutim I', 'Peninei Halakhah, Festivals', 'Peninei Halakhah, Pesach', 'Peninei Halakhah, Sukkot'];
for (const t of titles) {
  try {
    const d = await (await fetch('https://www.sefaria.org/api/v2/raw/index/' + encodeURIComponent(t))).json();
    if (d.error) { console.log(t, 'ERR', d.error); continue; }
    const alts = d.alt_structs?.Chapters?.nodes || d.alt_structs?.Topic?.nodes || [];
    const nodes = d.schema?.nodes || [];
    console.log('\n##', t, '| alts:', alts.length, '| nodes:', nodes.length);
    const list = alts.length ? alts : nodes;
    list.forEach((n, i) => console.log(i + 1, (n.titles || []).find(x => x.lang === 'he' && x.primary)?.text || n.key, '|', n.wholeRef || ''));
  } catch (e) { console.log(t, 'ERR', e.message); }
}
