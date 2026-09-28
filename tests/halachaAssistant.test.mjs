import test from 'node:test';
import assert from 'node:assert/strict';
import { HALACHA_FLOW_INDEX } from '../src/data/halachaFlows.mjs';
import { FLOW_HINTS } from '../src/data/halachaFlowHints.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { newConversation, respond, buildPacket, explainWithModel } from '../src/services/ai/halachaConversation.mjs';
import { validateAssistantResponse } from '../src/services/ai/halachaGate.mjs';
import { createModelChain, MockProvider, CloudProxyProvider, AppleOnDeviceProvider, NoModelProvider, QuotaExhaustedError, ModelUnavailableError } from '../src/services/ai/halachaModels.mjs';
import { prayerTimeStatus, detectPrayerTimeQuestion } from '../src/services/halachaTime.mjs';
import { setAppActivity, getAppActivity, prayerFromTitle, sectionFromTitle } from '../src/services/appActivity.mjs';
import { halachaForSlot } from '../src/services/halachaEngine.mjs';
import { CONVERSATION_EVAL, EVAL_TIMES, EVAL_DAY, EVAL_ROSH_CHODESH } from './fixtures/halachaConversationEval.mjs';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };

test('conversation evaluation set: multi-turn, colloquial, context and adversarial cases', async () => {
  const failures = [];
  for (const item of CONVERSATION_EVAL) {
    let conversation = newConversation();
    for (const turn of item.turns) {
      const env = { context: item.day === 'rosh-chodesh' ? EVAL_ROSH_CHODESH : EVAL_DAY, times: EVAL_TIMES, now: new Date(`2026-11-03T${item.now || '14:00'}:00`) };
      const result = await respond(conversation, turn.say, env);
      conversation = result.conversation;
      const r = result.response;
      const where = `${item.name} › "${turn.say}"`;
      if (turn.type && r.type !== turn.type) failures.push(`${where}: type ${r.type} ≠ ${turn.type}`);
      if (turn.ask && r.clarification?.question !== turn.ask) failures.push(`${where}: asked "${r.clarification?.question}"`);
      if (turn.entries && JSON.stringify(r.entryIds) !== JSON.stringify(turn.entries)) failures.push(`${where}: entries ${r.entryIds}`);
      if (turn.not && turn.not.includes(r.type)) failures.push(`${where}: must not be ${r.type}`);
      if (turn.note && !r.notes.some(note => turn.note.test(note))) failures.push(`${where}: missing note ${turn.note}`);
      if (turn.sensitive && !r.sensitive) failures.push(`${where}: not marked sensitive`);
    }
  }
  assert.deepEqual(failures, []);
});

test('conversation state stays compact', async () => {
  let conversation = newConversation();
  for (const say of ['שכחתי יעלה ויבוא', 'במנחה', 'ראש חודש', 'אחרי שסיימתי', 'מה המקור?', 'אפשר להתפלל עכשיו?', 'מנחה']) conversation = (await respond(conversation, say, { context: EVAL_DAY, times: EVAL_TIMES, now: new Date('2026-11-03T14:00:00') })).conversation;
  assert.ok(conversation.turns.length <= 6);
});

test('the app context answers "which prayer" and "forgot what": siddur activity is used, not asked again', async () => {
  const env = { context: EVAL_DAY, times: EVAL_TIMES, now: new Date('2026-11-03T14:00:00'), activity: { area: 'siddur', prayer: 'mincha', title: 'מנחה' } };
  const now = await respond(newConversation(), 'אפשר להתפלל עכשיו?', env);
  assert.equal(now.response.type, 'answer');
  assert.match(now.response.text, /מנחה/);
  const forgot = await respond(newConversation(), 'שכחתי', { ...env, activity: { area: 'siddur', section: 'omer', title: 'ספירת העומר' } });
  assert.equal(forgot.response.flow.id, 'omer');
});

test('the model is not called when the deterministic engine knows the answer', async () => {
  const mock = MockProvider({ 'map-option': { index: 0 }, interpret: {} });
  const chain = createModelChain([mock]);
  let conversation = newConversation();
  for (const say of ['שכחתי יעלה ויבוא', 'במנחה', 'ראש חודש', 'אחרי שסיימתי']) conversation = (await respond(conversation, say, { context: EVAL_DAY, times: EVAL_TIMES, model: chain })).conversation;
  assert.equal(mock.calls.length, 0);
});

test('the model maps an unclear reply onto the open options, and only onto them', async () => {
  const chain = createModelChain([MockProvider({ 'map-option': { index: 1 } })]);
  const first = await respond(newConversation(), 'אפשר לחמם מרק בשבת?', { context: EVAL_DAY, model: chain });
  const second = await respond(first.conversation, 'נראה לי שהוא עמד בחוץ הרבה זמן', { context: EVAL_DAY, model: chain });
  assert.equal(second.response.type, 'answer');
  assert.deepEqual(second.response.entryIds, ['qa-reheat-food-shabbat']);
  assert.equal(second.response.via, 'mock');
  const bad = createModelChain([MockProvider({ 'map-option': { index: 9 } })]);
  const third = await respond(first.conversation, 'נראה לי שהוא עמד בחוץ הרבה זמן', { context: EVAL_DAY, model: bad });
  assert.equal(third.response.type, 'clarification', 'an out-of-range choice is ignored');
});

test('model interpretation re-enters the deterministic engine; its own "answers" are ignored', async () => {
  const chain = createModelChain([MockProvider({ interpret: { flowId: 'omer', answer: 'מותר הכל' } })]);
  const result = await respond(newConversation(), 'איך מתקנים את הפספוס של אתמול בלילה בספירה', { context: EVAL_DAY, model: chain });
  assert.equal(result.response.flow?.id, 'omer');
  assert.ok(!JSON.stringify(result.response).includes('מותר הכל'));
});

test('provider chain: first available wins, quota exhaustion falls back and benches, never bills', async () => {
  let time = 1_000;
  const exhausted = { ...MockProvider({ 'map-option': new QuotaExhaustedError(60_000) }), id: 'free-cloud', kind: 'cloud' };
  const backup = MockProvider({ 'map-option': { index: 0 } });
  const chain = createModelChain([exhausted, backup], { now: () => time });
  const first = await chain.complete({ task: 'map-option', packet: { a: 1 } });
  assert.equal(first.providerId, 'mock');
  assert.ok(chain.benchedUntil.get(exhausted.id) > time);
  const none = createModelChain([MockProvider({ 'map-option': new QuotaExhaustedError() })]);
  assert.equal(await none.complete({ task: 'map-option', packet: {} }), null, 'no provider left → the caller falls back to the deterministic engine');
  const cached = await chain.complete({ task: 'map-option', packet: { a: 1 } });
  assert.equal(cached.cached, true, 'the same packet is not sent twice');
});

test('provider chain respects a local daily budget for cloud calls', async () => {
  const cloud = MockProvider({ 'map-option': ({ packet }) => ({ index: packet.n }) });
  cloud.kind = 'cloud';
  const chain = createModelChain([cloud], { dailyBudget: 2, storage: memory() });
  assert.ok(await chain.complete({ task: 'map-option', packet: { n: 1 } }));
  assert.ok(await chain.complete({ task: 'map-option', packet: { n: 2 } }));
  assert.equal(await chain.complete({ task: 'map-option', packet: { n: 3 } }), null);
});

test('providers report unavailability honestly', async () => {
  assert.equal((await NoModelProvider.availability()).available, false);
  assert.deepEqual(await CloudProxyProvider({ endpoint: null }).availability(), { available: false, reason: 'not-configured' });
  assert.deepEqual(await AppleOnDeviceProvider({ bridge: null }).availability(), { available: false, reason: 'not-native' });
  const hebrewless = AppleOnDeviceProvider({ bridge: { availability: async () => ({ available: false, reason: 'language-not-supported' }) } });
  assert.deepEqual(await hebrewless.availability(), { available: false, reason: 'language-not-supported' });
  const cloud429 = CloudProxyProvider({ endpoint: 'https://proxy.example', fetchImpl: async () => ({ status: 429, ok: false, headers: { get: () => '30' } }) });
  await assert.rejects(cloud429.complete({ task: 'map-option', packet: {} }), QuotaExhaustedError);
  const cloudDown = CloudProxyProvider({ endpoint: 'https://proxy.example', fetchImpl: async () => { throw new TypeError('network'); } });
  await assert.rejects(cloudDown.complete({ task: 'map-option', packet: {} }), ModelUnavailableError);
});

const packetFor = ids => buildPacket({ question: 'ש', conversation: newConversation(), entries: ids.map(id => PRACTICAL_HALACHA_QA_INDEX[id]) });

test('gate: a grounded explanation passes', () => {
  const packet = packetFor(['hal-shabbat-return-to-plata']);
  const entry = packet.entries[0];
  const quote = entry.excerpt.slice(0, 30);
  const verdict = validateAssistantResponse({ type: 'answer', confidence: 'direct', entryIds: [entry.id], claims: [{ text: 'תבשיל יבש מבושל מותר להחזיר', sourceIds: [entry.id], support: 'direct', quote }] }, packet);
  assert.deepEqual(verdict.errors, []);
});

test('gate: invented sources, quotes, books, rabbis, references and rulings are rejected', () => {
  const packet = packetFor(['hal-shabbat-return-to-plata']);
  const id = packet.entries[0].id;
  const reject = (response, pattern) => { const verdict = validateAssistantResponse(response, packet); assert.equal(verdict.ok, false); assert.ok(verdict.errors.some(error => pattern.test(error)), verdict.errors.join('; ')); };
  reject({ type: 'answer', entryIds: ['qa-not-real'], claims: [] }, /not retrieved/);
  reject({ type: 'answer', entryIds: [id], claims: [{ text: 'x', sourceIds: [id], quote: 'משפט שלא מופיע במקור' }] }, /verbatim/);
  reject({ type: 'answer', entryIds: [id], claims: [{ text: 'x' }] }, /no source/);
  reject({ type: 'answer', entryIds: [id], text: 'כך כתב המשנה ברורה', claims: [{ text: 'x', sourceIds: [id] }] }, /names a work/);
  reject({ type: 'answer', entryIds: [id], text: 'הרב אלישיב התיר', claims: [{ text: 'x', sourceIds: [id] }] }, /authority/);
  reject({ type: 'answer', entryIds: [id], text: 'ראה סימן תתק סעיף ז', claims: [{ text: 'x', sourceIds: [id] }] }, /reference/);
  reject({ type: 'answer', entryIds: [id], text: 'במקרה שלך מותר', claims: [{ text: 'x', sourceIds: [id] }] }, /personal ruling/);
  reject({ type: 'answer', claims: [] }, /no evidence/);
  reject({ type: 'verdict', entryIds: [id] }, /unknown type/);
});

test('gate: an open question must be asked, and a dispute may not be presented as settled', () => {
  const open = { ...packetFor(['qa-reheat-food-shabbat']), openQuestion: { question: 'המרק עדיין חם?', options: ['חם', 'קר'] } };
  assert.equal(validateAssistantResponse({ type: 'answer', entryIds: ['qa-reheat-food-shabbat'], claims: [{ text: 'x', sourceIds: ['qa-reheat-food-shabbat'] }] }, open).ok, false);
  const disputed = packetFor(['hal-brachot-mezonot-on-bread']);
  assert.equal(validateAssistantResponse({ type: 'answer', confidence: 'direct', entryIds: ['hal-brachot-mezonot-on-bread'], claims: [{ text: 'יצא', sourceIds: ['hal-brachot-mezonot-on-bread'] }] }, disputed).ok, false);
  assert.equal(validateAssistantResponse({ type: 'disagreement', confidence: 'grounded_synthesis', entryIds: ['hal-brachot-mezonot-on-bread'], claims: [{ text: 'יש בזה מחלוקת', sourceIds: ['hal-brachot-mezonot-on-bread'] }] }, disputed).ok, true);
});

test('a model explanation that fails the gate is not shown', async () => {
  const chain = createModelChain([MockProvider({ explain: { type: 'answer', text: 'הרב אלישיב אומר שמותר', entryIds: ['qa-banana-blessing'], claims: [{ text: 'מותר', sourceIds: ['qa-banana-blessing'] }] } })]);
  const answer = (await respond(newConversation(), 'מה מברכים על בננה', { context: EVAL_DAY })).response;
  const explanation = await explainWithModel(chain, answer, newConversation(), 'מה מברכים על בננה');
  assert.ok(explanation.rejected?.length);
});

test('context packets are small and carry only retrieved material', () => {
  const packet = buildPacket({ question: 'x'.repeat(2000), conversation: { turns: Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: 'y'.repeat(500) + i })) }, entries: Object.values(PRACTICAL_HALACHA_QA_INDEX).slice(0, 10) });
  assert.ok(packet.question.length <= 400);
  assert.ok(packet.turns.length <= 4 && packet.turns.every(turn => turn.text.length <= 200));
  assert.ok(packet.entries.length <= 4);
  assert.ok(JSON.stringify(packet).length < 8000);
});

test('prayer-time questions: detected, and answered from the zmanim windows', () => {
  assert.deepEqual(detectPrayerTimeQuestion('אפשר להתפלל עכשיו?'), { prayer: null });
  assert.deepEqual(detectPrayerTimeQuestion('עדיין אפשר מנחה?'), { prayer: 'mincha' });
  assert.deepEqual(detectPrayerTimeQuestion('כבר אפשר ערבית?'), { prayer: 'arvit' });
  assert.equal(detectPrayerTimeQuestion('מה מברכים על בננה'), null);
  const at = h => new Date(`2026-11-03T${h}:00`);
  assert.equal(prayerTimeStatus('shacharit', at('08:00'), EVAL_TIMES).status, 'open');
  assert.equal(prayerTimeStatus('shacharit', at('11:00'), EVAL_TIMES).status, 'limited');
  assert.equal(prayerTimeStatus('shacharit', at('13:00'), EVAL_TIMES).status, 'closed');
  assert.equal(prayerTimeStatus('mincha', at('17:15'), EVAL_TIMES).status, 'limited');
  assert.equal(prayerTimeStatus('mincha', at('17:40'), EVAL_TIMES).status, 'closed');
  assert.equal(prayerTimeStatus('arvit', at('16:30'), EVAL_TIMES).status, 'limited');
  assert.equal(prayerTimeStatus('tefillin', at('17:15'), EVAL_TIMES).status, 'limited');
  assert.equal(prayerTimeStatus('mincha', at('14:00'), {}).status, 'unknown', 'no zmanim → no guess');
  for (const prayer of ['shacharit', 'mincha', 'arvit', 'shema', 'tefillin']) for (const h of ['04:00', '08:00', '11:00', '13:00', '17:15', '20:00']) {
    const status = prayerTimeStatus(prayer, at(h), EVAL_TIMES);
    for (const entry of status.entries) assert.equal(entry.answerStatus, 'published');
  }
});

test('app activity: remembered for the session only, and forgotten after half an hour', () => {
  const storage = memory();
  setAppActivity({ area: 'siddur', prayer: 'mincha', title: 'מנחה' }, storage, 1_000);
  assert.equal(getAppActivity(storage, 1_000 + 60_000).prayer, 'mincha');
  assert.equal(getAppActivity(storage, 1_000 + 31 * 60_000), null);
  assert.equal(prayerFromTitle('תפילת מנחה לחול'), 'mincha');
  assert.equal(sectionFromTitle('ברכת המזון'), 'birkat-hamazon');
});

test('Today: six different halachot a day, stable within each four-hour slot, only in their season', () => {
  const day = { key: '2026-11-03', hebrewDate: { day: 22, month: 8, year: 5787 }, weekday: 2, isIsrael: true };
  const picks = [1, 5, 9, 13, 17, 21].map(h => halachaForSlot(day, new Date(`2026-11-03T${String(h).padStart(2, '0')}:10:00`)));
  assert.equal(new Set(picks.map(pick => pick.entry.id)).size, 6);
  assert.equal(halachaForSlot(day, new Date('2026-11-03T09:05:00')).entry.id, halachaForSlot(day, new Date('2026-11-03T11:55:00')).entry.id);
  for (const pick of picks) {
    assert.ok(!/^(כן|לא)[.,]/.test(pick.entry.shortAnswer));
    assert.ok(!(pick.entry.contexts || []).some(key => ['sukkot', 'pesach', 'chanukah', 'purim', 'yom-kippur', 'rosh-hashana', 'tisha-bav', 'omer', 'friday', 'shabbat'].includes(key)), `${pick.entry.id} is out of season on an ordinary Tuesday`);
    assert.notEqual(pick.entry.category, 'purity');
  }
  const nextDay = [1, 5, 9, 13, 17, 21].map(h => halachaForSlot({ ...day, key: '2026-11-04', weekday: 3 }, new Date(`2026-11-04T${String(h).padStart(2, '0')}:10:00`)).entry.id);
  assert.notDeepEqual(nextDay, picks.map(pick => pick.entry.id), 'the next day brings other halachot');
});

test('flow hints refer only to real flows, steps, options and published entries', () => {
  for (const [flowId, steps] of Object.entries(FLOW_HINTS)) {
    const flow = HALACHA_FLOW_INDEX[flowId];
    assert.ok(flow, flowId);
    for (const [stepId, hint] of Object.entries(steps)) {
      assert.ok(flow.steps[stepId], `${flowId}/${stepId}`);
      for (const label of Object.keys(hint.options || {})) assert.ok(flow.steps[stepId].options.some(option => option.label === label), `${flowId}/${stepId}: ${label}`);
      for (const id of hint.whyAsked || []) assert.equal(PRACTICAL_HALACHA_QA_INDEX[id]?.answerStatus, 'published', id);
    }
  }
});
