package com.kzohaar.app.alarm;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;

import com.kzohaar.app.R;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** השעון היהודי — an alarm rings: a high-priority alarm notification (alarm audio, looping until stopped) with עצירה / נודניק. */
public class KZAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String id = intent.getStringExtra("id");
        if (id == null) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (KZAlarmStore.ACTION_STOP.equals(action)) {
            if (manager != null) manager.cancel(id.hashCode());
            return;
        }
        if (KZAlarmStore.ACTION_SNOOZE.equals(action)) {
            if (manager != null) manager.cancel(id.hashCode());
            KZAlarmStore.Entry source = KZAlarmStore.find(context, id);
            KZAlarmStore.Entry snooze = new KZAlarmStore.Entry();
            snooze.id = "snooze-" + UUID.randomUUID();
            snooze.title = source != null ? source.title : intent.getStringExtra("title");
            snooze.body = "נודניק";
            snooze.snoozeMinutes = source != null ? source.snoozeMinutes : intent.getIntExtra("minutes", 10);
            snooze.sound = source != null ? source.sound : "default";
            snooze.vibration = source == null || source.vibration;
            snooze.extra = true;
            snooze.at = System.currentTimeMillis() + snooze.snoozeMinutes * 60000L;
            List<KZAlarmStore.Entry> all = new ArrayList<>(KZAlarmStore.load(context));
            all.add(snooze);
            KZAlarmStore.save(context, all);
            KZAlarmStore.register(context, snooze);
            return;
        }
        // FIRE
        KZAlarmStore.Entry entry = KZAlarmStore.find(context, id);
        if (entry == null) return; // cancelled meanwhile
        List<KZAlarmStore.Entry> rest = new ArrayList<>();
        for (KZAlarmStore.Entry e : KZAlarmStore.load(context)) if (!e.id.equals(id)) rest.add(e);
        KZAlarmStore.save(context, rest);
        if (manager == null) return;
        String channel = KZAlarmStore.channel(context, entry.sound, entry.vibration);
        int code = id.hashCode();
        PendingIntent stop = PendingIntent.getBroadcast(context, code ^ 0x5157, new Intent(context, KZAlarmReceiver.class).setAction(KZAlarmStore.ACTION_STOP).putExtra("id", id), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent snooze = PendingIntent.getBroadcast(context, code ^ 0x2222, new Intent(context, KZAlarmReceiver.class).setAction(KZAlarmStore.ACTION_SNOOZE).putExtra("id", id).putExtra("title", entry.title).putExtra("minutes", entry.snoozeMinutes), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_jewish_alarm)
            .setContentTitle(entry.title)
            .setContentText(entry.body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(KZAlarmStore.openAppIntent(context, code))
            .setDeleteIntent(stop)
            .addAction(0, "עצירה", stop)
            .addAction(0, "נודניק · " + entry.snoozeMinutes + " דק׳", snooze);
        Notification notification = builder.build();
        // "ברירת המחדל" and "בולט" ring until stopped; "עדין" sounds once.
        if (!"gentle".equals(entry.sound)) notification.flags |= Notification.FLAG_INSISTENT;
        try { manager.notify(code, notification); } catch (SecurityException noPermission) { /* notifications were turned off */ }
    }
}
