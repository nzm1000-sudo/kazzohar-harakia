package com.kzohaar.app.widget;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The Android side of the widgets (JS name "KZWidgets", src/services/nativeWidgets.mjs): keeps the snapshot the app
 * computed and redraws every placed widget. The ways into the app (widget taps, app shortcuts) are plain
 * "kzohaar://open/…" intents that Capacitor's App plugin reports as appUrlOpen, so there is never a pending route here.
 */
@CapacitorPlugin(name = "KZWidgets")
public class KZWidgetsPlugin extends Plugin {

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json"); return; }
        boolean saved = KZWidgetSnapshot.save(getContext(), json);
        KZWidgetProvider.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("saved", saved);
        call.resolve(result);
    }

    /** The meat → dairy wait the widget's "אכלתי בשרי" wrote, for the app to take in when newer than its own. */
    @PluginMethod
    public void getMeatState(PluginCall call) {
        String json = KZWidgetSnapshot.meatWidgetJson(getContext());
        JSObject result = new JSObject();
        if (json != null) result.put("json", json);
        call.resolve(result);
    }

    @PluginMethod
    public void takePendingRoute(PluginCall call) {
        call.resolve(new JSObject());
    }
}
