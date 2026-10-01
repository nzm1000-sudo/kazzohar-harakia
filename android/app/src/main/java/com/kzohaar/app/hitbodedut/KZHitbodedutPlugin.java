package com.kzohaar.app.hitbodedut;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * התבודדות — the Android side (JS name "KZHitbodedut", src/services/hitbodedut/nativePlugin.mjs).
 *   Brightness: the window's own override (WindowManager.LayoutParams.screenBrightness) — it never touches the system
 *   setting, so leaving the app always shows the person's brightness. The original override (usually "none") is kept
 *   in SharedPreferences and restored on end, on pause (re-dimmed on resume while the session is on), and on the next
 *   launch after a crash. Keep-awake: FLAG_KEEP_SCREEN_ON on the activity's window.
 *   Sound: KZAmbientSynth (AudioTrack), with audio focus — a call or another app's sound pauses it.
 *   Live Activities do not exist on Android: liveSupported → { supported: false }, the rest are no-ops.
 */
@CapacitorPlugin(name = "KZHitbodedut")
public class KZHitbodedutPlugin extends Plugin {
    private static final String PREFS = "kz_hitbodedut";
    private static final String ORIGINAL = "originalBrightness";

    private Float dimLevel = null;
    private boolean suspended = false;
    private final KZAmbientSynth synth = new KZAmbientSynth();
    private AudioFocusRequest focusRequest;

    @Override
    public void load() {
        // A saved original means the app ended while dimmed: restore it now.
        getActivity().runOnUiThread(() -> restoreSaved(true));
        synth.setListener(() -> {
            abandonFocus();
            JSObject data = new JSObject();
            data.put("action", "ended");
            notifyListeners("remote", data);
        });
    }

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private void setWindowBrightness(float value) {
        Activity activity = getActivity();
        if (activity == null) return;
        Window window = activity.getWindow();
        WindowManager.LayoutParams params = window.getAttributes();
        params.screenBrightness = value;
        window.setAttributes(params);
    }

    private float currentOverride() {
        Activity activity = getActivity();
        return activity == null ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : activity.getWindow().getAttributes().screenBrightness;
    }

    private void restoreSaved(boolean clear) {
        SharedPreferences prefs = prefs();
        if (prefs.contains(ORIGINAL)) setWindowBrightness(prefs.getFloat(ORIGINAL, WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE));
        if (clear) {
            prefs.edit().remove(ORIGINAL).apply();
            dimLevel = null;
            suspended = false;
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (dimLevel != null) { suspended = true; restoreSaved(false); }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (dimLevel != null && suspended) { suspended = false; setWindowBrightness(dimLevel); }
    }

    @Override
    protected void handleOnDestroy() {
        restoreSaved(true);
        synth.stop(true);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("brightness", (double) currentOverride());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void dim(PluginCall call) {
        float level = (float) Math.min(1, Math.max(0.02, call.getDouble("level", 0.12)));
        getActivity().runOnUiThread(() -> {
            SharedPreferences prefs = prefs();
            if (!prefs.contains(ORIGINAL)) prefs.edit().putFloat(ORIGINAL, currentOverride()).apply();
            dimLevel = level;
            suspended = false;
            setWindowBrightness(level);
            JSObject result = new JSObject();
            result.put("original", (double) prefs.getFloat(ORIGINAL, -1f));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void restore(PluginCall call) {
        boolean keep = Boolean.TRUE.equals(call.getBoolean("keepRecord", false));
        Double fallback = call.getDouble("original");
        getActivity().runOnUiThread(() -> {
            if (!prefs().contains(ORIGINAL) && fallback != null) setWindowBrightness(fallback.floatValue());
            if (keep) { suspended = true; restoreSaved(false); } else restoreSaved(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    // ── Sound ─────────────────────────────────────────────────────────────────────────────────────────────────────

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        JSObject data = new JSObject();
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            if (synth.isPlaying()) { synth.pause(); data.put("action", change == AudioManager.AUDIOFOCUS_LOSS ? "pause" : "interrupted"); notifyListeners("remote", data); }
        } else if (change == AudioManager.AUDIOFOCUS_GAIN && synth.isPaused()) {
            synth.resume(0);
            data.put("action", "play");
            notifyListeners("remote", data);
        }
    };

    private void requestFocus() {
        AudioManager manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            manager.requestAudioFocus(focusRequest);
        } else {
            manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonFocus() {
        AudioManager manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) manager.abandonAudioFocusRequest(focusRequest);
        else manager.abandonAudioFocus(focusListener);
    }

    @PluginMethod
    public void audioStart(PluginCall call) {
        String sound = call.getString("sound", "silence");
        float volume = (float) Math.min(1, Math.max(0, call.getDouble("volume", 0.4)));
        double hz = call.getDouble("hz", 196.0);
        long stopAt = call.getDouble("stopAt", 0.0).longValue();
        requestFocus();
        boolean started = synth.start(sound, volume, hz, stopAt);
        JSObject result = new JSObject();
        result.put("started", started);
        call.resolve(result);
    }

    @PluginMethod
    public void audioPause(PluginCall call) { synth.pause(); call.resolve(); }

    @PluginMethod
    public void audioResume(PluginCall call) {
        requestFocus();
        synth.resume(call.getDouble("stopAt", 0.0).longValue());
        call.resolve();
    }

    @PluginMethod
    public void audioStop(PluginCall call) {
        synth.stop(Boolean.TRUE.equals(call.getBoolean("immediate", false)));
        abandonFocus();
        call.resolve();
    }

    @PluginMethod
    public void audioSetVolume(PluginCall call) {
        synth.setVolume((float) Math.min(1, Math.max(0, call.getDouble("volume", 0.4))));
        call.resolve();
    }

    @PluginMethod
    public void audioChime(PluginCall call) { synth.chime(); call.resolve(); }

    // ── Live Activity: not on Android ─────────────────────────────────────────────────────────────────────────────

    @PluginMethod
    public void liveSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", false);
        call.resolve(result);
    }

    @PluginMethod
    public void liveStart(PluginCall call) {
        JSObject result = new JSObject();
        result.put("started", false);
        call.resolve(result);
    }

    @PluginMethod
    public void liveUpdate(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void liveEnd(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void takeLiveActions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("actions", new JSArray());
        call.resolve(result);
    }
}
