import React, { Component, useState } from 'react';
import { civilDateKey, jewishDateKey } from '../civilDate.mjs';
import { calendarRequestKey, getRequestDiagnostics, zmanimURL } from '../services.mjs';
import { CONTEXT_RULES } from '../services/jewishContextEngine.mjs';
import { todayDisplayPayload } from './TodayPage.jsx';

const BUILD_ID = import.meta.env.VITE_BUILD_ID || '6ba84d4';
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const UNAVAILABLE = 'לא זמין';
const LOADING = 'טוען';

function safeText(value, fallback = UNAVAILABLE) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return typeof value === 'string' ? value : String(value); } catch { return fallback; }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeDate(value) {
  try {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}

function safeJSON(value) {
  try {
    return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? `${item}n` : item, 2) || UNAVAILABLE;
  } catch (error) {
    return `${UNAVAILABLE} (${safeText(error?.message)})`;
  }
}

function localDateTime(value, tzid) {
  const date = safeDate(value);
  if (!date || !tzid) return UNAVAILABLE;
  try {
    return new Intl.DateTimeFormat('he-IL', { timeZone: tzid, dateStyle: 'full', timeStyle: 'medium', hourCycle: 'h23' }).format(date);
  } catch (error) { return `שגיאה: ${safeText(error?.message)}`; }
}

function utcOffset(value, tzid) {
  const date = safeDate(value);
  if (!date || !tzid) return UNAVAILABLE;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tzid, timeZoneName: 'longOffset' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || UNAVAILABLE;
  } catch (error) { return `שגיאה: ${safeText(error?.message)}`; }
}

function eventSummary(event) {
  if (!event || typeof event !== 'object') return null;
  return {
    date: safeText(event.date), category: safeText(event.category), subcat: safeText(event.subcat),
    title: safeText(event.title), hebrew: safeText(event.hebrew), desc: safeText(event.desc), memo: safeText(event.memo),
  };
}

function ruleResult(id, state, context) {
  const rule = CONTEXT_RULES?.[id];
  if (!rule) return { state: safeText(state), ruleId: UNAVAILABLE, source: UNAVAILABLE, reviewStatus: UNAVAILABLE, contextKind: safeText(context?.kind) };
  return {
    state: safeText(state), ruleId: safeText(rule.id), source: safeText(rule.source),
    reviewStatus: safeText(rule.reviewState), nusach: safeText(rule.nusach), scope: safeText(rule.scope), contextKind: safeText(context?.kind),
  };
}

function readSnapshot(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function snapshotSummary(key, currentKey, fields) {
  try {
    const records = readSnapshot(key);
    const entries = Object.entries(records).map(([recordKey, record]) => ({ recordKey, ...(record || {}) }));
    const current = entries.find(entry => entry.recordKey === currentKey);
    const dates = entries.flatMap(entry => safeArray(fields(entry))).filter(Boolean).sort();
    return { exists: entries.length > 0, currentKey: safeText(currentKey), dateRange: dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null, timestamp: safeDate(current?.savedAt)?.toISOString() || null };
  } catch (error) { return { exists: false, currentKey: safeText(currentKey), error: safeText(error?.message) }; }
}

function reportText(data) {
  const lines = [];
  const add = (label, value) => lines.push(`${label}: ${typeof value === 'string' ? value : safeJSON(value)}`);
  add('BUILD', data.build); add('DEVICE / TIME', data.deviceTime); add('LOCATION', data.location);
  add('SUNSET / JEWISH DAY', data.sunsetJewishDay); add('PROFILE', data.profile); add('PRAYER CONTEXT', data.prayerContext);
  add('RULE RESULTS', data.ruleResults); add('TODAY DISPLAY PAYLOAD', data.todayPayload);
  add('CACHE / SNAPSHOT STATUS', data.cache); add('FETCH STATUS', data.fetch); add('שגיאות runtime', data.runtimeErrors);
  return lines.join('\n\n');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
}

class DiagnosticSection extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    this.props.onError?.({ section: this.props.title, message: safeText(error?.message), stack: safeText(error?.stack), componentStack: safeText(info?.componentStack) });
  }
  render() {
    if (this.state.error) return <section><h2>{this.props.title}</h2><p className="notice error">שגיאה באבחון: {safeText(this.state.error.message)}</p></section>;
    return <section><h2>{this.props.title}</h2>{this.props.children}</section>;
  }
}

export default function DebugJewishContextPage({ now, settings, solar, calendarResource, context, hebrew, todayStr }) {
  const [copied, setCopied] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const safeSettings = settings || {};
  const location = safeSettings.location || {};
  const safeSolar = solar || {};
  const safeCalendar = calendarResource || {};
  const safeContext = context || {};
  const tzid = location.tzid || null;
  const sunset = safeDate(safeSolar.data?.sunset);
  const diagnostics = (() => { try { return getRequestDiagnostics() || {}; } catch (error) { return { error: safeText(error?.message) }; } })();
  const safeToday = safeText(todayStr);
  const calendarEnd = safeDate(`${safeToday}T00:00:00Z`);
  calendarEnd?.setUTCDate(calendarEnd.getUTCDate() + 40);
  const calendarRequest = (() => { try { return calendarEnd ? calendarRequestKey(safeToday, calendarEnd.toISOString().slice(0, 10), safeSettings) : UNAVAILABLE; } catch { return UNAVAILABLE; } })();
  const todayPayload = (() => { try { return todayDisplayPayload({ now, tz: tzid || 'UTC', hebrew, events: safeArray(safeContext.events), context: safeContext }); } catch (error) { return { error: safeText(error?.message) }; } })();
  const resourceErrors = [diagnostics.error, safeCalendar.error, safeSolar.error].filter(Boolean).map(message => ({ section: 'resource', message: safeText(message), stack: UNAVAILABLE }));
  const data = {
    build: { id: BUILD_ID, version: APP_VERSION, timestamp: BUILD_TIMESTAMP },
    deviceTime: { nowISO: safeDate(now)?.toISOString() || UNAVAILABLE, local: localDateTime(now, tzid), tzid: safeText(tzid), utcOffset: utcOffset(now, tzid) },
    location: { label: safeText(location.name), latitude: location.latitude ?? UNAVAILABLE, longitude: location.longitude ?? UNAVAILABLE, source: safeText(location.source, 'stored settings; source not recorded') },
    sunsetJewishDay: {
      sunsetISO: sunset?.toISOString() || UNAVAILABLE, sunsetLocal: sunset ? localDateTime(sunset, tzid) : (safeSolar.loading ? LOADING : UNAVAILABLE),
      nowBeforeSunset: sunset ? now < sunset : UNAVAILABLE, nowAfterSunset: sunset ? now >= sunset : UNAVAILABLE,
      civilDateKey: (() => { try { return tzid ? civilDateKey(now, tzid) : UNAVAILABLE; } catch { return UNAVAILABLE; } })(),
      jewishDateKey: (() => { try { return jewishDateKey(now, sunset, tzid) || UNAVAILABLE; } catch { return UNAVAILABLE; } })(),
      hebrewDate: safeContext.hebrewDate || UNAVAILABLE,
    },
    profile: { nusach: safeText(safeContext.profile?.nusach), halachicResidenceStatus: safeText(safeContext.profile?.halachicResidenceStatus), calendarMode: safeContext.isIsrael === true ? 'israel' : safeContext.isIsrael === false ? 'diaspora' : UNAVAILABLE },
    prayerContext: {
      prayerType: safeText(safeContext.prayerContext?.type), specialDay: eventSummary(safeContext.specialDay), currentEvents: safeArray(safeContext.events).map(eventSummary),
      weeklyParasha: eventSummary(safeContext.parasha), specialShabbat: eventSummary(safeContext.torahReading?.special),
      torahReading: safeText(safeContext.torahReading?.sourceRef), maftir: safeText(safeContext.torahReading?.maftir), haftara: safeText(safeContext.torahReading?.haftara),
    },
    ruleResults: {
      tachanun: ruleResult('tachanun', safeContext.omitTachanun === true ? 'omitted' : safeContext.omitTachanun === false ? 'said' : UNAVAILABLE, safeArray(safeContext.omissions).find(item => item.kind === 'tachanun')),
      hallel: ruleResult('hallel', safeText(safeContext.hallel), safeArray(safeContext.additions).find(item => item.kind === 'hallel')),
      alHanissim: ruleResult('alHanissim', safeArray(safeContext.additions).some(item => item.kind === 'al-hanissim'), safeArray(safeContext.additions).find(item => item.kind === 'al-hanissim')),
      mashivHaruch: ruleResult('mashivHaruch', safeContext.seasonal?.mashivHaruch ?? UNAVAILABLE, safeArray(safeContext.additions).find(item => item.kind === 'mashiv-haruach')),
      moridHatal: { state: 'not modeled' },
      vetenTalUmatar: ruleResult('vetenTalUmatar', safeContext.seasonal?.vetenTalUmatar ?? UNAVAILABLE, safeArray(safeContext.additions).find(item => item.kind === 'veten-tal-umatar')),
      aneinu: { state: 'not modeled' }, nachem: { state: 'not modeled' },
    },
    todayPayload,
    cache: {
      settings: { exists: (() => { try { return Boolean(localStorage.getItem('companion-settings-v2')); } catch { return false; } })(), relevant: { tzid: safeText(tzid), location: safeText(location.name), latitude: location.latitude ?? UNAVAILABLE, longitude: location.longitude ?? UNAVAILABLE, nusach: safeText(safeSettings.nusach), halachicResidenceStatus: safeText(safeSettings.halachicResidenceStatus), il: safeSettings.il ?? UNAVAILABLE } },
      calendarSnapshot: snapshotSummary('kz-calendar-snapshot-v1', calendarRequest, entry => entry.recordKey ? [entry.recordKey.split('|')[0], entry.recordKey.split('|')[1]] : []),
      zmanimSnapshot: snapshotSummary('kz-zmanim-snapshot-v1', `${safeToday}|${location.latitude}|${location.longitude}|${tzid}`, entry => entry.recordKey ? [entry.recordKey.split('|')[0]] : []),
      inMemoryCalendarCacheKey: diagnostics.calendar?.key || UNAVAILABLE,
      note: 'Today receives live resource state; snapshot use is reported by fetch diagnostics.',
    },
    fetch: {
      calendar: { url: diagnostics.calendar?.url || UNAVAILABLE, status: safeCalendar.loading ? LOADING : safeCalendar.error ? 'error' : diagnostics.calendar?.status || 'success', liveVsSnapshot: diagnostics.calendar?.source || UNAVAILABLE, lastSuccess: diagnostics.calendar?.lastSuccess || UNAVAILABLE, error: safeCalendar.error || diagnostics.calendar?.error || null },
      zmanim: { url: diagnostics.zmanim?.url || (() => { try { return zmanimURL(safeToday, safeSettings); } catch { return UNAVAILABLE; } })(), status: safeSolar.loading ? LOADING : safeSolar.error ? 'error' : diagnostics.zmanim?.status || 'success', liveVsSnapshot: diagnostics.zmanim?.source || UNAVAILABLE, lastSuccess: diagnostics.zmanim?.lastSuccess || UNAVAILABLE, error: safeSolar.error || diagnostics.zmanim?.error || null },
    },
    runtimeErrors: [...resourceErrors, ...runtimeErrors],
  };
  const report = reportText(data);
  const copy = async () => {
    try { await copyText(report); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (error) { setRuntimeErrors(previous => [...previous, { section: 'clipboard', message: safeText(error?.message), stack: safeText(error?.stack) }]); }
  };
  const capture = error => setRuntimeErrors(previous => [...previous, error]);
  return <section className="about-page debug-page">
    <p className="notice error">מסך אבחון זמני — לא לשימוש רגיל</p>
    <p className="eyebrow">אודות · אבחון הקשר יהודי</p>
    <h1>אבחון runtime</h1>
    <p className="intro">הנתונים כאן הם אותם אובייקטים שהועברו ל-Today ברינדור הנוכחי.</p>
    <button type="button" className="personal-primary" onClick={copy}>העתק אבחון</button>
    {copied && <p role="status">האבחון הועתק</p>}
    <DiagnosticSection title="BUILD / DEVICE / LOCATION" onError={capture}><pre dir="ltr" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textAlign: 'left', fontSize: 12, lineHeight: 1.45 }}>{report}</pre></DiagnosticSection>
    <DiagnosticSection title="שגיאות runtime" onError={capture}><pre dir="ltr" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textAlign: 'left', fontSize: 12, lineHeight: 1.45 }}>{safeJSON(data.runtimeErrors)}</pre></DiagnosticSection>
  </section>;
}
