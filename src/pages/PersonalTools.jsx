import { useState } from 'react';
import { useLocal } from '../hooks.jsx';
import { VERSE_INDEX_SIZE, findNameVerses, formatGregorian, hebrewFromGregorian, hebrewFromParts, hebrewMonthsForYear, isValidGregorianParts, isValidHebrewParts, loadPersonalProfile, nameLetters, parashaForDate, parseGregorian, savePersonalProfile, shareText } from '../services/personalTools.mjs';

import { filterBabyNames, gematria, getBabyName, loadBabyNameFavorites, saveBabyNameFavorites, versesForBabyName } from '../services/babyNames.mjs';

const today = new Date();
const todayParts = { day: today.getUTCDate(), month: today.getUTCMonth() + 1, year: today.getUTCFullYear() };
const civilValue = parts => `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
const field = (label, value, onChange, props = {}) => <label className="personal-field"><span>{label}</span><input {...props} value={value} onInput={e => onChange(e.currentTarget.value)} onChange={e => onChange(e.currentTarget.value)} /></label>;

export default function PersonalTools({ route = 'personal-tools', settings, openSource }) {
  const section = route.split('/')[1] || 'home';
  if (section === 'date-converter') return <DateConverter settings={settings} />;
  if (section === 'parasha') return <MyParasha settings={settings} openSource={openSource} />;
  if (section === 'verse') return <MyVerse openSource={openSource} />;
  if (section === 'baby-names') return <BabyNames route={route} openSource={openSource} />;
  return <PersonalToolsHome />;
}

function PersonalToolsHome() {
  const tools = [
    ['parasha', 'הפרשה שלי', 'גלה איזו פרשה קשורה לתאריך שלך', '◈'],
    ['date-converter', 'ממיר תאריכים', 'המרה בין תאריך עברי ללועזי', '▦'],
    ['verse', 'הפסוק שלי', 'מצא פסוק בתנ״ך לפי שמך', 'א'],
    ['baby-names', 'שמות לתינוקות', 'שמות עבריים ויהודיים, משמעות, מקורות וגימטריה', 'ש'],
  ];
  return <section className="personal-tools"><p className="eyebrow">כלים אישיים</p><h1>כלים אישיים</h1><p className="intro">כלים שקטים לשימוש יומיומי, המבוססים על מקורות ולוחות מאומתים.</p><div className="personal-tool-list">{tools.map(([route, title, description, icon]) => <a className="personal-tool-row" href={`#personal-tools/${route}`} key={route}><span className="personal-tool-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">←</span></a>)}</div></section>;
}

function DateConverter() {
  const [direction, setDirection] = useState('civil-to-hebrew');
  const [civil, setCivil] = useState(todayParts);
  const [hebrew, setHebrew] = useState(() => {
    const current = hebrewFromGregorian(parseGregorian(todayParts.day, todayParts.month, todayParts.year));
    return { day: current.day, month: current.month, year: current.year };
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const updateCivil = (key, value) => setCivil(previous => ({ ...previous, [key]: value }));
  const updateHebrew = (key, value) => setHebrew(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'year') {
      const available = hebrewMonthsForYear(value);
      if (!available.some(([month]) => month === Number(next.month))) next.month = available[0][0];
    }
    return next;
  });
  const civilValid = isValidGregorianParts(civil.day, civil.month, civil.year);
  const hebrewValid = isValidHebrewParts(hebrew.day, hebrew.month, hebrew.year);
  const formValid = direction === 'civil-to-hebrew' ? civilValid : hebrewValid;
  const convert = event => {
    event.preventDefault(); setError('');
    if (!formValid) { setResult(null); setError('יש להשלים יום, חודש ושנה'); return; }
    try {
      const converted = direction === 'civil-to-hebrew' ? hebrewFromGregorian(parseGregorian(civil.day, civil.month, civil.year)) : hebrewFromParts(hebrew.day, hebrew.month, hebrew.year);
      setResult({ ...converted, direction });
    } catch (conversionError) { setResult(null); setError(conversionError.message); }
  };
  const reverse = () => {
    if (!result) return;
    if (direction === 'civil-to-hebrew') setHebrew({ day: result.day, month: result.month, year: result.year });
    else setCivil({ day: result.date.getUTCDate(), month: result.date.getUTCMonth() + 1, year: result.date.getUTCFullYear() });
    setDirection(direction === 'civil-to-hebrew' ? 'hebrew-to-civil' : 'civil-to-hebrew'); setError('');
  };
  const monthsForYear = hebrewMonthsForYear(hebrew.year);
  return <section className="personal-tools"><BackLink /><p className="eyebrow">כלים אישיים · ממיר תאריכים</p><h1>ממיר תאריכים</h1><div className="seg personal-seg" role="tablist" aria-label="כיוון המרה"><button type="button" className={direction === 'civil-to-hebrew' ? 'on' : ''} role="tab" aria-selected={direction === 'civil-to-hebrew'} onClick={() => setDirection('civil-to-hebrew')}>לועזי לעברי</button><button type="button" className={direction === 'hebrew-to-civil' ? 'on' : ''} role="tab" aria-selected={direction === 'hebrew-to-civil'} onClick={() => setDirection('hebrew-to-civil')}>עברי ללועזי</button></div><form className="personal-form" onSubmit={convert}>{direction === 'civil-to-hebrew' ? <div className="date-fields">{field('יום', civil.day, value => updateCivil('day', value), { inputMode: 'numeric', min: 1, max: 31, type: 'number' })}{field('חודש', civil.month, value => updateCivil('month', value), { inputMode: 'numeric', min: 1, max: 12, type: 'number' })}{field('שנה', civil.year, value => updateCivil('year', value), { inputMode: 'numeric', min: 1, max: 9999, type: 'number' })}</div> : <div className="date-fields">{field('יום עברי', hebrew.day, value => updateHebrew('day', value), { inputMode: 'numeric', min: 1, max: 30, type: 'number' })}<label className="personal-field"><span>חודש עברי</span><select value={monthsForYear.some(([value]) => value === Number(hebrew.month)) ? hebrew.month : monthsForYear[0][0]} onChange={e => updateHebrew('month', e.target.value)}>{monthsForYear.map(([value, label]) => <option value={value} key={`${value}-${label}`}>{label}</option>)}</select></label>{field('שנה עברית', hebrew.year, value => updateHebrew('year', value), { inputMode: 'numeric', min: 1, max: 9999, type: 'number' })}</div>}<p className="personal-hint">התאריך העברי מתחלף בשקיעה. המרה זו מתייחסת ליום האזרחי, ללא קביעת שקיעה.</p><button className="personal-primary" disabled={!formValid} type="submit">המרה</button></form>{error && <p className="notice error" role="alert">{error}</p>}{result && <section className="personal-result" aria-live="polite"><p className="eyebrow">תוצאה</p><h2>{result.direction === 'civil-to-hebrew' ? result.label : formatGregorian(result.date)}</h2><p>{result.direction === 'civil-to-hebrew' ? `${formatGregorian(result.date)} · ${new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(result.date)}` : `${result.label} · ${new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(result.date)}`}</p><div className="personal-actions"><button type="button" className="ghost" onClick={reverse}>הפוך כיוון</button><button type="button" className="ghost" onClick={() => shareText(`${result.label}\n${formatGregorian(result.date)}`)}>העתק / שתף</button></div></section>}</section>;
}

function MyParasha({ settings, openSource }) {
  const [date, setDate] = useState(civilValue(todayParts));
  const [region, setRegion] = useState(settings?.il !== false);
  const [barMitzvah, setBarMitzvah] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const dateParts = date ? date.split('-').map(Number) : [];
  const dateValid = dateParts.length === 3 && isValidGregorianParts(dateParts[2], dateParts[1], dateParts[0]);
  const calculate = event => { event.preventDefault(); try { const parsed = parseGregorian(...date.split('-').reverse()); const relevantDate = new Date(parsed); if (barMitzvah) relevantDate.setUTCFullYear(relevantDate.getUTCFullYear() + 13); setResult({ date: parsed, hebrew: hebrewFromGregorian(parsed), barMitzvahDate: relevantDate, parasha: parashaForDate(relevantDate, region) }); setError(''); } catch (conversionError) { setError(conversionError.message); } };
  return <section className="personal-tools"><BackLink /><p className="eyebrow">כלים אישיים · הפרשה שלי</p><h1>הפרשה שלי</h1><p className="intro">גלה איזו פרשה קשורה לתאריך שלך. החישוב מבוסס על השבת הרלוונטית, עם הבחנה בין ישראל לחוץ לארץ.</p><div className="personal-switch"><button type="button" className={!barMitzvah ? 'selected' : ''} onClick={() => setBarMitzvah(false)}>פרשת השבוע של התאריך</button><button type="button" className={barMitzvah ? 'selected' : ''} onClick={() => setBarMitzvah(true)}>פרשת בר המצווה</button></div>{barMitzvah && <p className="personal-hint">הזינו את תאריך הלידה כדי לזהות את השבת שלאחר בר המצווה. זהו כלי חישוב ראשוני, ולא פסיקה הלכתית.</p>}<form className="personal-form" onSubmit={calculate}><label className="personal-field"><span>{barMitzvah ? 'תאריך הלידה' : 'תאריך לועזי'}</span><input dir="ltr" type="date" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.currentTarget.value)} /></label><fieldset className="personal-fieldset"><legend>מקום קריאה</legend><label><input type="radio" checked={region} onChange={() => setRegion(true)} /> ישראל</label><label><input type="radio" checked={!region} onChange={() => setRegion(false)} /> חו״ל</label></fieldset><button className="personal-primary" disabled={!dateValid} type="submit">מצא את הפרשה</button></form>{error && <p className="notice error" role="alert">{error}</p>}{result?.parasha && <section className="personal-result"><p className="eyebrow">{barMitzvah ? 'פרשת בר המצווה' : 'הפרשה שלי'}</p><h2>{result.parasha.name}</h2><p>השבת: {result.parasha.hebrewDate} · {formatGregorian(result.parasha.date, settings?.location?.tzid)}</p><p className="personal-meta">{result.hebrew.label} · {region ? 'ישראל' : 'חו״ל'}{barMitzvah ? ` · תאריך בר המצווה: ${formatGregorian(result.barMitzvahDate, settings?.location?.tzid)}` : ''}</p><div className="personal-actions"><button type="button" className="personal-primary" onClick={() => openSource?.(`Parashat ${result.parasha.source?.[0] || result.parasha.name}`, result.parasha.name, 'cantillation')}>פתח את הפרשה</button><button type="button" className="ghost" onClick={() => shareText(`הפרשה שלי היא ${result.parasha.name}`)}>שתף</button></div></section>}</section>;
}

function MyVerse({ openSource }) {
  const [profile, setProfile] = useState(loadPersonalProfile);
  const [name, setName] = useState(profile.personalHebrewName || '');
  const [results, setResults] = useState(() => profile.personalHebrewName ? findNameVerses(profile.personalHebrewName) : []);
  const letters = nameLetters(name);
  const search = event => { event.preventDefault(); const matches = findNameVerses(name); setResults(matches); const next = { ...profile, personalHebrewName: name }; setProfile(next); savePersonalProfile(next); };
  const selectVerse = verse => { const next = { ...profile, personalHebrewName: name, personalVerse: verse }; setProfile(next); savePersonalProfile(next); };
  const removeVerse = () => { const next = { ...profile, personalHebrewName: name, personalVerse: undefined, showPersonalVerseInSiddur: false }; setProfile(next); savePersonalProfile(next); };
  const setSiddurDisplay = enabled => { const next = { ...profile, showPersonalVerseInSiddur: enabled }; setProfile(next); savePersonalProfile(next); };
  return <section className="personal-tools"><BackLink /><p className="eyebrow">כלים אישיים · הפסוק שלי</p><h1>הפסוק שלי</h1><p className="intro">יש הנוהגים לומר בסיום תפילת העמידה פסוק המתחיל באות הראשונה של שמם ומסתיים באות האחרונה של שמם.</p><form className="personal-form" onSubmit={search}>{field('השם העברי שלי', name, setName, { autoComplete: 'off', dir: 'rtl' })}{letters && <p className="personal-hint">האותיות לחיפוש: {letters.first} · {letters.last}</p>}<button className="personal-primary" type="submit">חיפוש במאגר</button></form>{profile.personalVerse && <section className="personal-result selected-verse"><p className="eyebrow">הפסוק שלי · נבחר כפסוק שלי</p><p className="verse-text">{profile.personalVerse.text}</p><strong>{profile.personalVerse.reference}</strong><div className="personal-actions"><button type="button" className="ghost" onClick={() => openSource?.(profile.personalVerse.sourceReference, profile.personalVerse.reference, 'cantillation')}>פתח במקור</button><button type="button" className="ghost" onClick={() => shareText(`הפסוק שלי:\n${profile.personalVerse.text}\n${profile.personalVerse.reference}`)}>העתק / שתף</button><button type="button" className="ghost" onClick={removeVerse}>הסר את הפסוק שלי</button></div><label className="personal-check"><input type="checkbox" checked={profile.showPersonalVerseInSiddur === true} onChange={e => setSiddurDisplay(e.target.checked)} /> הצג את הפסוק שלי בסידור</label><p className="personal-hint">הבחירה נשמרת גם כשהפסוק מוסתר מהסידור.</p></section>}{name && results.length === 0 && <p className="notice" role="status">לא נמצא פסוק מתאים במאגר</p>}{results.length > 0 && <section className="verse-results" aria-live="polite"><h2>פסוקים מתאימים לשם שלך</h2><p className="personal-hint">נבדקו {VERSE_INDEX_SIZE.toLocaleString('he-IL')} פסוקים מקומיים מכל התנ״ך, ללא שינוי בטקסט המקור.</p>{results.map(verse => <article className={`verse-result${profile.personalVerse?.id === verse.id ? ' selected' : ''}`} key={verse.id}><p className="verse-text">{verse.text}</p><strong>{verse.reference}</strong><div className="personal-actions"><button type="button" className="personal-primary" onClick={() => selectVerse(verse)}>{profile.personalVerse?.id === verse.id ? 'נבחר כפסוק שלי' : 'בחר כפסוק שלי'}</button><button type="button" className="ghost" onClick={() => openSource?.(verse.sourceReference, verse.reference, 'cantillation')}>פתח במקור</button><button type="button" className="ghost" onClick={() => shareText(`${verse.text}\n${verse.reference}`)}>שתף</button></div></article>)}</section>}<details className="personal-note"><summary>פרטי המנהג והמקור</summary><p>הכלי מחפש פסוקים מדויקים במאגר תנ״ך מקומי המבוסס על UXLC 2.5 של Tanach.us. הטקסט ניתן להעתקה ללא הגבלה, והבחירה נשמרת במכשיר בלבד.</p></details></section>;
}

function BackLink() { return <a className="personal-back" href="#personal-tools">← כלים אישיים</a>; }
