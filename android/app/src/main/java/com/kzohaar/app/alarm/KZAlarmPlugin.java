package com.kzohaar.app.alarm;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * השעון היהודי — the Android bridge (JS name "KZAlarm"). Exact alarms through AlarmManager.setAlarmClock with the
 * SCHEDULE_EXACT_ALARM permission (never USE_EXACT_ALARM); if the permission is missing it says so ("exact-denied")
 * and never registers an inexact alarm in its place.
 */
@CapacitorPlugin(name = "KZAlarm", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class KZAlarmPlugin extends Plugin {

    @PluginMethod
    public void availability(PluginCall call) {
        JSObject result = new JSObject();
        result.put("engine", "android");
        call.resolve(result);
    }

    private String state() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            return getPermissionState("notifications") == PermissionState.DENIED ? "denied" : "prompt";
        }
        return KZAlarmStore.canScheduleExact(context) ? "granted" : "exact-denied";
    }

    @PluginMethod
    public void permissionState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", state());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotifications");
            return;
        }
        permissionState(call);
    }

    @PermissionCallback
    private void afterNotifications(PluginCall call) { permissionState(call); }

    @PluginMethod
    public void list(PluginCall call) {
        JSArray ids = new JSArray();
        long now = System.currentTimeMillis();
        for (KZAlarmStore.Entry e : KZAlarmStore.load(getContext())) if (!e.extra && e.at > now) ids.put(e.id);
        JSObject result = new JSObject();
        result.put("ids", ids);
        call.resolve(result);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Context context = getContext();
        JSArray alarms = call.getArray("alarms", new JSArray());
        List<KZAlarmStore.Entry> all = new ArrayList<>(KZAlarmStore.load(context));
        JSArray scheduled = new JSArray();
        try {
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject o = alarms.getJSONObject(i);
                KZAlarmStore.Entry e = new KZAlarmStore.Entry();
                e.id = o.optString("id", "");
                e.at = o.optLong("at", 0);
                e.title = o.optString("title", "השעון היהודי");
                e.body = o.optString("body", "");
                e.snoozeMinutes = o.optInt("snoozeMinutes", 10);
                e.sound = o.optString("sound", "default");
                e.vibration = o.optBoolean("vibration", true);
                if (e.id.isEmpty()) continue;
                KZAlarmStore.unregister(context, e.id);
                all.removeIf(item -> item.id.equals(e.id));
                if (KZAlarmStore.register(context, e)) { all.add(e); scheduled.put(e.id); }
            }
        } catch (Exception ignored) { }
        KZAlarmStore.save(context, all);
        JSObject result = new JSObject();
        result.put("scheduled", scheduled);
        result.put("limit", false);
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Context context = getContext();
        JSArray ids = call.getArray("ids", new JSArray());
        Set<String> gone = new HashSet<>();
        try { for (int i = 0; i < ids.length(); i++) gone.add(ids.getString(i)); } catch (Exception ignored) { }
        List<KZAlarmStore.Entry> kept = new ArrayList<>();
        for (KZAlarmStore.Entry e : KZAlarmStore.load(context)) {
            if (gone.contains(e.id)) KZAlarmStore.unregister(context, e.id); else kept.add(e);
        }
        KZAlarmStore.save(context, kept);
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String target = call.getString("target", "app");
        Intent intent;
        if ("exact".equals(target) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(intent); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        Context context = getContext();
        KZAlarmStore.Entry e = new KZAlarmStore.Entry();
        e.id = "test-" + UUID.randomUUID();
        e.at = System.currentTimeMillis() + 5000;
        e.title = call.getString("title", "בדיקת צליל");
        e.body = call.getString("body", "השעון היהודי");
        e.snoozeMinutes = 5;
        e.sound = call.getString("sound", "default");
        e.vibration = true;
        e.extra = true;
        boolean ok = KZAlarmStore.register(context, e);
        if (ok) { List<KZAlarmStore.Entry> all = new ArrayList<>(KZAlarmStore.load(context)); all.add(e); KZAlarmStore.save(context, all); }
        JSObject result = new JSObject();
        result.put("ok", ok);
        call.resolve(result);
    }
}
