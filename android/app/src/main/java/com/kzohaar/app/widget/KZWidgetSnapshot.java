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

    // ── The second set of widgets (KZMoreWidgets) — the same rules as widgetSnapshot.mjs ──────────────────────────

    /** The prayer of the hour (prayerStateAt): its window, the deadline still ahead, whether it has begun, the next. */
    static final class PrayerState {
        JSONObject current;
        JSONObject deadline;
        JSONObject opens;
        JSONObject next;
    }

    PrayerState prayerAt(long t) {
        JSONArray list = root.optJSONArray("prayers");
        if (list == null) return null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null || t < item.optLong("from") || t >= item.optLong("to")) continue;
            PrayerState state = new PrayerState();
            state.current = item;
            state.deadline = first(item.optJSONArray("ends"), mark -> mark.optLong("at") > t);
            JSONObject opens = item.optJSONObject("opens");
            state.opens = opens != null && opens.optLong("at") > t ? opens : null;
            state.next = i + 1 < list.length() ? list.optJSONObject(i + 1) : null;
            return state;
        }
        return null;
    }

    /** The next window of a prayer that has not begun yet (for the quartet's "מ־…"). */
    JSONObject upcomingPrayer(String key, long t) {
        return first(root.optJSONArray("prayers"), item -> key.equals(item.optString("key")) && item.optLong("from") > t);
    }

    /** The app's last weather reading: null after twelve hours (weatherStateAt). */
    JSONObject weatherAt(long t) {
        JSONObject weather = root.optJSONObject("weather");
        if (weather == null || t - weather.optLong("at") >= 12 * 3600000L) return null;
        return weather;
    }

    static boolean weatherDim(JSONObject weather, long t) { return t - weather.optLong("at") >= 3 * 3600000L; }

    /** The saying of the three-hour slot (sayingStateAt); past the carried slots, the same ones again. */
    JSONObject sayingAt(long t) {
        JSONObject sayings = root.optJSONObject("sayings");
        JSONArray items = sayings == null ? null : sayings.optJSONArray("items");
        long period = sayings == null ? 0 : sayings.optLong("period");
        if (items == null || items.length() == 0 || period <= 0) return null;
        long slot = Math.floorDiv(t - sayings.optLong("from"), period);
        return items.optJSONObject((int) Math.floorMod(slot, (long) items.length()));
    }

    /** The coming zmanim after {@code t}, at most {@code count}. */
    JSONObject[] zmanimAfter(long t, int count) {
        JSONArray list = root.optJSONArray("zmanim");
        java.util.ArrayList<JSONObject> out = new java.util.ArrayList<>();
        for (int i = 0; list != null && i < list.length() && out.size() < count; i++) {
            JSONObject item = list.optJSONObject(i);
            if (item != null && item.optLong("at") > t) out.add(item);
        }
        return out.toArray(new JSONObject[0]);
    }

    /** The second set's change instants: prayer boundaries and deadlines, saying slots, weather dimming and going. */
    void moreChanges(TreeSet<Long> into, long t) {
        JSONArray prayers = root.optJSONArray("prayers");
        for (int i = 0; prayers != null && i < prayers.length(); i++) {
            JSONObject item = prayers.optJSONObject(i);
            if (item == null) continue;
            for (long at : new long[] { item.optLong("from"), item.optLong("to"), item.optJSONObject("opens") == null ? 0 : item.optJSONObject("opens").optLong("at") }) if (at > t) into.add(at);
            collect(into, item.optJSONArray("ends"), "at", t);
        }
        JSONObject sayings = root.optJSONObject("sayings");
        long period = sayings == null ? 0 : sayings.optLong("period");
        if (period > 0) into.add(sayings.optLong("from") + (Math.floorDiv(t - sayings.optLong("from"), period) + 1) * period);
        JSONObject weather = root.optJSONObject("weather");
        if (weather != null) for (long at : new long[] { weather.optLong("at") + 3 * 3600000L, weather.optLong("at") + 12 * 3600000L }) if (at > t) into.add(at);
    }

    // ── אכלתי בשרי: the app's state rides in the snapshot; the widget's button writes its own; the later one wins ──
    static final String MEAT_KEY = "meat_v1";
    static final long HOUR = 3600000L;
    static final long LINGER = 3 * HOUR;

    /** The newer of the snapshot's meat record and the one the widget's button wrote. */
    static JSONObject meat(Context context, KZWidgetSnapshot snapshot) {
        JSONObject fromApp = snapshot == null ? null : snapshot.root.optJSONObject("meat");
        JSONObject fromWidget = null;
        try {
            String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(MEAT_KEY, null);
            if (json != null) fromWidget = new JSONObject(json);
        } catch (Exception ignored) { /* a broken record is ignored */ }
        if (fromApp == null) return fromWidget;
        if (fromWidget == null) return fromApp;
        return fromWidget.optLong("updatedAt") > fromApp.optLong("updatedAt") ? fromWidget : fromApp;
    }

    static String meatWidgetJson(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(MEAT_KEY, null);
    }

    static void startMeat(Context context, long now) {
        JSONObject current = meat(context, read(context));
        int preferred = current == null ? 6 : current.optInt("preferred", 6);
        if (preferred != 6 && preferred != 3) preferred = 6;
        try {
            JSONObject record = new JSONObject().put("startedAt", now).put("hours", preferred).put("preferred", preferred).put("updatedAt", now);
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(MEAT_KEY, record.toString()).apply();
        } catch (Exception ignored) { /* never */ }
    }

    static int meatHours(JSONObject meat) {
        int hours = meat == null ? 6 : meat.optInt("hours", 6);
        return hours == 3 || hours == 6 ? hours : 6;
    }

    static int meatPreferred(JSONObject meat) {
        int hours = meat == null ? 6 : meat.optInt("preferred", 6);
        return hours == 3 || hours == 6 ? hours : 6;
    }

    /** 0 at rest, 1 waiting, 2 "אפשר חלבי" (meatStateAt). */
    static int meatPhase(JSONObject meat, long t) {
        if (meat == null || meat.isNull("startedAt") || meat.optLong("startedAt", 0) <= 0) return 0;
        long end = meat.optLong("startedAt") + meatHours(meat) * HOUR;
        if (t > end + LINGER) return 0;
        return t < end ? 1 : 2;
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
