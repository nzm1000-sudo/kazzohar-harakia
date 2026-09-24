import { useRef, useState } from 'react';
import { useLocal } from '../hooks.jsx';
import { formatGregorianDate } from '../civilDate.mjs';
import { VERSE_INDEX_SIZE, HDate, findNameVerses, formatGregorian, getVerseById, hebrewFromGregorian, hebrewFromParts, hebrewMonthsForYear, isValidGregorianParts, isValidHebrewParts, loadPersonalProfile, months, nameLetters, parashaForDate, parseGregorian, savePersonalProfile, shareText } from '../services/personalTools.mjs';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import { barMitzvahDate, buildYearNavigationYears, clampDayForMonth, monthLabelForPicker } from '../services/datePickerFastNav.mjs';

import { filterBabyNames, gematria, getBabyName, loadBabyNameFavorites, saveBabyNameFavorites, versesForBabyName } from '../services/babyNames.mjs';

// Local civil "today" (not UTC): after midnight in Israel the UTC date is still yesterday.
const localTodayParts = () => { const now = new Date(); return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }; };
const civilValue = parts => `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
const safeDecode = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };
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
  return <section className="personal-tools"><p className="eyebrow">כלים אישיים</p><h1>כלים אישיים</h1><p className="intro">כלים שקטים לשימוש יומיומי, המבוססים על מקורות ולוחות מאומתים.</p><div className="personal-tool-list">{tools.map(([route, title, description, icon]) => <a className="personal-tool-row" href={`#personal-tools/${route}`} key={route}><span className="personal-tool-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">←</span></a>)}<a className="personal-tool-row" href="#travel"><span className="personal-tool-icon" aria-hidden="true">✈</span><span><strong>מצב נסיעה יהודי</strong><small>זמנים, תפילת הדרך ותוכן לנסיעה</small></span><span aria-hidden="true">←</span></a></div></section>;
}

function DateConverter() {
  const [direction, setDirection] = useState('civil-to-hebrew');
  const [civil, setCivil] = useState(localTodayParts);
  const [hebrew, setHebrew] = useState(() => {
    const today = localTodayParts();
    const current = hebrewFromGregorian(parseGregorian(today.day, today.month, today.year));
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

function SourceAction({ reference, title, openSource, children, primary = false }) {
  if (!reference) return null;
  return <button type="button" className={primary ? 'personal-primary' : 'ghost'} onClick={() => openSource?.(reference, title, 'cantillation')}>{children}</button>;
}

function MyParasha({ settings, openSource }) {
  const dateInputRef = useRef(null);
  const [date, setDate] = useState(() => civilValue(localTodayParts()));
  const [region, setRegion] = useState(settings?.il !== false);
  const [barMitzvah, setBarMitzvah] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const dateParts = date ? date.split('-').map(Number) : [];
  const year = Number(dateParts[0] || new Date().getFullYear());
  const month = Number(dateParts[1] || 1);
  const day = Number(dateParts[2] || 1);
  const dateValid = dateParts.length === 3 && isValidGregorianParts(dateParts[2], dateParts[1], dateParts[0]);
  const calculate = event => { event.preventDefault(); try { const parsed = parseGregorian(...date.split('-').reverse().map(Number)); const relevantDate = barMitzvah ? barMitzvahDate(parsed) : new Date(parsed); const parasha = parashaForDate(relevantDate, region); setResult({ date: parsed, hebrew: hebrewFromGregorian(parsed), barMitzvahDate: relevantDate, parasha }); setError(parasha ? '' : 'לא נמצאה קריאה לתאריך זה'); } catch (conversionError) { setResult(null); setError(conversionError.message); } };
  const openDatePicker = () => { const input = dateInputRef.current; if (!input) return; if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); };
  const onDateInput = next => {
    const normalized = next || civilValue(localTodayParts());
    if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return;
    const [nextYear, nextMonth, nextDay] = normalized.split('-').map(Number);
    const safeDay = clampDayForMonth(nextDay, nextMonth, nextYear);
    setDate(`${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
  };
  const yearOptions = buildYearNavigationYears(year);
  return <section className="personal-tools"><BackLink /><p className="eyebrow">כלים אישיים · הפרשה שלי</p><h1>הפרשה שלי</h1><p className="intro">גלה איזו פרשה קשורה לתאריך שלך. החישוב מבוסס על השבת הרלוונטית, עם הבחנה בין ישראל לחוץ לארץ.</p><div className="personal-switch"><button type="button" className={!barMitzvah ? 'selected' : ''} onClick={() => setBarMitzvah(false)}>פרשת השבוע של התאריך</button><button type="button" className={barMitzvah ? 'selected' : ''} onClick={() => setBarMitzvah(true)}>פרשת בר המצווה</button></div>{barMitzvah && <p className="personal-hint">הזינו את תאריך הלידה כדי לזהות את השבת שלאחר בר המצווה. זהו כלי חישוב ראשוני, ולא פסיקה הלכתית.</p>}<form className="personal-form" onSubmit={calculate}><label className="personal-field"><span>{barMitzvah ? 'תאריך הלידה' : 'תאריך לועזי'}</span><div className="date-picker-field"><button type="button" className="date-display" onClick={openDatePicker} aria-label={`${barMitzvah ? 'תאריך הלידה' : 'תאריך לועזי'}: ${formatGregorianDate(date)}`}><span dir="ltr">{formatGregorianDate(date)}</span></button><input ref={dateInputRef} className="date-picker-native" dir="ltr" type="date" aria-label={barMitzvah ? 'תאריך הלידה' : 'תאריך לועזי'} value={date} onInput={e => onDateInput(e.currentTarget.value)} onChange={e => onDateInput(e.currentTarget.value)} tabIndex={-1} /></div></label>{dateValid && <div className="date-fast-nav" role="toolbar" aria-label="ניווט מהיר לתאריך"><div className="date-fast-nav-row"><label className="personal-field"><span>שנה</span><select value={year} onChange={event => { const nextYear = Number(event.target.value); const safeDay = clampDayForMonth(day, month, nextYear); setDate(`${nextYear}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`); }}>{yearOptions.map(nextYear => <option key={nextYear} value={nextYear}>{nextYear}</option>)}</select></label><label className="personal-field"><span>חודש</span><select value={month} onChange={event => { const nextMonth = Number(event.target.value); const safeDay = clampDayForMonth(day, nextMonth, year); setDate(`${year}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`); }}>{Array.from({ length: 12 }, (_, index) => index + 1).map(nextMonth => <option key={nextMonth} value={nextMonth}>{monthLabelForPicker(year, nextMonth)}</option>)}</select></label></div></div>}<fieldset className="personal-fieldset"><legend>מקום קריאה</legend><label><input type="radio" name="parasha-region" checked={region} onChange={() => setRegion(true)} /> ישראל</label><label><input type="radio" name="parasha-region" checked={!region} onChange={() => setRegion(false)} /> חו״ל</label></fieldset><button className="personal-primary" disabled={!dateValid} type="submit">מצא את הפרשה</button></form>{error && <p className="notice error" role="alert">{error}</p>}{result?.parasha && <section className="personal-result"><p className="eyebrow">{barMitzvah ? 'פרשת בר המצווה' : 'הפרשה שלי'}</p><h2>{result.parasha.sourceRef ? result.parasha.name : 'קריאת השבת'}</h2><p>השבת: {result.parasha.hebrewDate} · {formatGregorianDate(result.parasha.date, 'UTC')}</p>{!result.parasha.sourceRef && <p className="personal-hint">בשבת זו אין פרשת שבוע רגילה; זו קריאת חג.</p>}<p className="personal-meta">{result.hebrew.label} · {region ? 'ישראל' : 'חו״ל'}{barMitzvah ? ` · תאריך בר המצווה: ${formatGregorianDate(result.barMitzvahDate, 'UTC')}` : ''}</p>{result.parasha.specialShabbat && <section className="personal-special"><p className="eyebrow">שבת מיוחדת</p><strong>{result.parasha.specialShabbat.name}</strong>{result.parasha.specialShabbat.maftirRef && <p>מפטיר: {result.parasha.specialShabbat.maftirRef}</p>}{result.parasha.specialShabbat.haftaraRef && <p>הפטרה: {result.parasha.specialShabbat.haftaraRef}</p>}</section>}<div className="personal-actions"><SourceAction reference={result.parasha.sourceRef} title={result.parasha.name} openSource={openSource} primary>פתח את הפרשה</SourceAction><SourceAction reference={result.parasha.specialShabbat?.maftirRef} title="מפטיר" openSource={openSource}>פתח את המפטיר</SourceAction><SourceAction reference={result.parasha.specialShabbat?.haftaraRef} title="הפטרה" openSource={openSource}>פתח את ההפטרה</SourceAction><button type="button" className="ghost" onClick={() => shareText(`הפרשה שלי היא ${result.parasha.name}`)}>שתף</button></div></section>}</section>;
}

function MyVerse({ openSource }) {
  const [profile, setProfile] = useState(loadPersonalProfile);
  const [name, setName] = useState(profile.personalHebrewName || '');
  const [results, setResults] = useState(() => profile.personalHebrewName ? findNameVerses(profile.personalHebrewName) : []);
  const letters = nameLetters(name);
  const selectedVerse = profile.personalVerse?.id ? getVerseById(profile.personalVerse.id) || profile.personalVerse : profile.personalVerse;
  const search = event => { event.preventDefault(); const matches = findNameVerses(name); setResults(matches); const next = { ...profile, personalHebrewName: name }; setProfile(next); savePersonalProfile(next); };
  const selectVerse = verse => { const next = { ...profile, personalHebrewName: name, personalVerse: verse }; setProfile(next); savePersonalProfile(next); };
  const removeVerse = () => { const next = { ...profile, personalHebrewName: name, personalVerse: undefined, showPersonalVerseInSiddur: false }; setProfile(next); savePersonalProfile(next); };
  const setSiddurDisplay = enabled => { const next = { ...profile, showPersonalVerseInSiddur: enabled }; setProfile(next); savePersonalProfile(next); };
  return <section className="personal-tools"><BackLink /><p className="eyebrow">כלים אישיים · הפסוק שלי</p><h1>הפסוק שלי</h1><p className="intro">יש הנוהגים לומר בסיום תפילת העמידה פסוק המתחיל באות הראשונה של שמם ומסתיים באות האחרונה של שמם.</p><form className="personal-form" onSubmit={search}><label className="personal-field verse-name-field"><span>השם העברי שלי</span><span className="verse-name-input-wrap"><input value={name} onChange={e => setName(e.target.value)} autoComplete="off" dir="rtl" />{name && <button type="button" className="verse-name-clear" aria-label="ניקוי השם העברי שלי" onClick={() => { setName(''); setResults([]); }}>✕</button>}</span></label>{letters && <p className="personal-hint">האותיות לחיפוש: {letters.first} · {letters.last}</p>}<button className="personal-primary" type="submit">חיפוש במאגר</button></form>{selectedVerse && <section className="personal-result selected-verse"><p className="eyebrow">הפסוק שלי · נבחר כפסוק שלי</p><p className="verse-text">{selectedVerse.text}</p><strong>{selectedVerse.reference}</strong><div className="personal-actions"><button type="button" className="ghost" onClick={() => openSource?.(selectedVerse.sourceReference, selectedVerse.reference, 'cantillation')}>פתח במקור</button><button type="button" className="ghost" onClick={() => shareText(`הפסוק שלי:\n${selectedVerse.text}\n${selectedVerse.reference}`)}>העתק / שתף</button><button type="button" className="ghost" onClick={removeVerse}>הסר את הפסוק שלי</button></div><label className="personal-check"><input type="checkbox" checked={profile.showPersonalVerseInSiddur === true} onChange={e => setSiddurDisplay(e.target.checked)} /> הצג את הפסוק שלי בסידור</label><p className="personal-hint">הבחירה נשמרת גם כשהפסוק מוסתר מהסידור.</p></section>}{name && results.length === 0 && <p className="notice" role="status">לא נמצא פסוק מתאים במאגר</p>}{results.length > 0 && <section className="verse-results" aria-live="polite"><h2>פסוקים מתאימים לשם שלך</h2><p className="personal-hint">נבדקו {VERSE_INDEX_SIZE.toLocaleString('he-IL')} פסוקים מקומיים מכל התנ״ך, ללא שינוי בטקסט המקור.</p>{results.map(verse => <article className={`verse-result${selectedVerse?.id === verse.id ? ' selected' : ''}`} key={verse.id}><p className="verse-text">{verse.text}</p><strong>{verse.reference}</strong><div className="personal-actions"><button type="button" className="personal-primary" onClick={() => selectVerse(verse)}>{selectedVerse?.id === verse.id ? 'נבחר כפסוק שלי' : 'בחר כפסוק שלי'}</button><button type="button" className="ghost" onClick={() => openSource?.(verse.sourceReference, verse.reference, 'cantillation')}>פתח במקור</button><button type="button" className="ghost" onClick={() => shareText(`${verse.text}\n${verse.reference}`)}>שתף</button></div></article>)}</section>}<details className="personal-note"><summary>פרטי המנהג והמקור</summary><p>הכלי מחפש פסוקים מדויקים במאגר תנ״ך מקומי המבוסס על UXLC 2.5 של Tanach.us. הטקסט ניתן להעתקה ללא הגבלה, והבחירה נשמרת במכשיר בלבד.</p></details></section>;
}

function BabyNames({ route, openSource }) {
  const selectedId = safeDecode(route.split('/')[2]);
  const [gender, setGender] = useState('all');
  const [query, setQuery] = useState('');
  const [firstLetter, setFirstLetter] = useState('');
  const [type, setType] = useState('all');
  const [reduced, setReduced] = useState('');
  const [favorites, setFavorites] = useState(loadBabyNameFavorites);
  const [showVerses, setShowVerses] = useState(false);
  const selected = selectedId ? getBabyName(selectedId) : null;
  const results = filterBabyNames({ gender, query, firstLetter, type: type === 'favorites' ? 'all' : type, reduced, favorites: type === 'favorites' ? favorites : [], favoritesOnly: type === 'favorites' });
  const toggleFavorite = item => setFavorites(previous => {
    const next = previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id];
    return saveBabyNameFavorites(next);
  });
  const openDetails = item => { window.location.hash = `#personal-tools/baby-names/${encodeURIComponent(item.id)}`; setShowVerses(false); };
  const verses = selected ? versesForBabyName(selected.name) : [];
  if (selected) return <BabyNameDetails item={selected} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected)} onBack={() => { window.location.hash = '#personal-tools/baby-names'; setShowVerses(false); }} showVerses={showVerses} setShowVerses={setShowVerses} verses={verses} openSource={openSource} />;
  return <section className="personal-tools baby-names"><BackLink /><p className="eyebrow">כלים אישיים · שמות לתינוקות</p><h1>שמות לתינוקות</h1><p className="intro">מאגר מקומי של שמות עבריים ויהודיים, משמעות, מקורות וגימטריה. הרשומות המוצגות מופרדות ממועמדים שעדיין דורשים בדיקה.</p><div className="seg personal-seg" role="tablist" aria-label="סינון לפי שימוש"><button type="button" className={gender === 'all' ? 'on' : ''} onClick={() => setGender('all')}>כל השמות</button><button type="button" className={gender === 'בנים' ? 'on' : ''} onClick={() => setGender('בנים')}>בנים</button><button type="button" className={gender === 'בנות' ? 'on' : ''} onClick={() => setGender('בנות')}>בנות</button></div><div className="baby-name-controls"><label className="personal-field"><span>חיפוש לפי שם</span><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="הקלידו שם או חלק ממנו" autoComplete="off" /></label><label className="personal-field"><span>אות ראשונה</span><select value={firstLetter} onChange={event => setFirstLetter(event.currentTarget.value)}><option value="">כל האותיות</option>{'אבגדהוזחטיכלמנסעפצקרשת'.split('').map(letter => <option key={letter} value={letter}>{letter}</option>)}</select></label><label className="personal-field"><span>סוג מקור</span><select value={type} onChange={event => setType(event.currentTarget.value)}><option value="all">כל המקורות</option><option value="מקראי">מקראי</option><option value="מסורתי">מסורתי</option><option value="עברי מודרני">עברי מודרני</option><option value="טבע ומקומות">טבע ומקומות</option><option value="favorites">שמות שאהבתי</option></select></label><label className="personal-field"><span>מספר מצומצם</span><select value={reduced} onChange={event => setReduced(event.currentTarget.value)}><option value="">כל המספרים</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => <option key={number} value={number}>{number}</option>)}</select></label></div><p className="personal-hint">{results.length} שמות מוצגים · מיון א–ב · שמות לשניהם מסומנים בגוף הרשומה.</p><div className="baby-name-list" aria-live="polite">{results.map(item => <button className="baby-name-row" type="button" key={item.id} onClick={() => openDetails(item)}><span><strong>{item.name}</strong><small>{item.type} · {item.usage === 'לשניהם' ? 'לשניהם' : item.usage}{item.nikud ? ` · ${item.nikud}` : ''}</small></span><span className="baby-name-number">{gematria(item.name)?.reduced}</span><span aria-hidden="true">←</span></button>)}</div>{results.length === 0 && <p className="notice" role="status">לא נמצאו שמות לפי הסינון הנוכחי.</p>}</section>;
}

function BabyNameDetails({ item, favorite, onFavorite, onBack, showVerses, setShowVerses, verses, openSource }) {
  const number = gematria(item.name);
  return <section className="personal-tools baby-names"><button type="button" className="personal-back baby-back-button" onClick={onBack}>← חזרה לרשימת השמות</button><p className="eyebrow">שמות לתינוקות · פרטי שם</p><section className="baby-name-detail"><div className="baby-name-title"><div><h1>{item.name}</h1>{item.nikud && <p className="baby-nikud">{item.nikud}</p>}</div><span className="baby-name-number large">{number?.reduced}</span></div><p className="baby-name-meaning">{item.meaning}</p><p className="personal-meta">{item.type} · שימוש: {item.usage}</p><div className="baby-gematria"><h2>גימטריה</h2><div><strong>{number?.total}</strong><span>גימטריה מלאה</span></div><div><strong>{number?.reduced}</strong><span>מספר מצומצם</span></div></div><p className="personal-hint">המספר המצומצם הוא חישוב נומרולוגי באמצעות צמצום ספרות הגימטריה, ואינו פסק הלכתי או אבחון אישיות.</p><details className="baby-details"><summary>איך חושב המספר?</summary><p>{number?.breakdown.map(letter => `${letter.letter}=${letter.value}`).join(' + ')} = {number?.total}{number?.total > 9 ? ` · ${String(number.total).split('').join(' + ')} = ${number.reduced}` : ''}</p></details><details className="baby-details"><summary>פרטי מקור</summary><p>{item.source.label} · {item.source.reference}</p><p>{item.source.license}</p><a href={item.source.url} target="_blank" rel="noreferrer">פתיחת המקור</a></details><div className="personal-actions"><button type="button" className={favorite ? 'personal-primary' : 'ghost'} onClick={onFavorite}>{favorite ? 'הסר מהשמות שאהבתי' : 'שמור לשמות שאהבתי'}</button><button type="button" className="ghost" onClick={() => shareText(`${item.name}\n${item.meaning}\nגימטריה מלאה: ${number?.total}\nמספר מצומצם: ${number?.reduced}`)}>שתף את השם</button><button type="button" className="ghost" onClick={() => setShowVerses(value => !value)}>מצא פסוקים לשם הזה</button></div>{showVerses && <section className="baby-verses"><h2>פסוקים לשם המועמד</h2><p className="personal-hint">זהו חיפוש זמני בתנ״ך המקומי. הוא אינו משנה את השם או הפסוק שבפרופיל האישי.</p>{verses.length ? verses.slice(0, 12).map(verse => <article className="verse-result" key={verse.id}><p className="verse-text">{verse.text}</p><strong>{verse.reference}</strong><button type="button" className="link" onClick={() => openSource?.(verse.sourceReference, verse.reference, 'cantillation')}>פתח במקור</button></article>) : <p className="notice">לא נמצא פסוק התואם לאות הראשונה והאחרונה של השם במאגר המקומי.</p>}</section>}</section></section>;
}

function BackLink() { return <a className="personal-back" href="#personal-tools">← כלים אישיים</a>; }
