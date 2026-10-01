import { useState } from 'react';
import { timeLabel } from '../services.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import { activePreparation } from '../services/preparationPlan.mjs';
import { ShabbatPrepCard } from './PreparationHub.jsx';
import { BackLink } from '../components/LocalNavigation.jsx';
import { weeklyDivreiTorah } from '../services/weeklyDivreiTorah.mjs';
import { useWeeklyTorah } from '../components/torah/useTorah.js';
import { articleKindLine } from '../services/torahContent.mjs';
import { getJewishDateKey } from '../services/mitzvotJournal.mjs';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import TanakhRefText from '../components/TanakhRefText.jsx';
import { rabbenuTamAfterSunset } from '../services/zmanimLocal.mjs';

export default function ShabbatPage({ now, settings, items, context }) {
  const [wall, setWall] = useState(false);
  const tz = settings?.location?.tzid || 'UTC';
  const plan = activePreparation({ now, tz, items });
  // Rabbenu Tam for the end of this Shabbat / Yom Tov (sunset + 72), computed for the saved location.
  const rabbenuTam = plan.havdalah && settings?.location ? rabbenuTamAfterSunset(String(plan.havdalah).slice(0, 10), settings.location) : null;
  const shabbatItem = context?.shabbatReading || context?.parasha || context?.upcomingShabbat || null;
  const parashaName = shabbatItem?.hebrew || shabbatItem?.title || null;
  const weekParasha = context?.parasha?.hebrew || context?.parasha?.title || parashaName;
  // The week's three from the Torah content engine (the archive, or the app's own divrei torah where it has none).
  const torah = useWeeklyTorah({ items, todayKey: getJewishDateKey(now, tz), parashaName: weekParasha });
  const legacy = torah.week?.picks?.length ? null : weeklyDivreiTorah({ items, todayKey: getJewishDateKey(now, tz), parashaName: weekParasha });
  const week = torah.week?.picks?.length ? { name: torah.focus.name, picks: torah.week.picks, more: torah.week.more, route: torah.focus.route, kind: torah.focus.kind }
    : legacy ? { name: legacy.name, picks: legacy.items.map(item => ({ id: item.title, title: item.title })), more: 0, route: null, kind: legacy.kind } : null;
  const leyning = shabbatItem?.leyning || null;
  const reading = leyning ? {
    special: context?.specialDay || null,
    sourceRef: leyning.torah || null,
    maftir: leyning.maftir || null,
    haftara: (leyning.haftarah_sephardic || leyning.haftarah || '').split(' | ')[0] || null,
  } : null;
  const additions = context?.additions || [];
  const omissions = context?.prayerContext?.omissions || [];

  return <section className={`daf-shabbat${wall ? ' wall' : ''}`}>
    <div className="daf-controls no-print">
      <BackLink href="#personal-tools" label="כלים אישיים" />
      <details className="daf-more">
        <summary>עוד פעולות</summary>
        <div className="daf-more-menu">
          <button type="button" className="ghost" aria-pressed={wall} onClick={() => setWall(value => !value)}>{wall ? 'תצוגה רגילה' : 'תצוגת קיר'}</button>
          <button type="button" className="ghost" onClick={() => window.print()}>הדפסה</button>
        </div>
      </details>
    </div>
    <header className="daf-head">
      <p className="eyebrow">דף שבת</p>
      <h1>{parashaName || 'שבת'}</h1>
      <p className="daf-date">{plan.dateKey ? formatGregorianDate(`${plan.dateKey}T12:00:00Z`, tz) : ''}</p>
    </header>
    <div className="daf-grid">
      <section className="daf-block">
        <h2>זמנים</h2>
        <dl>
          <dt>הדלקת נרות</dt><dd>{plan.candles ? timeLabel(plan.candles, tz) : 'לא זמין'}</dd>
          <dt>צאת השבת/החג</dt><dd>{plan.havdalah ? timeLabel(plan.havdalah, tz) : 'לא זמין'}{rabbenuTam && <small className="rabbenu-tam-line">רבנו תם · {timeLabel(rabbenuTam, tz)}</small>}</dd>
        </dl>
      </section>
      <section className="daf-block">
        <h2>קריאת התורה</h2>
        <dl>
          <dt>פרשה</dt><dd>{context?.parasha?.hebrew || context?.parasha?.title || 'לא זמין'}{shabbatItem?.category === 'holiday' ? ' (בשבת הבאה)' : ''}</dd>
          <dt>שבת מיוחדת</dt><dd>{shabbatItem?.category === 'holiday' ? shabbatItem.hebrew : (reading?.special?.hebrew || reading?.special?.title || 'אין')}</dd>
          <dt>מפטיר</dt><dd>{reading?.maftir ? <TanakhRefText text={formatTanakhReferences(reading.maftir)} /> : 'לא זמין'}</dd>
        </dl>
        <details className="daf-details">
          <summary>פרטים נוספים</summary>
          <dl>
            <dt>קריאה</dt><dd>{reading?.sourceRef ? <TanakhRefText text={formatTanakhReferences(reading.sourceRef)} /> : 'לא זמין'}</dd>
            <dt>הפטרה</dt><dd>{reading?.haftara ? <TanakhRefText text={formatTanakhReferences(reading.haftara)} /> : 'לא זמין'}</dd>
          </dl>
        </details>
      </section>
      <section className="daf-block">
        <h2>בתפילה</h2>
        {additions.length === 0 && omissions.length === 0
          ? <p>אין תוספות מיוחדות.</p>
          : <ul>
            {additions.map(item => <li key={`a-${item.text}`}>{item.text}</li>)}
            {omissions.map(item => <li key={`o-${item.text}`}>{item.text}</li>)}
          </ul>}
      </section>
      <section className="daf-block daf-wide">
        <h2>הכנות לשבת</h2>
        <ShabbatPrepCard now={now} settings={settings} items={items} />
      </section>
      {week && <section className="daf-block daf-wide">
        <h2>שולחן שבת</h2>
        <a className="table-preview-card" href="#shabbat-table">
          <span className="table-preview-text"><strong>שלושה דברי תורה · {week.name}</strong>
            <span className="tc-table-lines">{week.picks.map(pick => <span className="tc-table-line" key={pick.id}><b>{pick.title}</b>{pick.readMinutes && <small>{articleKindLine(pick)}</small>}</span>)}</span>
            <span className="tc-table-go">לשולחן שבת</span>
          </span>
          <span className="table-preview-arrow" aria-hidden="true">‹</span>
        </a>
        {week.more > 0 && week.route && <p className="tc-table-more"><a href={`#${week.route}`}>{`עוד ${week.more} דברי תורה ל${week.kind === 'parasha' ? 'פרשה' : week.name}`}</a></p>}
      </section>}
    </div>
  </section>;
}
