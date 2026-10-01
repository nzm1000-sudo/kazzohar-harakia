// How the app shares the platforms' pending-notification limits between its features. One table, so no feature can
// silently crowd out another.
//
//   • iOS (UNUserNotificationCenter): at most 64 pending local notifications per app; beyond that the system drops
//     requests. The app's local notifications are: the Jewish alarm's fallback (only iOS < 26 — on iOS 26 the alarm rings
//     through AlarmKit, outside this pool), נר זיכרון, the reminders (תזכורות), and the Shabbat preparation summary, the
//     meat–dairy timer and the sound test (a handful together).
//         alarm fallback 24 + memorial 12 + reminders 18 + preparation / single 10 = 64
//     With AlarmKit (iOS 26+) the alarm's 24 go to the reminders (42).
//   • Android: local notifications are AlarmManager entries (at most 500 pending per app on API 31+); the alarm itself
//     keeps 100 of them, so the reminders take 60 and נר זיכרון 24.
//   • Web: nothing is scheduled (a closed page cannot notify).
// Every feature schedules its nearest entries first and refills the horizon on each launch and return to the app
// (rolling scheduling), so a small budget never loses a reminder — it only schedules it later.
export const IOS_PENDING_LIMIT = 64;

export const NOTIFICATION_BUDGET = Object.freeze({
  ios: Object.freeze({ alarmFallback: 24, memorial: 12, reminders: 18, other: 10 }),
  android: Object.freeze({ alarmFallback: 0, memorial: 24, reminders: 60, other: 10 }),
  web: Object.freeze({ alarmFallback: 0, memorial: 0, reminders: 0, other: 0 }),
});

// The reminders' share on a platform, given the engine the Jewish alarm uses there ('alarmkit' frees the fallback's share).
export function remindersBudget(platform, alarmEngine = null) {
  if (platform === 'ios') return NOTIFICATION_BUDGET.ios.reminders + (alarmEngine === 'alarmkit' ? NOTIFICATION_BUDGET.ios.alarmFallback : 0);
  if (platform === 'android') return NOTIFICATION_BUDGET.android.reminders;
  return 0;
}

export const memorialBudget = platform => (platform === 'android' ? NOTIFICATION_BUDGET.android.memorial : NOTIFICATION_BUDGET.ios.memorial);
