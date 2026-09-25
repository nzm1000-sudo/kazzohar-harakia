import { useState } from 'react';
import { timeLabel } from '../services.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import { activePreparation } from '../services/preparationPlan.mjs';
import { ShabbatChecklist } from './PreparationHub.jsx';
import { BackLink } from '../components/LocalNavigation.jsx';
import { shabbatTableContent } from '../services/shabbatTable.mjs';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';

export default function ShabbatPage({ now, settings, items, context }) {
  const [wall, setWall] = useState(false);
  const tz = settings?.location?.tzid || 'UTC';
  const plan = activePreparation({ now, tz, items });
  const shabbatItem = context?.shabbatReading || context?.parasha || context?.upcomingShabbat || null;
  const parashaName = shabbatItem?.hebrew || shabbatItem?.title || null;
  const content = shabbatTableContent(context?.parasha?.hebrew || context?.parasha?.title || parashaName);
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
      <BackLink href="#today" label="חזרה להיום" />
      <button type="button" className="ghost" aria-pressed={wall} onClick={() => setWall(value => !value)}>{wall ? 'תצוגה רגילה' : 'תצוגת קיר'}</button>
      <button type="button" className="ghost" onClick={() => window.print()}>הדפסה</button>
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
          <dt>צאת השבת/החג</dt><dd>{plan.havdalah ? timeLabel(plan.havdalah, tz) : 'לא זמין'}</dd>
        </dl>
      </section>
      <section className="daf-block">
        <h2>קריאת התורה</h2>
        <dl>
          <dt>פרשה</dt><dd>{context?.parasha?.hebrew || context?.parasha?.title || 'לא זמין'}{shabbatItem?.category === 'holiday' ? ' (בשבת הבאה)' : ''}</dd>
          <dt>שבת מיוחדת</dt><dd>{shabbatItem?.category === 'holiday' ? shabbatItem.hebrew : (reading?.special?.hebrew || reading?.special?.title || 'אין')}</dd>
          <dt>קריאה</dt><dd>{reading?.sourceRef ? formatTanakhReferences(reading.sourceRef) : 'לא זמין'}</dd>
          <dt>מפטיר</dt><dd>{reading?.maftir ? formatTanakhReferences(reading.maftir) : 'לא זמין'}</dd>
          <dt>הפטרה</dt><dd>{reading?.haftara ? formatTanakhReferences(reading.haftara) : 'לא זמין'}</dd>
        </dl>
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
        <ShabbatChecklist now={now} settings={settings} items={items} />
      </section>
      {content && <section className="daf-block daf-wide">
        <h2>שולחן שבת</h2>
        <p>{content.summary}</p>
        <p><strong>לשולחן:</strong> {content.familyQuestion}</p>
        <p><strong>לילדים:</strong> {content.childQuestion}</p>
        <blockquote className="table-source"><p lang="he">{content.source.text}</p><cite>{content.source.ref}</cite></blockquote>
      </section>}
    </div>
  </section>;
}
