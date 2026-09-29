package com.kzohaar.app.alarm;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import com.kzohaar.app.MainActivity;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * השעון היהודי — the Android side's own record of what it registered, so an alarm survives a reboot, an app update and
 * a clock / time-zone change without the app being opened. It holds only ready absolute instants from the app's
 * engine; no zman is ever calculated here.
 */
public final class KZAlarmStore {
    static final String PREFS = "kz_jewish_alarm";
    static final String KEY = "alarms";
    static final String ACTION_FIRE = "com.kzohaar.app.alarm.FIRE";
    static final String ACTION_STOP = "com.kzohaar.app.alarm.STOP";
    static final String ACTION_SNOOZE = "com.kzohaar.app.alarm.SNOOZE";

    private KZAlarmStore() {}

    public static final class Entry {
        public String id;
        public long at;
        public String title;
        public String body;
        public int snoozeMinutes;
        public String sound;
        public boolean vibration;
        public boolean extra; // a snooze or a sound test: not part of the app's plan

        JSONObject toJson() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("at", at); o.put("title", title); o.put("body", body);
            o.put("snoozeMinutes", snoozeMinutes); o.put("sound", sound); o.put("vibration", vibration); o.put("extra", extra);
            return o;
        }

        static Entry fromJson(JSONObject o) {
            Entry e = new Entry();
            e.id = o.optString("id", "");
            e.at = o.optLong("at", 0);
            e.title = o.optString("title", "השעון היהודי");
            e.body = o.optString("body", "");
            e.snoozeMinutes = o.optInt("snoozeMinutes", 10);
            e.sound = o.optString("sound", "default");
            e.vibration = o.optBoolean("vibration", true);
            e.extra = o.optBoolean("extra", false);
            return e;
        }
    }

    static List<Entry> load(Context context) {
        List<Entry> out = new ArrayList<>();
        String text = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        try {
            JSONArray array = new JSONArray(text);
            for (int i = 0; i < array.length(); i++) {
                Entry e = Entry.fromJson(array.getJSONObject(i));
                if (!e.id.isEmpty()) out.add(e);
            }
        } catch (JSONException ignored) { }
        return out;
    }

    static void save(Context context, List<Entry> entries) {
        JSONArray array = new JSONArray();
        for (Entry e : entries) { try { array.put(e.toJson()); } catch (JSONException ignored) { } }
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString(KEY, array.toString());
        editor.apply();
    }

    static Entry find(Context context, String id) {
        for (Entry e : load(context)) if (e.id.equals(id)) return e;
        return null;
    }

    public static boolean canScheduleExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        return manager != null && manager.canScheduleExactAlarms();
    }

    private static PendingIntent firePendingIntent(Context context, String id, int flags) {
        Intent intent = new Intent(context, KZAlarmReceiver.class).setAction(ACTION_FIRE).putExtra("id", id);
        return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent openAppIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Registers one exact alarm clock (AlarmManager.setAlarmClock: exact, shown as the next alarm by the system). */
    static boolean register(Context context, Entry e) {
        if (e.at <= System.currentTimeMillis() || !canScheduleExact(context)) return false;
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return false;
        try {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(e.at, openAppIntent(context, e.id.hashCode()));
            manager.setAlarmClock(info, firePendingIntent(context, e.id, PendingIntent.FLAG_UPDATE_CURRENT));
            return true;
        } catch (SecurityException denied) {
            return false; // exact alarms were revoked: never fall back to an inexact alarm silently
        }
    }

    static void unregister(Context context, String id) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        PendingIntent pending = firePendingIntent(context, id, PendingIntent.FLAG_NO_CREATE);
        if (manager != null && pending != null) { manager.cancel(pending); pending.cancel(); }
    }

    /** After a reboot, an app update or a clock change: register again every future alarm that is still wanted. */
    static void restore(Context context) {
        List<Entry> kept = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (Entry e : load(context)) {
            if (e.at <= now) continue;
            register(context, e);
            kept.add(e);
        }
        save(context, kept);
    }

    // One channel per sound and vibration choice (a channel's sound cannot change once created). Alarm-stream audio.
    static String channel(Context context, String sound, boolean vibration) {
        String key = ("gentle".equals(sound) || "bold".equals(sound)) ? sound : "default";
        String id = "kz_alarm_" + key + (vibration ? "_v" : "_s");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return id;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(id) != null) return id;
        String name = "השעון היהודי · " + ("gentle".equals(key) ? "עדין" : "bold".equals(key) ? "בולט" : "ברירת המחדל") + (vibration ? "" : " · ללא רטט");
        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        Uri uri = RingtoneManager.getDefaultUri("gentle".equals(key) ? RingtoneManager.TYPE_NOTIFICATION : RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        channel.setSound(uri, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        channel.enableVibration(vibration);
        if (vibration) channel.setVibrationPattern("bold".equals(key) ? new long[] { 0, 700, 300, 700, 300, 700 } : new long[] { 0, 400, 300, 400 });
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(false);
        manager.createNotificationChannel(channel);
        return id;
    }
}
