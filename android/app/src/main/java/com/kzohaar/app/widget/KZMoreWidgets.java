package com.kzohaar.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import com.kzohaar.app.R;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.TimeZone;
import java.util.TreeSet;

/**
 * The second set of home-screen widgets, all from the snapshot the app wrote (src/services/widgetSnapshot.mjs), each
 * redrawn by the one alarm {@link KZWidgetProvider} sets at the next instant something changes:
 *   זמנים ומזג אוויר (4 × 2) · התפילה הבאה (2 × 2) · רביעיית תפילות (4 × 2) · אכלתי בשרי (2 × 2) · דברי חכמים (4 × 2)
 *   · ספירת העומר (2 × 2).
 * Taps open the app on a "kzohaar://open/…" route (a prayer: "kzohaar://open/prayer/<prayer>"), each area its own
 * PendingIntent. The meat → dairy wait counts down in a Chronometer by itself; "אכלתי בשרי" starts it from the widget
 * and a smaller "ביטול" stops it while it runs
 * through {@link KZWidgetActionReceiver}. The weather is the app's own last reading — nothing here touches the network.
 */
public final class KZMoreWidgets {
    private KZMoreWidgets() {}

    public abstract static class Provider extends AppWidgetProvider {
        protected abstract String kind();

        @Override
        public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { KZWidgetProvider.updateAll(context); }

        @Override
        public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { KZWidgetProvider.updateAll(context); }

        @Override
        public void onEnabled(Context context) { KZWidgetProvider.updateAll(context); }
    }

    static final Class<?>[] TYPES = { KZWidgetZmanim.class, KZWidgetPrayer.class, KZWidgetQuartet.class, KZWidgetMeat.class, KZWidgetSayings.class, KZWidgetOmer.class };

    /** Redraws every placed widget of the second set; adds the instants they next change at to {@code changes}. */
    static boolean updateAll(Context context, KZWidgetSnapshot snapshot, long now, TreeSet<Long> changes) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        boolean any = false;
        JSONObject meat = KZWidgetSnapshot.meat(context, snapshot);
        for (Class<?> type : TYPES) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, type));
            if (ids == null || ids.length == 0) continue;
            any = true;
            RemoteViews views;
            if (type == KZWidgetZmanim.class) views = zmanim(context, snapshot, now);
            else if (type == KZWidgetPrayer.class) views = prayer(context, snapshot, now);
            else if (type == KZWidgetQuartet.class) views = quartet(context, snapshot, now);
            else if (type == KZWidgetMeat.class) views = meat(context, snapshot, meat, now);
            else if (type == KZWidgetSayings.class) views = sayings(context, snapshot, now);
            else views = omer(context, snapshot, now);
            for (int id : ids) manager.updateAppWidget(id, views);
        }
        if (any) {
            if (snapshot != null) snapshot.moreChanges(changes, now);
            int phase = KZWidgetSnapshot.meatPhase(meat, now);
            if (phase != 0) {
                long end = meat.optLong("startedAt") + KZWidgetSnapshot.meatHours(meat) * KZWidgetSnapshot.HOUR;
                if (end > now) changes.add(end);
                if (end + KZWidgetSnapshot.LINGER > now) changes.add(end + KZWidgetSnapshot.LINGER);
            }
        }
        return any;
    }

    private static boolean ready(KZWidgetSnapshot snapshot, long now) {
        if (snapshot == null) return false;
        KZWidgetSnapshot.State state = snapshot.stateAt(now);
        return state.day != null && !state.stale;
    }

    private static void message(RemoteViews views, boolean ready) {
        views.setViewVisibility(R.id.kz_content, ready ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_message, ready ? View.GONE : View.VISIBLE);
    }

    private static boolean night(Context context) {
        return (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    // The Clay colours (res/values/kz_widget.xml; values-night: graphite). Gold is the ornament's; words take copper.
    private static int gold(Context context) { return KZWidgetProvider.color(context, R.color.kz_widget_gold); }
    private static int copper(Context context) { return KZWidgetProvider.color(context, R.color.kz_widget_copper); }
    private static int ink(Context context) { return KZWidgetProvider.color(context, R.color.kz_widget_ink); }
    private static int muted(Context context) { return KZWidgetProvider.color(context, R.color.kz_widget_muted); }

    private static boolean laterDay(KZWidgetSnapshot snapshot, long at, long now) {
        Calendar a = Calendar.getInstance(TimeZone.getTimeZone(snapshot.tzid()));
        Calendar b = Calendar.getInstance(TimeZone.getTimeZone(snapshot.tzid()));
        a.setTimeInMillis(at);
        b.setTimeInMillis(now);
        return a.get(Calendar.YEAR) * 400 + a.get(Calendar.DAY_OF_YEAR) > b.get(Calendar.YEAR) * 400 + b.get(Calendar.DAY_OF_YEAR);
    }

    private static String weatherGlyph(String kind) {
        switch (kind) {
            case "clear": return "☀︎";
            case "night": return "☾︎";
            case "partly": return "⛅︎";
            case "fog": return "≋";
            case "drizzle": case "rain": return "☂︎";
            case "snow": return "❄︎";
            case "storm": return "⚡︎";
            default: return "☁︎";
        }
    }

    // ── זמנים ומזג אוויר ────────────────────────────────────────────────────────────────────────────────────────
    private static final int[][] ZMAN_ROWS = {
        { R.id.kz_z0, R.id.kz_z0_name, R.id.kz_z0_time },
        { R.id.kz_z1, R.id.kz_z1_name, R.id.kz_z1_time },
        { R.id.kz_z2, R.id.kz_z2_name, R.id.kz_z2_time },
        { R.id.kz_z3, R.id.kz_z3_name, R.id.kz_z3_time },
        { R.id.kz_z4, R.id.kz_z4_name, R.id.kz_z4_time },
    };

    private static RemoteViews zmanim(Context context, KZWidgetSnapshot snapshot, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_zmanim);
        views.setOnClickPendingIntent(R.id.kz_root, KZWidgetProvider.open(context, "zmanim"));
        boolean ok = ready(snapshot, now);
        message(views, ok);
        if (!ok) return views;
        JSONObject day = snapshot.stateAt(now).day;
        views.setTextViewText(R.id.kz_day_month, day.optString("dayMonth"));
        views.setTextViewText(R.id.kz_weekday, "· " + day.optString("weekday"));
        JSONObject[] rows = snapshot.zmanimAfter(now, ZMAN_ROWS.length);
        for (int i = 0; i < ZMAN_ROWS.length; i++) {
            boolean has = i < rows.length;
            views.setViewVisibility(ZMAN_ROWS[i][0], has ? View.VISIBLE : View.INVISIBLE);
            if (!has) continue;
            long at = rows[i].optLong("at");
            String name = rows[i].optString("name") + (laterDay(snapshot, at, now) ? "  · מחר" : "");
            views.setTextViewText(ZMAN_ROWS[i][1], name);
            views.setTextViewText(ZMAN_ROWS[i][2], snapshot.time(at));
            int color = i == 0 ? copper(context) : ink(context);
            views.setTextColor(ZMAN_ROWS[i][1], color);
            views.setTextColor(ZMAN_ROWS[i][2], color);
        }
        JSONObject weather = snapshot.weatherAt(now);
        views.setViewVisibility(R.id.kz_wx, weather != null ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_wx_empty, weather != null ? View.GONE : View.VISIBLE);
        if (weather != null) {
            boolean dim = KZWidgetSnapshot.weatherDim(weather, now);
            views.setTextViewText(R.id.kz_wx_icon, weatherGlyph(weather.optString("kind")));
            views.setTextViewText(R.id.kz_wx_temp, weather.optInt("temp") + "°");
            views.setTextViewText(R.id.kz_wx_label, weather.optString("label"));
            boolean range = !weather.isNull("high") && !weather.isNull("low") && weather.has("high") && weather.has("low");
            views.setViewVisibility(R.id.kz_wx_range, range ? View.VISIBLE : View.GONE);
            if (range) views.setTextViewText(R.id.kz_wx_range, "↑" + weather.optInt("high") + "°  ↓" + weather.optInt("low") + "°");
            views.setTextViewText(R.id.kz_wx_updated, "עודכן " + snapshot.time(weather.optLong("at")));
            // A reading older than three hours is shown quieter (muted, not ink), with its time.
            views.setTextColor(R.id.kz_wx_temp, dim ? muted(context) : ink(context));
            views.setTextColor(R.id.kz_wx_icon, dim ? muted(context) : gold(context));
            views.setContentDescription(R.id.kz_wx, "מזג האוויר: " + weather.optInt("temp") + " מעלות, " + weather.optString("label") + ", עודכן ב־" + snapshot.time(weather.optLong("at")));
        }
        return views;
    }

    // ── התפילה הבאה ────────────────────────────────────────────────────────────────────────────────────────────
    private static RemoteViews prayer(Context context, KZWidgetSnapshot snapshot, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_prayer);
        KZWidgetSnapshot.PrayerState state = snapshot == null ? null : snapshot.prayerAt(now);
        boolean ok = ready(snapshot, now) && state != null;
        message(views, ok);
        views.setOnClickPendingIntent(R.id.kz_root, KZWidgetProvider.open(context, ok ? "prayer/" + state.current.optString("key") : "today"));
        if (!ok) return views;
        views.setTextViewText(R.id.kz_pr_header, state.opens != null ? state.opens.optString("name") + " " + snapshot.time(state.opens.optLong("at")) : "התפילה עכשיו");
        views.setTextViewText(R.id.kz_pr_name, state.current.optString("name"));
        boolean deadline = state.deadline != null;
        views.setViewVisibility(R.id.kz_pr_well, deadline ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_pr_deadline, deadline ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_pr_timer, deadline ? View.VISIBLE : View.GONE);
        if (deadline) {
            long at = state.deadline.optLong("at");
            views.setTextViewText(R.id.kz_pr_deadline, state.deadline.optString("name") + " " + snapshot.time(at));
            countdown(views, R.id.kz_pr_timer, at, now);
        }
        return views;
    }

    // A Chronometer that counts down to {@code at} by itself (API 24+); the widget is redrawn at {@code at} anyway.
    private static void countdown(RemoteViews views, int id, long at, long now) {
        views.setChronometer(id, SystemClock.elapsedRealtime() + (at - now), null, true);
        views.setChronometerCountDown(id, true);
    }

    // ── רביעיית תפילות ─────────────────────────────────────────────────────────────────────────────────────────
    private static final String[] DOORS = { "shacharit", "mincha", "maariv", "birkat-hamazon" };
    private static final String[] DOOR_NAMES = { "שחרית", "מנחה", "ערבית", "ברכת המזון" };
    private static final int[][] DOOR_IDS = {
        { R.id.kz_q0, R.id.kz_q0_name, R.id.kz_q0_hint },
        { R.id.kz_q1, R.id.kz_q1_name, R.id.kz_q1_hint },
        { R.id.kz_q2, R.id.kz_q2_name, R.id.kz_q2_hint },
        { R.id.kz_q3, R.id.kz_q3_name, R.id.kz_q3_hint },
    };

    private static RemoteViews quartet(Context context, KZWidgetSnapshot snapshot, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_quartet);
        KZWidgetSnapshot.PrayerState state = snapshot == null ? null : snapshot.prayerAt(now);
        JSONObject day = snapshot == null ? null : snapshot.stateAt(now).day;
        views.setTextViewText(R.id.kz_q_title, day != null ? "תפילות · " + day.optString("dayMonth") : "תפילות");
        for (int i = 0; i < DOORS.length; i++) {
            String key = DOORS[i];
            boolean current = state != null && key.equals(state.current.optString("key"));
            String hint;
            if (i == 3) hint = "אחרי הסעודה";
            else if (current) hint = state.deadline != null ? "עד " + snapshot.time(state.deadline.optLong("at")) : "";
            else {
                JSONObject upcoming = snapshot == null ? null : snapshot.upcomingPrayer(key, now);
                JSONObject opens = upcoming == null ? null : upcoming.optJSONObject("opens");
                hint = upcoming == null ? "" : "מ־" + snapshot.time(opens != null ? opens.optLong("at") : upcoming.optLong("from"));
            }
            views.setTextViewText(DOOR_IDS[i][1], DOOR_NAMES[i]);
            views.setTextViewText(DOOR_IDS[i][2], hint);
            // The prayer of the hour: sunk, a thin copper outline, copper words — never a filled door.
            views.setTextColor(DOOR_IDS[i][1], current ? copper(context) : ink(context));
            views.setTextColor(DOOR_IDS[i][2], current ? copper(context) : muted(context));
            views.setInt(DOOR_IDS[i][0], "setBackgroundResource", current ? R.drawable.kz_widget_tile_now : R.drawable.kz_widget_tile);
            views.setOnClickPendingIntent(DOOR_IDS[i][0], KZWidgetProvider.open(context, "prayer/" + key));
            views.setContentDescription(DOOR_IDS[i][0], DOOR_NAMES[i] + (hint.isEmpty() ? "" : ", " + hint) + " — פותח בסידור");
        }
        return views;
    }

    // ── אכלתי בשרי ─────────────────────────────────────────────────────────────────────────────────────────────
    private static RemoteViews meat(Context context, KZWidgetSnapshot snapshot, JSONObject meat, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_meat);
        int phase = KZWidgetSnapshot.meatPhase(meat, now);
        views.setViewVisibility(R.id.kz_meat_idle, phase == 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_meat_waiting, phase == 1 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_meat_done, phase == 2 ? View.VISIBLE : View.GONE);
        views.setOnClickPendingIntent(R.id.kz_root, KZWidgetProvider.open(context, "meat"));
        PendingIntent start = PendingIntent.getBroadcast(context, 7373, new Intent(context, KZWidgetActionReceiver.class).setAction(KZWidgetActionReceiver.ACTION_MEAT_START),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.kz_meat_start, start);
        views.setOnClickPendingIntent(R.id.kz_meat_again, start);
        // "ביטול" while the wait runs: its own broadcast (its own request code), so it can never be the start.
        PendingIntent cancel = PendingIntent.getBroadcast(context, 7374, new Intent(context, KZWidgetActionReceiver.class).setAction(KZWidgetActionReceiver.ACTION_MEAT_CANCEL),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.kz_meat_cancel, cancel);
        if (phase == 0) {
            views.setTextViewText(R.id.kz_meat_rest, "המתנה של " + KZWidgetSnapshot.meatPreferred(meat) + " שעות");
            return views;
        }
        long startedAt = meat.optLong("startedAt");
        int hours = KZWidgetSnapshot.meatHours(meat);
        long end = startedAt + hours * KZWidgetSnapshot.HOUR;
        String endText = snapshot != null ? snapshot.time(end) : clock(end);
        if (phase == 1) {
            countdown(views, R.id.kz_meat_timer, end, now);
            views.setTextViewText(R.id.kz_meat_until, "חלבי מ־" + endText);
            views.setContentDescription(R.id.kz_meat_until, "חלבי מ־" + endText + ", אכלתי ב־" + (snapshot != null ? snapshot.time(startedAt) : clock(startedAt)) + ", " + hours + " שעות");
        } else {
            views.setTextViewText(R.id.kz_meat_done_since, "מאז " + endText);
        }
        return views;
    }

    private static String clock(long ms) {
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.forLanguageTag("he-IL"));
        return format.format(new java.util.Date(ms));
    }

    // ── דברי חכמים ─────────────────────────────────────────────────────────────────────────────────────────────
    private static RemoteViews sayings(Context context, KZWidgetSnapshot snapshot, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_sayings);
        views.setOnClickPendingIntent(R.id.kz_root, KZWidgetProvider.open(context, "sayings"));
        JSONObject saying = snapshot == null ? null : snapshot.sayingAt(now);
        message(views, saying != null);
        if (saying == null) return views;
        views.setTextViewText(R.id.kz_saying_text, saying.optString("text"));
        views.setTextViewText(R.id.kz_saying_source, saying.optString("source"));
        return views;
    }

    // ── ספירת העומר ────────────────────────────────────────────────────────────────────────────────────────────
    private static RemoteViews omer(Context context, KZWidgetSnapshot snapshot, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.kz_widget_omer);
        boolean ok = ready(snapshot, now);
        message(views, ok);
        int day = ok ? snapshot.stateAt(now).day.optInt("omer", 0) : 0;
        views.setOnClickPendingIntent(R.id.kz_root, KZWidgetProvider.open(context, day > 0 ? "prayer/omer" : "today"));
        if (!ok) return views;
        float density = context.getResources().getDisplayMetrics().density;
        views.setViewVisibility(R.id.kz_omer_ring, day > 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_omer_after, day > 0 ? View.GONE : View.VISIBLE);
        if (day > 0) {
            views.setImageViewBitmap(R.id.kz_omer_ring, ring(day, Math.round(70 * density), context));
            views.setContentDescription(R.id.kz_omer_ring, "היום " + day + " לעומר");
            views.setTextViewText(R.id.kz_omer_line, day < 7 ? omerWords(day) : "היום " + day + " לעומר");
            views.setViewVisibility(R.id.kz_omer_sub, day >= 7 ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.kz_omer_sub, omerWords(day));
        } else {
            views.setTextViewText(R.id.kz_omer_line, omerAnswer(snapshot, now));
            views.setViewVisibility(R.id.kz_omer_sub, View.GONE);
        }
        return views;
    }

    static String omerWords(int day) {
        int weeks = day / 7, days = day % 7;
        if (weeks == 0) return day == 1 ? "יום אחד לעומר" : day + " ימים לעומר";
        String weeksText = weeks == 1 ? "שבוע אחד" : weeks + " שבועות";
        return days == 0 ? "שהם " + weeksText : "שהם " + weeksText + " " + (days == 1 ? "ויום אחד" : "ו־" + days + " ימים");
    }

    // The same words as omerAnswer() in JavaScript, outside the count.
    private static String omerAnswer(KZWidgetSnapshot snapshot, long now) {
        JSONObject omer = snapshot.root.optJSONObject("omer");
        long starts = omer == null || omer.isNull("startsAt") ? 0 : omer.optLong("startsAt", 0);
        if (starts > 0) {
            long inDays = (long) Math.ceil((starts - now) / 86400000.0);
            if (inDays == 1) return "ספירת העומר מתחילה הערב";
            if (inDays > 1) return "ספירת העומר מתחילה בעוד " + inDays + " ימים";
        }
        return "אין ספירת העומר היום";
    }

    // The count of 49 on a raised clay plate: the gold band (the Omer's own colour), the day sunk in its centre.
    private static Bitmap ring(int day, int size, Context context) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        RectF disc = KZWidgetProvider.plate(canvas, size, context);
        float d = disc.width();
        float stroke = d * 0.09f;
        float inset = d * 0.12f;
        RectF box = new RectF(disc.left + inset, disc.top + inset, disc.right - inset, disc.bottom - inset);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setColor(gold(context));
        paint.setAlpha(night(context) ? 66 : 61);
        canvas.drawOval(box, paint);
        paint.setAlpha(255);
        paint.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(box, -90f, -360f * day / 49f, false, paint);
        float hole = d * 0.21f;
        KZWidgetProvider.hollow(canvas, new RectF(disc.left + hole, disc.top + hole, disc.right - hole, disc.bottom - hole), context);
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(ink(context));
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
        text.setTextSize(d * 0.34f);
        Paint.FontMetrics metrics = text.getFontMetrics();
        canvas.drawText(String.valueOf(day), disc.centerX(), disc.centerY() - (metrics.ascent + metrics.descent) / 2f, text);
        return bitmap;
    }
}
