package com.kzohaar.app.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * השעון היהודי — after a reboot, an app update, a manual clock change, a time-zone change or a change of the exact-alarm
 * permission, register the saved future alarms again. Only the user's own alarms; nothing else runs here.
 */
public class KZAlarmRestoreReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        KZAlarmStore.restore(context);
    }
}
