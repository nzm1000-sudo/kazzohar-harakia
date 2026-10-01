import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createLiveActivityBridge, LIVE_TITLE } from '../src/services/hitbodedut/liveActivity.mjs';
import { GATEKEEPER_FLAGS, GATEKEEPER_TEXT, gatekeeperStatus } from '../src/services/hitbodedut/gatekeeper.mjs';
import { FOCUS_HONEST, FOCUS_INTRO, FOCUS_STEPS } from '../src/services/hitbodedut/focusGuide.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

function mockPlugin(answer = { supported: true, enabled: true }) {
  const calls = [];
  const plugin = {};
  for (const m of ['liveSupported', 'liveStart', 'liveUpdate', 'liveEnd', 'takeLiveActions']) plugin[m] = async args => { calls.push([m, args]); if (m === 'liveSupported') return answer; if (m === 'liveStart') return { started: true }; if (m === 'takeLiveActions') return { actions: [{ action: 'pause', at: 5 }, { action: 'bogus' }, null] }; return {}; };
  return { plugin, calls };
}
const timer = { startedAt: 0, durationMs: 900000, endsAt: Date.now() + 900000 };

test('Live Activity bridge: start → pause → resume → end on iOS', async () => {
  const { plugin, calls } = mockPlugin();
  const live = createLiveActivityBridge(plugin, { platform: 'ios' });
  assert.equal(await live.start(timer), true);
  assert.equal(calls[1][0], 'liveStart');
  assert.equal(calls[1][1].title, LIVE_TITLE);
  assert.equal(calls[1][1].endsAt, timer.endsAt);
  await live.pause(timer, 600000.4);
  assert.deepEqual(calls.at(-1), ['liveUpdate', { endsAt: timer.endsAt, paused: true, remainingMs: 600000 }]);
  await live.resume(timer);
  assert.equal(calls.at(-1)[1].paused, false);
  await live.end({ completed: true });
  assert.deepEqual(calls.at(-1), ['liveEnd', { completed: true }]);
  assert.equal(live.active, false);
});

test('Live Activity bridge: only well-formed Lock Screen actions are handed on', async () => {
  const { plugin } = mockPlugin();
  const live = createLiveActivityBridge(plugin, { platform: 'ios' });
  assert.deepEqual(await live.takeActions(), [{ action: 'pause', at: 5 }]);
});

test('Live Activity bridge: graceful when unsupported or switched off', async () => {
  for (const [platform, answer] of [['android', { supported: true }], ['web', { supported: true }], ['ios', { supported: false }], ['ios', { supported: true, enabled: false }]]) {
    const { plugin, calls } = mockPlugin(answer);
    const live = createLiveActivityBridge(plugin, { platform });
    assert.equal(await live.start(timer), false, `${platform} ${JSON.stringify(answer)}`);
    await live.pause(timer, 1);
    await live.resume(timer);
    assert.equal(calls.some(([m]) => m === 'liveStart' || m === 'liveUpdate'), false);
  }
  const none = createLiveActivityBridge(null, { platform: 'ios' });
  assert.equal(await none.start(timer), false);
  assert.deepEqual(await none.takeActions(), []);
});

test('שומר הסף is off: the flag, the status and the honest words', () => {
  assert.equal(GATEKEEPER_FLAGS.enabled, false);
  assert.ok(Object.isFrozen(GATEKEEPER_FLAGS));
  const status = gatekeeperStatus({ platform: 'ios', native: { compiled: true, authorization: 'approved' } });
  assert.equal(status.available, false, 'even a compiled native side stays off while the flag is off');
  assert.equal(status.text, 'דורש אישור מאפל — יופעל בגרסה עתידית');
  assert.equal(GATEKEEPER_TEXT.shieldTitle, 'זה הזמן שבחרת לעצמך');
  assert.equal(GATEKEEPER_TEXT.shieldButton, 'חזור לכזוהר הרקיע');
  assert.equal(gatekeeperStatus({ flags: { enabled: true }, platform: 'android' }).available, false);
});

test('the Family Controls entitlement is not requested by the signed targets', () => {
  for (const path of ['ios/App/App/App.entitlements', 'ios/App/KZWidgets/KZWidgets.entitlements']) assert.doesNotMatch(read(path), /family-controls/);
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  assert.doesNotMatch(pbx, /KZ_FAMILY_CONTROLS/, 'the compile flag is not defined in the shipped project');
  assert.doesNotMatch(pbx, /FamilyControls\.framework|ManagedSettings\.framework/);
  const gate = read('ios/App/App/KZGatekeeperPlugin.swift');
  assert.match(gate, /#if KZ_FAMILY_CONTROLS/);
});

test('Focus explainer is honest: no claim of silencing', () => {
  const text = [FOCUS_INTRO, FOCUS_HONEST, ...FOCUS_STEPS.map(step => `${step.title} ${step.text}`)].join(' ');
  assert.match(FOCUS_INTRO, /אינה יכולה להשתיק/);
  assert.doesNotMatch(text, /השתקנו|הושתקו|האפליקציה השתיקה/);
});

test('no medical / therapeutic claims about sounds anywhere in the feature', () => {
  const files = ['src/services/ambientAudio/noise.mjs', 'src/services/ambientAudio/presets.mjs', 'src/pages/HitbodedutPage.jsx'];
  for (const path of files) {
    const text = read(path);
    assert.doesNotMatch(text, /ריפוי|מרפא|טיפולי|גלי מוח|בינאורל|solfeggio|healing|binaural|therap/i, path);
  }
});

test('native wiring: plugin registered on both platforms, background audio and Live Activities declared', () => {
  assert.match(read('ios/App/App/KZBridgeViewController.swift'), /registerPluginInstance\(KZHitbodedutPlugin\(\)\)/);
  const plist = read('ios/App/App/Info.plist');
  assert.match(plist, /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>audio<\/string>/);
  assert.match(plist, /<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);
  assert.match(read('android/app/src/main/java/com/kzohaar/app/MainActivity.java'), /registerPlugin\(com\.kzohaar\.app\.hitbodedut\.KZHitbodedutPlugin\.class\)/);
  assert.match(read('ios/App/KZWidgets/KZWidgets.swift'), /KZHitbodedutLiveActivity\(\)/);
  assert.ok(existsSync(new URL('ios/App/Shared/KZHitbodedutActivity.swift', root)));
});
