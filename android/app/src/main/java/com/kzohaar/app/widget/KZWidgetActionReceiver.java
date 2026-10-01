package com.kzohaar.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * The widgets' own broadcasts (not exported: only the app's PendingIntents send them):
 *   MEAT_START — "אכלתי בשרי" on the widget: starts the meat → dairy wait now, with the hours the user chose in the app
 *                (6, or 3). The app takes the record in on its next start or return (KZWidgetsPlugin.getMeatState) and
 *                then sets the end-of-wait reminder as its card does.
 *   TICK       — the single alarm at the next instant a widget changes (a zman, a sunset, a prayer's deadline, the
 *                saying's slot, the end of the wait): redraw them all. (A bare APPWIDGET_UPDATE without widget ids is
 *                dropped by AppWidgetProvider, so the alarm comes here.)
 */
public class KZWidgetActionReceiver extends BroadcastReceiver {
    static final String ACTION_MEAT_START = "com.kzohaar.app.widget.MEAT_START";
    static final String ACTION_TICK = "com.kzohaar.app.widget.TICK";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_MEAT_START.equals(action)) KZWidgetSnapshot.startMeat(context, System.currentTimeMillis());
        else if (!ACTION_TICK.equals(action)) return;
        KZWidgetProvider.updateAll(context);
    }
}
