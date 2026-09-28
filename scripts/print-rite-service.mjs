// Print a composed service exactly as the reader shows it, for review end to end.
// Usage: node scripts/print-rite-service.mjs <nusach> <serviceId> [YYYY-MM-DD] [prayerType] [il|diaspora] [prayer|edition] [--full]
//   the date is the civil day the prayer belongs to (for Arvit: the day whose evening it is — the engine moves it to the night)
import { loadSiddur } from '../src/services/nusach.mjs';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { composeRiteService } from '../src/services/prayer/riteServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
const [nusach, serviceId, date = '2025-01-06', prayerType = 'shacharit', place = 'il', mode = 'prayer'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const full = process.argv.includes('--full');
const il = place !== 'diaspora';
const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il };
const hour = prayerType === 'maariv' ? '19:30' : prayerType === 'mincha' ? '13:30' : '08:00';
const now = new Date(`${date}T${hour}:00+02:00`);
const sunset = new Date(`${date}T17:00:00+02:00`);
const context = { ...JewishContextEngine({ now, settings, times: { sunset }, prayerType: prayerType === 'mussaf' ? 'shacharit' : prayerType }), servicePrayer: prayerType };
const pack = await loadSiddur(nusach);
const doc = composeRiteService({ composition: COMPOSITIONS[nusach], serviceId, texts: pack.texts, context, mode });
console.log(`# ${nusach} / ${serviceId} — ${context.hebrewDate?.label} (${date}, ${prayerType}, ${il ? 'Israel' : 'diaspora'}, ${mode})`);
for (const s of doc.sections) {
  console.log(`\n## [${s.id}] ${s.title || '(continues)'}${s.role ? ` {${s.role}}` : ''}${s.whenLabel ? ` <${s.whenLabel}>` : ''}`);
  for (const b of s.blocks) {
    const t = String(b.text || '').replace(/\s+/g, ' ');
    console.log(`  ${b.type === 'heading' ? '### ' : b.type === 'instruction' ? '(i) ' : ''}${full ? t : t.length > 160 ? `${t.slice(0, 90)} … ${t.slice(-60)}` : t}`);
  }
}
