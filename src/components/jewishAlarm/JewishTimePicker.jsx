// השעון היהודי — choosing the Jewish time: the anchors in small groups (never one long list), each an equal tile with
// today's time beside its name, so the choice is concrete. Only times the app already calculates are offered.
import { ANCHOR_GROUPS, ANCHORS } from '../../services/jewishAlarm/anchors.mjs';
import { anchorOn } from '../../services/jewishAlarm/engine.mjs';
import { timeText } from '../../services/jewishAlarm/format.mjs';

export default function JewishTimePicker({ value, onChange, ctx, todayKey }) {
  const todayTime = id => {
    const anchor = ANCHORS[id];
    if (anchor.kind !== 'daily' || !ctx?.valid) return anchor.recurrence || '';
    const found = anchorOn(id, todayKey, ctx);
    return found ? `היום ${timeText(found.at, ctx.tz)}` : '';
  };
  return <div className="ja-anchor-groups">
    {ANCHOR_GROUPS.map(group => <section className="ja-anchor-group" key={group.id} aria-label={group.title}>
      <p className="ja-label">{group.title}</p>
      <div className="ja-anchor-grid" role="radiogroup" aria-label={group.title}>
        {group.anchors.map(id => <button type="button" key={id} role="radio" aria-checked={value === id} className={`ja-anchor${value === id ? ' is-on' : ''}`} onClick={() => onChange(id)}>
          <strong>{ANCHORS[id].tile || ANCHORS[id].label}</strong><small>{todayTime(id)}</small>
        </button>)}
      </div>
    </section>)}
  </div>;
}
