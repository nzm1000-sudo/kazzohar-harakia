import { DIASPORA_SOURCES, YOM_TOV_RULES, diasporaStatus } from '../services/diasporaMode.mjs';

// מצב חו״ל: where the user is and what it means for the second day of Yom Tov, with the rule (לפי מרן / לפי המיקום)
// and its sources. Shown in travel mode and in the halachic profile; never on Today. Styles: styles/daily-share-travel.css.
export default function DiasporaIndicator({ settings, setSettings, compact = false }) {
  const status = diasporaStatus(settings);
  const tone = status.abroad ? 'is-abroad' : status.here === true ? 'is-home' : 'is-unknown';
  const setRule = rule => setSettings?.(s => ({ ...s, yomTovRule: rule }));
  return <section className={`diaspora-indicator ${tone}${compact ? ' is-compact' : ''}`} aria-label="מצב חו״ל ויום טוב שני">
    <p className="diaspora-headline" role="status"><span className="diaspora-dot" aria-hidden="true" />{status.headline}</p>
    {status.place && <p className="diaspora-place">מיקום פעיל: <bdi>{status.place}</bdi>{status.zone ? ` · ${status.zone}` : ''}</p>}
    <p className="diaspora-detail">{status.detail}</p>
    {setSettings && <fieldset className="diaspora-rule">
      <legend>יום טוב שני נקבע</legend>
      <div className="seg personal-seg">
        <button type="button" className={status.rule === YOM_TOV_RULES.MARAN ? 'on' : ''} aria-pressed={status.rule === YOM_TOV_RULES.MARAN} onClick={() => setRule(YOM_TOV_RULES.MARAN)}>לפי מקום המגורים (מרן)</button>
        <button type="button" className={status.rule === YOM_TOV_RULES.LOCATION ? 'on' : ''} aria-pressed={status.rule === YOM_TOV_RULES.LOCATION} onClick={() => setRule(YOM_TOV_RULES.LOCATION)}>לפי המיקום הנוכחי</button>
      </div>
    </fieldset>}
    <details className="diaspora-sources"><summary>המקורות</summary><ul>{DIASPORA_SOURCES.map(source => <li key={source.id}><strong>{source.url ? <a className="link" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : source.label}</strong><small>{source.note}</small></li>)}</ul><p>שאלה למעשה (כגון מי שעקר דירתו, או שהייה ממושכת) — לשאול רב.</p></details>
  </section>;
}
