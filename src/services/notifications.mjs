import { LocalNotifications } from '@capacitor/local-notifications';
import { diffSchedule, scheduleRecord } from './notificationEngine.mjs';

const available = () => {
  try { return typeof LocalNotifications?.schedule === 'function'; } catch { return false; }
};

/** Permission is only ever requested from an explicit user opt-in. */
export async function requestNotificationPermission() {
  if (!available()) return 'unsupported';
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current?.display === 'granted') return 'granted';
    const result = await LocalNotifications.requestPermissions();
    return result?.display || 'denied';
  } catch { return 'denied'; }
}

export async function notificationPermissionState() {
  if (!available()) return 'unsupported';
  try { return (await LocalNotifications.checkPermissions())?.display || 'prompt'; }
  catch { return 'prompt'; }
}

export async function applySchedule(previous, notifications) {
  if (!available()) return { applied: false, scheduled: scheduleRecord(notifications) };
  const { toSchedule, toCancel } = diffSchedule(previous, notifications);
  try {
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel.map(id => ({ id })) });
    if (toSchedule.length) {
      await LocalNotifications.schedule({
        notifications: toSchedule.map(item => ({
          id: item.id,
          title: item.title,
          body: item.body,
          schedule: { at: new Date(item.at), allowWhileIdle: true },
          extra: { key: item.key, category: item.category },
        })),
      });
    }
    return { applied: true, scheduled: scheduleRecord(notifications) };
  } catch {
    return { applied: false, scheduled: scheduleRecord(notifications) };
  }
}

export async function cancelAllScheduled(previous = {}) {
  const ids = Object.values(previous).map(item => item.id).filter(Boolean);
  if (!available() || !ids.length) return;
  try { await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) }); } catch { /* nothing scheduled */ }
}

export async function sendTestNotification() {
  if (!available()) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: 2147483000,
        title: 'כזוהר הרקיע',
        body: 'בדיקת תזכורת. ההתראות פועלות.',
        schedule: { at: new Date(Date.now() + 5000) },
      }],
    });
    return true;
  } catch { return false; }
}
