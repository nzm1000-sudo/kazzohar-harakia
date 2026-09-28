// The editorial pipeline's gate: candidate → review → published. Run before publishing any new record:
//   node scripts/tradition/check-corpus.mjs
// It lists every record by status and fails (exit 1) if a record marked "published" does not pass the gate —
// a source with an exact place, a known community, a verification level, known rights, a halachic source for
// practical halacha, verbatim text only from open sources, and never an AI as a source.
import { TRADITION_RECORDS } from '../../src/data/tradition/records.mjs';
import { publicationErrors, traditionStats } from '../../src/services/tradition.mjs';

const byStatus = status => TRADITION_RECORDS.filter(record => record.status === status);
let failed = 0;
for (const status of ['candidate', 'review', 'published']) {
  const list = byStatus(status);
  console.log(`\n${status} (${list.length})`);
  for (const record of list) {
    const errors = publicationErrors(record);
    if (status === 'published' && errors.length) failed += 1;
    console.log(`  ${errors.length ? '✗' : '✓'} ${record.id}${errors.length ? ` — ${errors.join('; ')}` : ''}`);
  }
}
const ids = TRADITION_RECORDS.map(record => record.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) { failed += duplicates.length; console.log(`\nduplicate ids: ${duplicates.join(', ')}`); }
console.log('\n', traditionStats());
if (failed) { console.error(`\n${failed} published record(s) fail the gate`); process.exit(1); }
