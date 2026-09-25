// Library fullness validator. FULL is granted only by proof: every expected unit present once, non-empty, in order.
export const COVERAGE = Object.freeze({
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  METADATA_ONLY: 'METADATA_ONLY',
  REMOTE_ONLY: 'REMOTE_ONLY',
  SCAN_ONLY: 'SCAN_ONLY',
  UNAVAILABLE: 'UNAVAILABLE',
});

const UNIT_ID = /^[A-Z][A-Za-z_]*(?:\.\d+)+$/;

// expected: [{ n, units }] per top node (chapter/perek); chunk: { workId, nodes: [{ id, n, units: [{ id, n, text }] }] }
export function validateWorkChunk(chunk, expected, { workId = chunk?.workId, editionId = chunk?.editionId } = {}) {
  const missingUnits = [];
  const duplicateIds = [];
  const emptyUnits = [];
  const invalidRefs = [];
  const unexpectedUnits = [];
  const orderErrors = [];
  const seen = new Set();
  const actual = new Map();
  let importedUnits = 0;
  for (const node of chunk?.nodes || []) {
    if (node.id !== `${workId}.${node.n}`) invalidRefs.push(node.id);
    let previous = 0;
    for (const unit of node.units || []) {
      importedUnits += 1;
      if (!UNIT_ID.test(unit.id) || unit.id !== `${node.id}.${unit.n}`) invalidRefs.push(unit.id);
      if (seen.has(unit.id)) duplicateIds.push(unit.id);
      seen.add(unit.id);
      if (typeof unit.text !== 'string' || !unit.text.trim()) emptyUnits.push(unit.id);
      else if (/[<>]/.test(unit.text)) invalidRefs.push(`${unit.id}:markup`);
      if (unit.n <= previous) orderErrors.push(unit.id);
      previous = unit.n;
      actual.set(unit.id, true);
    }
  }
  let expectedUnits = 0;
  const expectedIds = new Set();
  for (const { n, units } of expected || []) {
    for (let unit = 1; unit <= units; unit += 1) {
      const id = `${workId}.${n}.${unit}`;
      expectedUnits += 1;
      expectedIds.add(id);
      if (!actual.has(id)) missingUnits.push(id);
    }
  }
  for (const id of actual.keys()) if (!expectedIds.has(id)) unexpectedUnits.push(id);
  const clean = !missingUnits.length && !duplicateIds.length && !emptyUnits.length && !invalidRefs.length && !unexpectedUnits.length && !orderErrors.length;
  return {
    workId,
    editionId,
    expectedUnits,
    importedUnits,
    missingUnits,
    duplicateIds,
    emptyUnits,
    invalidRefs,
    unexpectedUnits,
    orderErrors,
    status: clean && expectedUnits > 0 ? COVERAGE.FULL : importedUnits > 0 ? COVERAGE.PARTIAL : COVERAGE.UNAVAILABLE,
  };
}

export function summarizeReports(reports) {
  const sum = key => reports.reduce((total, report) => total + (Array.isArray(report[key]) ? report[key].length : Number(report[key]) || 0), 0);
  return {
    works: reports.length,
    full: reports.filter(report => report.status === COVERAGE.FULL).length,
    partial: reports.filter(report => report.status === COVERAGE.PARTIAL).length,
    expectedUnits: sum('expectedUnits'),
    importedUnits: sum('importedUnits'),
    missingUnits: sum('missingUnits'),
    duplicateIds: sum('duplicateIds'),
    emptyUnits: sum('emptyUnits'),
    invalidRefs: sum('invalidRefs'),
    unexpectedUnits: sum('unexpectedUnits'),
    orderErrors: sum('orderErrors'),
  };
}
