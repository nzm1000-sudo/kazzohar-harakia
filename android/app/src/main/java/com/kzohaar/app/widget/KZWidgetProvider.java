package com.kzohaar.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import com.kzohaar.app.MainActivity;
import com.kzohaar.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "כזוהר הרקיע" on the home screen: small (the date, the ring, the next zman) and medium (with the parasha, candle
 * lighting / havdalah and the tzaddik of the day). Drawn from the snapshot the app wrote; an alarm wakes the widget at
 * the next instant something changes (a zman, a sunset, havdalah, the end of the ring's week), so the next zman advances
 * on time without the app being opened. A tap opens the app on the matching screen ("kzohaar://open/…").
 */
public abstract class KZWidgetProvider extends AppWidgetProvider {

    protected abstract boolean medium();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { updateAll(context); }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { updateAll(context); }

    @Override
    public void onEnabled(Context context) { updateAll(context); }

    /** Redraws every placed widget of both sizes and sets the alarm for the next change. */
    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        KZWidgetSnapshot snapshot = KZWidgetSnapshot.read(context);
        long now = System.currentTimeMillis();
        boolean any = false;
        for (Class<?> type : new Class<?>[] { KZWidgetSmall.class, KZWidgetMedium.class }) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, type));
            if (ids == null || ids.length == 0) continue;
            any = true;
            boolean isMedium = type == KZWidgetMedium.class;
            for (int id : ids) manager.updateAppWidget(id, render(context, snapshot, now, isMedium));
        }
        // The second set (KZMoreWidgets): their own change instants join the same single alarm.
        java.util.TreeSet<Long> changes = new java.util.TreeSet<>();
        boolean more = KZMoreWidgets.updateAll(context, snapshot, now, changes);
        if (any && snapshot != null) { long next = snapshot.nextChangeAfter(now); if (next > 0) changes.add(next); }
        if (any || more) schedule(context, changes.isEmpty() ? -1 : changes.first());
    }

    private static RemoteViews render(Context context, KZWidgetSnapshot snapshot, long now, boolean medium) {
        RemoteViews views = new RemoteViews(context.getPackageName(), medium ? R.layout.kz_widget_medium : R.layout.kz_widget_small);
        KZWidgetSnapshot.State state = snapshot == null ? null : snapshot.stateAt(now);
        boolean ready = state != null && state.day != null && !state.stale;
        views.setViewVisibility(R.id.kz_content, ready ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.kz_message, ready ? View.GONE : View.VISIBLE);
        views.setOnClickPendingIntent(R.id.kz_root, open(context, ready && !medium ? "zmanim" : "today"));
        if (!ready) return views;

        JSONObject day = state.day;
        boolean night = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        float density = context.getResources().getDisplayMetrics().density;
        views.setImageViewBitmap(R.id.kz_ring, ring(state.ring, state.goal, Math.round((medium ? 60 : 44) * density), night));
        views.setContentDescription(R.id.kz_ring, "המעגל הרוחני: " + state.ring + " מתוך " + state.goal);

        if (!medium) {
            if (state.next != null) {
                views.setTextViewText(R.id.kz_next_name, state.next.optString("name"));
                views.setTextViewText(R.id.kz_next_time, snapshot.time(state.next.optLong("at")));
            }
            views.setViewVisibility(R.id.kz_next_box, state.next != null ? View.VISIBLE : View.INVISIBLE);
            views.setTextViewText(R.id.kz_day_month, day.optString("dayMonth"));
            views.setTextViewText(R.id.kz_weekday, day.optString("weekday"));
            return views;
        }

        views.setTextViewText(R.id.kz_date, day.optString("date"));
        String parasha = day.isNull("parasha") ? "" : day.optString("parasha", "");
        views.setTextViewText(R.id.kz_weekday, parasha.isEmpty() ? day.optString("weekday") : day.optString("weekday") + " · " + parasha);
        views.setTextViewText(R.id.kz_goal, "מתוך " + state.goal);

        // The next three zmanim in sequence, evenly spaced (candle lighting / havdalah open the parasha page).
        java.util.List<JSONObject> upcoming = snapshot.upcoming(now, 3);
        int[][] slots = { { R.id.kz_up_box_0, R.id.kz_up_name_0, R.id.kz_up_time_0 }, { R.id.kz_up_box_1, R.id.kz_up_name_1, R.id.kz_up_time_1 }, { R.id.kz_up_box_2, R.id.kz_up_name_2, R.id.kz_up_time_2 } };
        for (int i = 0; i < slots.length; i++) {
            JSONObject zman = i < upcoming.size() ? upcoming.get(i) : null;
            views.setViewVisibility(slots[i][0], zman != null ? View.VISIBLE : View.INVISIBLE);
            if (zman == null) continue;
            String key = zman.optString("key");
            views.setTextViewText(slots[i][1], zman.optString("name"));
            views.setTextViewText(slots[i][2], snapshot.time(zman.optLong("at")));
            views.setOnClickPendingIntent(slots[i][0], open(context, "candles".equals(key) || "havdalah".equals(key) ? "parasha" : "zmanim"));
        }

        JSONArray names = day.optJSONArray("tzaddik");
        int count = day.optInt("tzaddikCount", 0);
        if (names != null && names.length() > 0) {
            views.setTextViewText(R.id.kz_tzaddik, "נר ה׳ · " + names.optString(0) + (count > 1 ? " ועוד " + (count - 1) : ""));
            views.setViewVisibility(R.id.kz_tzaddik, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.kz_tzaddik, View.GONE);
        }
        views.setOnClickPendingIntent(R.id.kz_ring_box, open(context, "ring"));
        return views;
    }

    // The ring: a quiet gold track, the open circle's arc (drawn from the top, toward the reading direction), the count.
    private static Bitmap ring(int value, int goal, int size, boolean night) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        int gold = night ? Color.rgb(212, 178, 90) : Color.rgb(184, 145, 47);
        int ink = night ? Color.rgb(243, 238, 226) : Color.rgb(36, 30, 23);
        float stroke = size * 0.09f;
        RectF box = new RectF(stroke / 2 + 1, stroke / 2 + 1, size - stroke / 2 - 1, size - stroke / 2 - 1);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setColor(gold);
        paint.setAlpha(night ? 56 : 51);
        canvas.drawOval(box, paint);
        float sweep = 360f * Math.max(0f, Math.min(1f, value / (float) Math.max(1, goal)));
        if (sweep > 0) {
            paint.setAlpha(255);
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawArc(box, -90f, -sweep, false, paint);
        }
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(ink);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        text.setTextSize(size * 0.34f);
        Paint.FontMetrics metrics = text.getFontMetrics();
        canvas.drawText(String.valueOf(value), size / 2f, size / 2f - (metrics.ascent + metrics.descent) / 2f, text);
        return bitmap;
    }

    static PendingIntent open(Context context, String route) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("kzohaar://open/" + route), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, route.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // One alarm for all the widgets, a second after the next change. Exact when the app may (the alarm permission the
    // user already gave השעון היהודי); otherwise the system's allowed-while-idle alarm, and the half-hourly update as a floor.
    private static void schedule(Context context, long at) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, KZWidgetActionReceiver.class).setAction(KZWidgetActionReceiver.ACTION_TICK);
        PendingIntent pending = PendingIntent.getBroadcast(context, 7272, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (alarms == null) return;
        alarms.cancel(pending);
        if (at <= 0) return;
        long when = at + 1000;
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC, when, pending);
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC, when, pending);
        } catch (SecurityException ignored) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC, when, pending);
        }
    }
}
