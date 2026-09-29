// השעון היהודי — the platform adapters (the only file that talks to native code).
//   • iOS 26+: the app's KZAlarm plugin → Apple AlarmKit (a real alarm: rings in silent mode per the system's alarm
//     rules, full-screen system presentation, stop and snooze).
//   • iOS < 26 (or a build without the plugin): local notifications (@capacitor/local-notifications, already in the
//     app) — a notification with sound; it does not bypass silent mode and we never claim it does.
//   • Android: the app's KZAlarm plugin → AlarmManager.setAlarmClock (exact; SCHEDULE_EXACT_ALARM), restored after
//     reboot from its own saved list.
//   • Web: no adapter — a browser cannot ring an alarm while the app is closed, so none is pretended.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const KZAlarm = registerPlugin('KZAlarm');
const ms = iso => new Date(iso).getTime();

const alarmKitAdapter = {
  engine: 'alarmkit',
  async permission() { const { state } = await KZAlarm.permissionState(); return state; },
  async request() { const { state } = await KZAlarm.requestPermission(); return state; },
  async list() { const { ids } = await KZAlarm.list(); return Array.isArray(ids) ? ids : null; },
  async schedule(entries) { return KZAlarm.schedule({ alarms: entries.map(item => ({ id: item.id, at: ms(item.at), title: item.title, body: item.body, snoozeMinutes: item.snoozeMinutes, sound: item.sound, vibration: item.vibration })) }); },
  async cancel(ids) { if (ids.length) await KZAlarm.cancel({ ids }); },
  async openSettings() { await KZAlarm.openSettings({ target: 'app' }); },
  async test(sound) { const { ok } = await KZAlarm.test({ sound, title: 'בדיקת צליל', body: 'השעון היהודי' }); return Boolean(ok); },
};

const androidAdapter = { ...alarmKitAdapter, engine: 'android', async openSettings(target = 'app') { await KZAlarm.openSettings({ target }); } };

// The fallback: one local notification per occurrence, marked as ours so reconciliation never touches other reminders.
const notificationAdapter = {
  engine: 'notifications',
  async permission() { const result = await LocalNotifications.checkPermissions(); return result?.display === 'granted' ? 'granted' : result?.display === 'denied' ? 'denied' : 'prompt'; },
  async request() { const result = await LocalNotifications.requestPermissions(); return result?.display === 'granted' ? 'granted' : 'denied'; },
  async list() {
    const { notifications = [] } = await LocalNotifications.getPending();
    return notifications.filter(item => item?.extra?.kind === 'jewish-alarm').map(item => String(item.id));
  },
  async schedule(entries) {
    await LocalNotifications.schedule({ notifications: entries.map(item => ({ id: Number(item.id), title: item.title, body: item.body, schedule: { at: new Date(item.at), allowWhileIdle: true }, extra: { kind: 'jewish-alarm', key: item.key } })) });
    return { scheduled: entries.map(item => item.id) };
  },
  async cancel(ids) { if (ids.length) await LocalNotifications.cancel({ notifications: ids.map(id => ({ id: Number(id) })) }); },
  async openSettings() { try { await KZAlarm.openSettings({ target: 'app' }); } catch { /* older build: nothing to open */ } },
  async test() {
    await LocalNotifications.schedule({ notifications: [{ id: 2147483100, title: 'בדיקת צליל', body: 'השעון היהודי', schedule: { at: new Date(Date.now() + 5000) } }] });
    return true;
  },
};

const noneAdapter = { engine: 'none' };

let cached = null;
export async function platformAdapter() {
  if (cached) return cached;
  if (!Capacitor.isNativePlatform()) return (cached = noneAdapter);
  try {
    const { engine } = await KZAlarm.availability();
    if (engine === 'alarmkit') return (cached = alarmKitAdapter);
    if (engine === 'android') return (cached = androidAdapter);
  } catch { /* the plugin is missing in this build */ }
  return (cached = notificationAdapter);
}

export const platformName = () => { try { return Capacitor.getPlatform(); } catch { return 'web'; } };
