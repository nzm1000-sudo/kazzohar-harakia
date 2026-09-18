// Probe Sefaria behaviours needed for segment-precise halacha and the Talmud reader.
const get = async p => (await fetch('https://www.sefaria.org/api' + p)).json();
const brief = (label, d) => console.log(label, JSON.stringify(d).slice(0, 700));

// 1. Rice: segment vs section
const rice = await get('/texts/' + encodeURIComponent('Shulchan Arukh, Orach Chayim 208:7') + '?context=0&commentary=0');
brief('RICE 208:7', { ref: rice.ref, sections: rice.sections, he: rice.he, next: rice.next, prev: rice.prev, sectionRef: rice.sectionRef, license: rice.heLicense });
const riceCtx = await get('/texts/' + encodeURIComponent('Shulchan Arukh, Orach Chayim 208:7') + '?context=1&commentary=0');
brief('RICE ctx=1', { ref: riceCtx.ref, sections: riceCtx.sections, toSections: riceCtx.toSections, n: Array.isArray(riceCtx.he) ? riceCtx.he.length : typeof riceCtx.he });

// 2. Talmud base + versions
const ver = await get('/texts/versions/Berakhot');
console.log('BERAKHOT VERSIONS', ver.map(v => `${v.language}|${v.versionTitle}|${v.license}`).join('\n  '));
const sver = await get('/texts/versions/' + encodeURIComponent('Steinsaltz on Berakhot'));
console.log('STEINSALTZ VERSIONS', sver.map(v => `${v.language}|${v.versionTitle}|${v.license}`).join('\n  '));
const base = await get('/texts/Berakhot.2a?context=0&commentary=0');
brief('BASE 2a', { ref: base.ref, n: base.he.length, heVersion: base.heVersionTitle, license: base.heLicense, next: base.next, prev: base.prev, first: base.he[0]?.slice(0, 120) });
const st = await get('/texts/' + encodeURIComponent('Steinsaltz on Berakhot 2a') + '?context=0&commentary=0');
brief('STEINSALTZ 2a', { ref: st.ref, n: st.he.length, heVersion: st.heVersionTitle, license: st.heLicense, first: st.he[0]?.slice(0, 200) });
// v3
const v3 = await get('/v3/texts/' + encodeURIComponent('Steinsaltz on Berakhot 2a') + '?version=hebrew');
brief('V3 STEINSALTZ', { ref: v3.ref, versions: v3.versions?.map(v => ({ t: v.versionTitle, lang: v.actualLanguage, license: v.license, n: Array.isArray(v.text) ? v.text.length : typeof v.text })) });

// 3. Links for a segment
const links = await get('/links/' + encodeURIComponent('Berakhot 2a:1'));
console.log('LINKS 2a:1 count', links.length, 'sample', links.filter(l => /Rashi|Tosafot|Steinsaltz/.test(l.ref)).slice(0, 6).map(l => `${l.ref} | ${l.anchorRef} | ${l.category} | ${l.collectiveTitle?.he}`));
const rashi = await get('/texts/' + encodeURIComponent('Rashi on Berakhot 2a') + '?context=0&commentary=0');
brief('RASHI 2a shape', { ref: rashi.ref, depth: rashi.textDepth, n: Array.isArray(rashi.he) ? rashi.he.length : typeof rashi.he, inner: Array.isArray(rashi.he?.[0]) ? rashi.he[0].length : 'str', license: rashi.heLicense });

// 4. Shape for Talmud
const shape = await get('/shape/Talmud/Bavli');
console.log('SHAPE Bavli', Array.isArray(shape) ? shape.length : Object.keys(shape), JSON.stringify(shape).slice(0, 500));
const shapeB = await get('/shape/Berakhot');
brief('SHAPE Berakhot', shapeB);
// Steinsaltz catalog
const idx = await get('/index');
const talmud = idx.find(c => c.category === 'Talmud');
const bavli = talmud?.contents?.find(c => c.category === 'Bavli');
console.log('BAVLI CATEGORIES', bavli?.contents?.map(c => c.category || c.title).join(' | '));
const modern = bavli?.contents?.find(c => c.category === 'Modern Commentary on Talmud');
const stein = modern?.contents?.find(c => c.category === 'Steinsaltz');
console.log('STEINSALTZ INDEXES', stein?.contents?.length, stein?.contents?.slice(0, 5).map(c => c.title));
