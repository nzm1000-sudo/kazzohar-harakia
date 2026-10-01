// השעון היהודי — the screens and their wiring: placement (on Today under קביעות יומית, first on זמנים; no longer in the Siddur or כלים אישיים),
// the main screen (empty, one and many alarms), the editor (kinds, the Jewish time groups, before / at / after, quick
// amounts, the live preview, the week row), words in human Hebrew, theme tokens only, and the native declarations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadJsx } from './helpers/jsx.mjs';
import { SIDDUR_HOME_ORDER } from '../src/data/nusach/siddurLayouts.mjs';
import { normalizeRule } from '../src/services/jewishAlarm/model.mjs';
import { STORE_KEY } from '../src/services/jewishAlarm/store.mjs';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/services.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// The code without its comments (the comments may name what the code must never do).
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const memory = new Map();
globalThis.localStorage = { getItem: key => (memory.has(key) ? memory.get(key) : null), setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const settings = normalizeSettings({ ...DEFAULT_SETTINGS });
const NOW = new Date('2026-10-05T12:00:00Z');
const page = loadJsx('pages/JewishAlarmPage.jsx');
const editor = loadJsx('components/jewishAlarm/AlarmEditor.jsx');
const todayCard = loadJsx('components/jewishAlarm/TodayAlarmCard.jsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const setRules = rules => memory.set(STORE_KEY, JSON.stringify({ rules }));
const sunrise = normalizeRule({ id: 'a1', title: 'השכמה לנץ', mode: 'jewish', jewishAnchorId: 'sunrise', offsetMinutes: -25 });

test('placement: on Today under קביעות יומית and above the dedication; first on זמנים; no longer in the Siddur or כלים אישיים', () => {
  assert.equal(SIDDUR_HOME_ORDER.some(entry => entry.key === 'alarm'), false, 'not a Siddur category');
  const books = read('src/pages/BooksPage.jsx');
  assert.doesNotMatch(books, /siddur-alarm-category|alarmCategory|JewishAlarmIcon/);
  const tools = read('src/pages/PersonalTools.jsx');
  assert.doesNotMatch(tools, /#jewish-alarm/);
  // זמנים (under עוד): the same compact entry, before the times themselves.
  const zmanim = read('src/pages/ZmanimPage.jsx');
  const entry = zmanim.indexOf('<TodayAlarmCard settings={settings} now={now}');
  assert.ok(entry > 0 && entry < zmanim.indexOf('<div className="zman-list"'), 'first on זמנים');
  assert.match(zmanim, /onOpen=\{\(\) => \(go \? go\('jewish-alarm'\)/);
  const app = read('src/NewApp.jsx');
  assert.match(app, /mode==='jewish-alarm' \|\| mode\.startsWith\('jewish-alarm\/'\) \? <JewishAlarmPage/);
  assert.match(app, /useEffect\(\(\) => \{ syncJewishAlarms\(settings\)\.catch\(\(\) => \{\}\); \}, \[alarmSettingsSignature\]\);/, 'recalculated when the location / zone / method changes');
  assert.match(app, /App\.addListener\('resume', \(\) => \{ syncJewishAlarms\(alarmSettingsRef\.current\)/, 'refilled on return to the app');
  assert.match(app, /\.ja-sheet-backdrop(?:, [.a-z-]+)*'\)\)/, 'Android back closes the alarm sheets');
  const today = read('src/pages/TodayPage.jsx');
  assert.equal((today.match(/<TodayAlarmCard /g) || []).length, 1, 'one element on Today');
  const card = today.indexOf("<TodayAlarmCard settings={settings} now={now} onOpen={() => onNav('jewish-alarm')} />");
  assert.ok(card > today.indexOf('<p className="eyebrow">קביעות יומית</p>'), 'under קביעות יומית');
  assert.ok(card < today.indexOf('<MemorialTribute />'), 'above לעילוי נשמת');
  assert.match(today, /<TodayAlarmCard settings=\{settings\} now=\{now\} onOpen=\{\(\) => onNav\('jewish-alarm'\)\} \/>\n\s*<MemorialTribute \/>/, 'directly above the dedication');
  // The icon: one inline line drawing, currentColor, no emoji.
  const icons = read('src/components/ToolIcons.jsx');
  assert.match(icons, /export function JewishAlarmIcon\(\{ size = 22, strokeWidth = 1\.5 \}\)/);
  assert.match(icons, /stroke="currentColor"/);
});

test('Today: without an alarm, the name and an invitation; with one, the next alarm — one compact element', () => {
  memory.clear();
  const empty = render(todayCard.default, { settings, now: NOW, onOpen: () => {} });
  assert.match(empty, /^<button type="button" class="ja-today is-empty"/);
  assert.match(text(empty), /השעון היהודי שעון מעורר לפי זמני היום · לקביעת שעון/);
  assert.match(empty, /aria-label="השעון היהודי: שעון מעורר לפי זמני היום. לקביעת שעון"/);
  setRules([sunrise]);
  const html = render(todayCard.default, { settings, now: NOW, onOpen: () => {} });
  assert.match(text(html), /השעון הבא \d\d:\d\d 25 דק׳ לפני הנץ · הנץ \d\d:\d\d/);
  assert.match(html, /aria-label="השעון הבא מחר ב־\d\d:\d\d, 25 דק׳ לפני הנץ · הנץ \d\d:\d\d"/);
});

test('main screen: the empty state is calm and inviting', () => {
  memory.clear();
  const html = render(page.default, { route: 'jewish-alarm', settings, now: NOW, go: () => {} });
  const words = text(html);
  assert.match(words, /השעון היהודי/);
  assert.match(words, /שעון מעורר שמתעדכן אוטומטית לפי זמני היום והלוח היהודי\./);
  assert.match(words, /שעון שמתאים את עצמו לזמני היום\. \+ שעון חדש לדוגמה: 25 דקות לפני הנץ\./);
  assert.match(words, /הצעות שימושיות השכמה לנץ .* הכנות לשבת .* ספירת העומר .* נרות חנוכה/);
  assert.match(words, /לפי תל אביב · לפי שיטת הזמנים שבחרת/);
  assert.doesNotMatch(words, /undefined|NaN|null|PERMISSION|ERROR/);
});

test('main screen: the next alarm, then a balanced card per alarm (name · time · switch)', () => {
  setRules([sunrise, normalizeRule({ id: 'b2', mode: 'fixed', fixedTime: '07:15', recurrence: 'weekdays' }), normalizeRule({ id: 'c3', mode: 'jewish', jewishAnchorId: 'candles-shabbat', offsetMinutes: -90, title: 'הכנות לשבת', enabled: false })]);
  const html = render(page.default, { route: 'jewish-alarm', settings, now: NOW, go: () => {} });
  const words = text(html);
  assert.match(words, /השעון הבא · השכמה לנץ \d\d:\d\d מחר · 25 דקות לפני הנץ הנץ: \d\d:\d\d/);
  assert.equal((html.match(/class="ja-card( is-off)?"/g) || []).length, 3);
  assert.equal((html.match(/role="switch"/g) || []).length, 3);
  assert.match(html, /role="switch" aria-checked="false" aria-label="הכנות לשבת — כבוי"/);
  assert.match(html, /aria-label="השעון השכמה לנץ, פעיל, מחר ב[^"]+, עשרים וחמש דקות לפני הנץ\. לעריכה"/);
  assert.match(words, /שעון מעורר שעה קבועה · ימות השבוע \(א׳–ה׳\) 07:15/);
  assert.doesNotMatch(words, /undefined|NaN|null/);
});

test('the editor: kind first — two equal choices; the Jewish time in groups; before / at / after; eight quick amounts', () => {
  const draft = normalizeRule({ id: 'n1', mode: 'jewish', jewishAnchorId: null, offsetMinutes: null }, { allowIncomplete: true });
  const html = render(editor.default, { initial: draft, isNew: true, settings, now: NOW, onDone: () => {} });
  assert.match(html, /class="ja-seg ja-seg-kind" role="radiogroup" aria-label="סוג השעון" style="--ja-parts:2"/);
  for (const group of ['בוקר', 'צהריים ואחר הצהריים', 'ערב', 'שבת וחג', 'צומות', 'זמנים בשנה']) assert.match(html, new RegExp(`<p class="ja-label">${group}</p>`), group);
  for (const name of ['עלות השחר', 'הנץ החמה', 'סוף זמן קריאת שמע', 'חצות היום', 'פלג המנחה', 'צאת הכוכבים', 'רבנו תם', 'הדלקת נרות שבת', 'צאת שבת', 'תחילת הצום', 'סיום הצום', 'ספירת העומר', 'הדלקת נרות חנוכה']) assert.match(html, new RegExp(`<strong>${name}</strong>`), name);
  assert.match(text(html), /הנץ החמה היום \d\d:\d\d/, 'each tile shows today\'s time');
  const chosen = normalizeRule({ ...draft, jewishAnchorId: 'sunrise', offsetMinutes: -25 }, { allowIncomplete: true });
  const withOffset = render(editor.default, { initial: chosen, isNew: true, settings, now: NOW, onDone: () => {} });
  assert.match(withOffset, /class="ja-seg ja-seg-direction" role="radiogroup" aria-label="לפני, בזמן או אחרי" style="--ja-parts:3"/);
  assert.equal((withOffset.match(/<div class="ja-quick"[^>]*>/g) || []).length, 1);
  assert.deepEqual([...withOffset.matchAll(/aria-label="(\d+) דקות"/g)].map(m => Number(m[1])), [5, 10, 15, 20, 25, 30, 45, 60]);
  assert.match(withOffset, /role="radio" aria-checked="true" class="is-on"[^>]*aria-label="25 דקות"/);
  assert.match(text(withOffset), /כמה זמן לפני הנץ\?/);
  assert.match(text(withOffset), /מותאם אישית/);
});

test('the editor: the live preview says it plainly — "הנץ מחר 06:00 · השעון שלך 05:35 · 25 דקות לפני"', () => {
  const html = render(editor.default, { initial: sunrise, isNew: false, settings, now: NOW, onDone: () => {} });
  assert.match(html, /class="ja-preview" aria-live="polite" aria-label="הנץ מחר (\d\d:\d\d), השעון שלך (\d\d:\d\d), 25 דקות לפני"/);
  const [, anchor, alarm] = html.match(/aria-label="הנץ מחר (\d\d:\d\d), השעון שלך (\d\d:\d\d)/);
  const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  assert.equal(toMin(anchor) - toMin(alarm), 25);
  assert.match(text(html), /הצג את 7 הימים הקרובים/);
  assert.match(text(html), /שבת \/ חג — שותק/, 'Shabbat is silent by default and the preview says so');
  assert.match(text(html), /גם בשבת ובחג כברירת מחדל השעון שותק בשבת ובחג\./);
  assert.match(text(html), /מחיקת השעון/);
  // Days: three equal choices; the custom row has seven equal days.
  const custom = render(editor.default, { initial: { ...sunrise, recurrence: 'custom', weekdays: [0, 2] }, isNew: false, settings, now: NOW, onDone: () => {} });
  assert.equal((custom.match(/aria-label="יום (ראשון|שני|שלישי|רביעי|חמישי|שישי)"|aria-label="שבת"/g) || []).length, 7);
  assert.match(custom, /aria-pressed="true" aria-label="יום ראשון" class="is-on">א</);
  // An event anchor recurs by itself — no week row.
  const omer = render(editor.default, { initial: normalizeRule({ id: 'o', mode: 'jewish', jewishAnchorId: 'omer', offsetMinutes: 10 }), isNew: false, settings, now: NOW, onDone: () => {} });
  assert.match(text(omer), /חוזר מעצמו: בלילות ספירת העומר בלבד/);
  assert.doesNotMatch(omer, /class="ja-week"/);
  // A fixed alarm uses the platform's own time picker.
  const fixed = render(editor.default, { initial: normalizeRule({ id: 'f', mode: 'fixed', fixedTime: '06:30' }), isNew: false, settings, now: NOW, onDone: () => {} });
  assert.match(fixed, /<input type="time" dir="ltr" value="06:30"/);
});

test('the custom amount: typed minutes with a numeric keyboard, ±5 steps and "90 דקות = שעה ו־30 דקות"', () => {
  const source = read('src/components/jewishAlarm/OffsetPicker.jsx');
  assert.match(source, /inputMode="numeric" pattern="\[0-9\]\*"/);
  assert.match(source, /aria-label="פחות 5 דקות"><span dir="ltr">−5<\/span>/);
  assert.match(source, /aria-label="עוד 5 דקות"><span dir="ltr">\+5<\/span>/);
  assert.match(source, /`\$\{value\} דקות = \$\{durationBreakdown\(value\)\}`/);
  assert.doesNotMatch(code(source), /wheel|<select/i, 'no minute wheel');
});

test('design: the alarm styles use the app\'s tokens only — no colour literals, no new gradients', () => {
  const css = read('src/styles/base.css');
  const block = css.slice(css.indexOf('/* ---------- השעון היהודי'), css.indexOf("/* ---------- The owner's review: השעון היהודי moved"));
  assert.ok(block.length > 1000);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|gradient\(/);
  assert.match(block, /\.ja-seg\{display:grid;grid-template-columns:repeat\(var\(--ja-parts,3\),minmax\(0,1fr\)\)/, 'equal segments');
  assert.match(block, /\.ja-quick\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, 'two even rows of four');
  assert.match(block, /\.ja-week\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(block, /\.ja-card\{position:relative;display:grid;grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/, 'the time truly centred');
  assert.match(block, /prefers-reduced-motion/);
  for (const size of [...block.matchAll(/min-height:(\d+)px/g)].map(m => Number(m[1]))) assert.ok(size >= 36, `min-height ${size}`);
});

test('iOS: AlarmKit behind runtime checks, the usage text, no Critical Alerts, the deployment target unchanged', () => {
  const plist = read('ios/App/App/Info.plist');
  assert.match(plist, /<key>NSAlarmKitUsageDescription<\/key>\s*<string>השעון היהודי משתמש בהרשאה כדי להפעיל שעונים שיצרתם לפי שעה קבועה או לפי זמני היום\.<\/string>/);
  assert.doesNotMatch(plist, /critical-alerts/);
  // The alarm needs no background mode; the only one allowed is 'audio' (התבודדות's sound with the screen locked).
  const modes = plist.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/);
  if (modes) assert.deepEqual([...modes[1].matchAll(/<string>([^<]*)<\/string>/g)].map(m => m[1]), ['audio']);
  const swift = read('ios/App/App/KZAlarmPlugin.swift');
  assert.match(swift, /#if canImport\(AlarmKit\)/);
  assert.match(swift, /if #available\(iOS 26\.0, \*\) \{ call\.resolve\(\["engine": "alarmkit"\]\); return \}/);
  assert.match(swift, /call\.resolve\(\["engine": "notifications"\]\)/, 'older iOS falls back to notifications');
  assert.match(swift, /AlarmManager\.shared\.requestAuthorization\(\)/);
  assert.match(swift, /\.fixed\(date\)/, 'absolute instants from the engine');
  assert.match(swift, /struct KZSnoozeIntent: LiveActivityIntent/);
  assert.doesNotMatch(code(swift), /sunrise|sunset|zman|tzeit/i, 'no halachic math in Swift');
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  assert.equal((project.match(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/g) || []).length, 4);
  assert.equal((project.match(/"-weak_framework",\n\t+AlarmKit,/g) || []).length, 2);
  assert.match(project, /KZAlarmPlugin\.swift in Sources/);
  for (const file of ['ios/App/App/App.entitlements', 'ios/App/App/App.Release.entitlements']) if (existsSync(new URL(`../${file}`, import.meta.url))) assert.doesNotMatch(read(file), /critical-alerts/);
  assert.match(read('ios/App/App/KZBridgeViewController.swift'), /bridge\?\.registerPluginInstance\(KZAlarmPlugin\(\)\)/);
});

test('Android: SCHEDULE_EXACT_ALARM (never USE_EXACT_ALARM), no full-screen intent, reboot restore of the user\'s alarms only', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<uses-permission android:name="android\.permission\.SCHEDULE_EXACT_ALARM" \/>/);
  assert.doesNotMatch(manifest, /<uses-permission android:name="android\.permission\.USE_EXACT_ALARM"/);
  assert.doesNotMatch(manifest, /USE_FULL_SCREEN_INTENT/);
  assert.match(manifest, /\.alarm\.KZAlarmRestoreReceiver" android:exported="false">[\s\S]*BOOT_COMPLETED[\s\S]*TIMEZONE_CHANGED[\s\S]*SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/);
  const store = read('android/app/src/main/java/com/kzohaar/app/alarm/KZAlarmStore.java');
  assert.match(store, /manager\.setAlarmClock\(info,/, 'exact alarm clocks');
  assert.match(store, /canScheduleExactAlarms\(\)/);
  assert.doesNotMatch(store, /setInexactRepeating|\.set\(AlarmManager|setWindow/, 'never an inexact fallback');
  assert.match(store, /AudioAttributes\.USAGE_ALARM/);
  const receiver = read('android/app/src/main/java/com/kzohaar/app/alarm/KZAlarmReceiver.java');
  assert.doesNotMatch(receiver, /setFullScreenIntent/);
  assert.match(receiver, /"עצירה"/);
  const plugin = read('android/app/src/main/java/com/kzohaar/app/alarm/KZAlarmPlugin.java');
  assert.match(plugin, /result\.put\("state", state\(\)\)/);
  assert.match(plugin, /"exact-denied"/);
  assert.doesNotMatch(code(plugin + store + receiver), /sunrise|sunset|zman|tzeit/i, 'no halachic math in Java');
  assert.match(read('android/app/src/main/java/com/kzohaar/app/MainActivity.java'), /registerPlugin\(KZAlarmPlugin\.class\);\n\t\tsuper\.onCreate/);
});

test('privacy: no server, no upload, no analytics — local storage only', () => {
  for (const file of ['src/pages/JewishAlarmPage.jsx', 'src/components/jewishAlarm/AlarmEditor.jsx', 'src/services/jewishAlarm/platform.mjs', 'src/services/jewishAlarm/store.mjs']) {
    assert.doesNotMatch(code(read(file)), /fetch\(|https?:\/\/|analytics|sendBeacon/, file);
  }
});

test('a new fixed alarm starts at the time it is now, to the minute, in the app\'s zone', async () => {
  const { wallTimeText } = await import('../src/services/jewishAlarm/engine.mjs');
  assert.equal(wallTimeText(new Date('2026-10-05T12:07:40Z'), 'Asia/Jerusalem'), '15:07');
  assert.equal(wallTimeText(new Date('2026-01-05T23:59:59Z'), 'Asia/Jerusalem'), '01:59');
  assert.equal(wallTimeText(new Date('2026-10-05T12:07:00Z'), 'America/New_York'), '08:07');
  assert.match(wallTimeText(new Date(), null), /^\d\d:\d\d$/, 'the device clock without a zone');
  const source = read('src/components/jewishAlarm/AlarmEditor.jsx');
  assert.match(source, /useState\(\(\) => \(isNew \? \{ \.\.\.initial, fixedTime: nowTime\(\) \} : \{ \.\.\.initial \}\)\)/, 'a new alarm opens at the current time; an edited one keeps its own');
  assert.match(source, /mode === 'fixed' && isNew && !timeTouched\.current \? \{ mode, fixedTime: nowTime\(\) \}/, 'refreshed when שעה קבועה is chosen, unless the user already set a time');
  memory.clear();
  const before = wallTimeText(Date.now(), settings.location.tzid);
  const html = render(editor.default, { initial: normalizeRule({ id: 'n1', mode: 'fixed', fixedTime: '06:30' }, { allowIncomplete: true }), isNew: true, settings, now: new Date(), onDone: () => {} });
  const shown = html.match(/type="time" dir="ltr" value="(\d\d:\d\d)"/)[1];
  assert.ok([before, wallTimeText(Date.now(), settings.location.tzid)].includes(shown), shown);
});
