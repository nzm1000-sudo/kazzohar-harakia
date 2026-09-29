// The Torah Engine's data-quality audit: node scripts/torah/audit.mjs (exit 1 on any problem).
import { torahAudit } from '../../src/services/torah/audit.mjs';

const report = torahAudit();
const problems = Object.entries(report.problems).filter(([, list]) => list.length);
console.log(JSON.stringify({ ...report, notFullText: `${report.notFullText.length} works (title + in-book search)` }, null, 1));
if (problems.length) { console.error(`problems: ${problems.map(([key, list]) => `${key} ${list.length}`).join(', ')}`); process.exit(1); }
console.log('audit: 0 problems');
