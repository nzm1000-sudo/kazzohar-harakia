package com.kzohaar.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.TreeSet;

/**
 * The snapshot the web app computes (src/services/widgetSnapshot.mjs), kept in the app's own SharedPreferences.
 * {@link #stateAt} applies the same rules as widgetStateAt() in JavaScript (pinned by tests/widgetSnapshot.test.mjs):
 * the Jewish day that contains the instant, the first zman after it, the first Shabbat whose havdalah is still ahead,
 * and the ring (empty once the week has ended at Motzaei Shabbat). Private: nothing leaves the device.
 */
public final class KZWidgetSnapshot {
    static final String PREFS = "kz_widget";
    static final String KEY = "snapshot_v1";

    final JSONObject root;

    private KZWidgetSnapshot(JSONObject root) { this.root = root; }

    static boolean save(Context context, String json) {
        try {
            new JSONObject(json); // only a well-formed snapshot is kept
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    static KZWidgetSnapshot read(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY, null);
        if (json == null) return null;
        try { return new KZWidgetSnapshot(new JSONObject(json)); } catch (Exception ignored) { return null; }
    }

    String tzid() { return root.optString("tzid", TimeZone.getDefault().getID()); }

    String time(long ms) {
        SimpleDateFormat format = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("he-IL"));
        format.setTimeZone(TimeZone.getTimeZone(tzid()));
        return format.format(new Date(ms));
    }

    static final class State {
        JSONObject day;
        JSONObject next;
        JSONObject shabbat;
        int ring;
        int goal = 72;
        boolean stale;
    }

    State stateAt(long t) {
        State state = new State();
        state.day = first(root.optJSONArray("days"), item -> t >= item.optLong("from") && t < item.optLong("to"));
        state.next = first(root.optJSONArray("zmanim"), item -> item.optLong("at") > t);
        state.shabbat = first(root.optJSONArray("shabbat"), item -> item.optLong("havdalah") > t);
        JSONObject ring = root.optJSONObject("ring");
        if (ring != null) {
            state.goal = Math.max(1, ring.optInt("goal", 72));
            state.ring = t < ring.optLong("until", 0) ? ring.optInt("active", 0) : 0;
        }
        state.stale = t >= root.optLong("validUntil", 0);
        return state;
    }

    /** The first instant after {@code t} at which what the widget shows changes (a zman, a sunset, havdalah, the ring). */
    long nextChangeAfter(long t) {
        TreeSet<Long> instants = new TreeSet<>();
        collect(instants, root.optJSONArray("zmanim"), "at", t);
        collect(instants, root.optJSONArray("days"), "to", t);
        collect(instants, root.optJSONArray("shabbat"), "havdalah", t);
        JSONObject ring = root.optJSONObject("ring");
        if (ring != null && ring.optLong("until", 0) > t) instants.add(ring.optLong("until"));
        long validUntil = root.optLong("validUntil", 0);
        if (validUntil > t) instants.add(validUntil);
        return instants.isEmpty() ? -1 : instants.first();
    }

    private interface Test { boolean ok(JSONObject item); }

    private static JSONObject first(JSONArray list, Test test) {
        if (list == null) return null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item != null && test.ok(item)) return item;
        }
        return null;
    }

    private static void collect(TreeSet<Long> into, JSONArray list, String key, long after) {
        if (list == null) return;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item != null && item.optLong(key, 0) > after) into.add(item.optLong(key));
        }
    }
}
