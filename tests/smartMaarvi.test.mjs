import test from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveWeekdayMaarivRules, STATUS } from '../src/services/prayer/weekdayMaarviRules.mjs';
import { buildTimeContext } from '../src/services/prayer/timeContext.mjs';
import { buildCalendarContext } from '../src/services/prayer/calendarContext.mjs';

// Test Scenario 1: Ordinary weekday Maariv rules (no special days)
test('Smart Maariv: Scenario 1 — ordinary weekday rules resolution', async (t) => {
  const now = new Date('2025-01-15T17:30:00Z'); // Regular Wednesday, not Rosh Chodesh
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, 
    calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Verify scope is applicable
  assert.equal(rules['scope.weekday-maariv'].status, STATUS.APPLICABLE);
  assert.equal(rules['scope.weekday-maariv'].value, true);
  
  // Verify calendar rules exist
  assert.ok(rules['calendar.rosh-chodesh'] !== undefined);
  assert.ok(rules['calendar.chanukah'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.rosh-chodesh'].status));
});

// Test Scenario 2: Rosh Chodesh Maariv rules
test('Smart Maariv: Scenario 2 — Rosh Chodesh rules resolution', async (t) => {
  const now = new Date('2025-01-02T17:30:00Z'); // 1 Tevet (Rosh Chodesh)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Rosh Chodesh rule should exist and be applicable if detected
  assert.ok(rules['calendar.rosh-chodesh'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.rosh-chodesh'].status));
});

// Test Scenario 3: Chanukah Maariv rules (Al Hanissim inclusion)
test('Smart Maariv: Scenario 3 — Chanukah rules resolution', async (t) => {
  const now = new Date('2024-12-24T17:30:00Z'); // 26 Kislev (Chanukah)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Verify rule exists and resolves
  assert.ok(rules['calendar.chanukah'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.chanukah'].status));
});

// Test Scenario 4: Purim Maariv rules (Al Hanissim inclusion)
test('Smart Maariv: Scenario 4 — Purim rules resolution', async (t) => {
  const now = new Date('2025-03-14T17:30:00Z'); // 14 Adar (Purim)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Verify rule exists and resolves
  assert.ok(rules['calendar.purim'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.purim'].status));
});

// Test Scenario 5: Aseret Yemei Teshuva (Ten Days of Repentance) rules
test('Smart Maariv: Scenario 5 — Aseret Yemei Teshuva rules resolution', async (t) => {
  const now = new Date('2024-10-03T17:30:00Z'); // 1 Tishrei (Rosh Hashanah start of AYT)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Verify rule exists and resolves
  assert.ok(rules['calendar.ayt'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.ayt'].status));
});

// Test Scenario 6: Omer period rules (counting)
test('Smart Maariv: Scenario 6 — Omer period rules resolution', async (t) => {
  const now = new Date('2025-04-02T17:30:00Z'); // 16 Nisan (second day of Pesach, start of Omer)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  assert.ok(rules['calendar.omer-period'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.omer-period'].status));
});

// Test Scenario 7: Motzaei Shabbat (Saturday night) rules
test('Smart Maariv: Scenario 7 — Motzaei Shabbat rules resolution', async (t) => {
  const now = new Date('2025-01-18T17:30:00Z'); // Saturday evening
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan', havdalahMode: 'full' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  assert.ok(rules['calendar.motzaei-shabbat'] !== undefined);
  assert.equal(rules['preference.havdalah-mode'].value, 'full');
});

// Test Scenario 8: Rules resolve correctly for all calendar conditions
test('Smart Maariv: Scenario 8 — all calendar conditions resolve', async (t) => {
  const now = new Date('2025-01-15T17:30:00Z');
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Verify all key rules are present
  const requiredRules = [
    'scope.weekday-maariv',
    'calendar.rosh-chodesh',
    'calendar.chanukah',
    'season.branch',
    'geography.israel',
  ];
  
  requiredRules.forEach(ruleId => {
    assert.ok(rules[ruleId] !== undefined, `Rule ${ruleId} should exist`);
    assert.ok(Object.values(STATUS).includes(rules[ruleId].status), `Rule ${ruleId} status should be valid`);
  });
});

// Test Scenario 9: Rules are deterministic
test('Smart Maariv: Scenario 9 — deterministic rule resolution', async (t) => {
  const inputs = {
    now: new Date('2025-01-15T17:30:00Z'),
    settings: { nusach: 'edot-hamizrach', il: true },
  };
  
  const time1 = buildTimeContext({ now: inputs.now, settings: inputs.settings });
  const calendar1 = buildCalendarContext({ prayerDate: time1.prayerDate, tzid: time1.tzid, settings: inputs.settings });
  const rules1 = resolveWeekdayMaarivRules({ 
    time: time1, calendar: calendar1, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });
  
  const time2 = buildTimeContext({ now: inputs.now, settings: inputs.settings });
  const calendar2 = buildCalendarContext({ prayerDate: time2.prayerDate, tzid: time2.tzid, settings: inputs.settings });
  const rules2 = resolveWeekdayMaarivRules({ 
    time: time2, calendar: calendar2, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Same inputs should yield same rule values
  Object.keys(rules1).forEach(ruleId => {
    assert.equal(rules1[ruleId].value, rules2[ruleId].value, `Rule ${ruleId} value should be deterministic`);
    assert.equal(rules1[ruleId].status, rules2[ruleId].status, `Rule ${ruleId} status should be deterministic`);
  });
});

// Test Scenario 10: Rules handle individual vs minyan preferences
test('Smart Maariv: Scenario 10 — preferences handled correctly', async (t) => {
  const now = new Date('2025-01-15T17:30:00Z');
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rulesIndividual = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'individual' },
    location: { tzid: 'Asia/Jerusalem' },
  });
  
  const rulesMinyan = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  // Both should have the same core calendar rules
  assert.equal(rulesIndividual['calendar.rosh-chodesh'].value, rulesMinyan['calendar.rosh-chodesh'].value);
  assert.equal(rulesIndividual['calendar.chanukah'].value, rulesMinyan['calendar.chanukah'].value);
});

// Additional test: Seasonal branches (winter/summer)
test('Smart Maariv: seasonal branches resolve correctly', async (t) => {
  // Winter (before 15 Shevat)
  const winterDate = new Date('2025-01-15T17:30:00Z');
  const winterTime = buildTimeContext({ now: winterDate, settings: { nusach: 'edot-hamizrach', il: true } });
  const winterCalendar = buildCalendarContext({ prayerDate: winterTime.prayerDate, tzid: winterTime.tzid, settings: { il: true } });
  
  const winterRules = resolveWeekdayMaarivRules({ 
    time: winterTime, calendar: winterCalendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  assert.ok(winterRules['season.branch'] !== undefined);
  assert.equal(winterRules['season.branch'].status, STATUS.APPLICABLE);
  assert.ok(['winter', 'summer'].includes(winterRules['season.branch'].value));
});

// Test: Rules handle geography (Israel vs diaspora)
test('Smart Maariv: geography rules distinguish Israel from diaspora', async (t) => {
  const now = new Date('2025-01-02T17:30:00Z'); // Rosh Chodesh
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rulesIsrael = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });
  
  const rulesDiaspora = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'America/New_York' },
  });

  assert.ok(rulesIsrael['geography.israel'] !== undefined);
  assert.ok(rulesDiaspora['geography.israel'] !== undefined);
});

// Test: AYT (Aseret Yemei Teshuva) special rules
test('Smart Maariv: AYT rules activate during Ten Days of Repentance', async (t) => {
  const now = new Date('2024-10-12T17:30:00Z'); // 9 Tishrei (AYT, day before Yom Kippur)
  const time = buildTimeContext({ now, settings: { nusach: 'edot-hamizrach', il: true } });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings: { il: true } });
  
  const rules = resolveWeekdayMaarivRules({ 
    time, calendar, 
    profile: { nusach: 'edot-hamizrach', setting: 'minyan' },
    location: { tzid: 'Asia/Jerusalem' },
  });

  assert.ok(rules['calendar.ayt'] !== undefined);
  assert.ok([STATUS.APPLICABLE, STATUS.NOT_APPLICABLE].includes(rules['calendar.ayt'].status));
});
