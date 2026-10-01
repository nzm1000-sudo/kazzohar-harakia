package com.kzohaar.app.hitbodedut;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

/**
 * התבודדות — the background sound rendered on the device (the recipes of src/services/ambientAudio/noise.mjs: white;
 * pink — Paul Kellet's filter; brown — leaky integration with a DC blocker; a plain sine), streamed through an
 * AudioTrack from a small worker thread, with gentle fades and a fade-out at the chosen end time. Background sound for
 * focus only.
 *
 * Limits (no foreground service, by design — no persistent notification, no extra permission): the sound keeps playing
 * while the activity is in the background as long as Android keeps the process alive; a phone under memory pressure or
 * an aggressive battery saver may stop it. See docs/leatzmi/hitbodedut.md.
 */
final class KZAmbientSynth {
    interface Listener { void onFinished(); }

    private static final int RATE = 44100;
    private static final float FADE_IN = 2.5f, FADE_OUT = 1.2f, PAUSE_FADE = 0.6f;

    private volatile int kind = 0;           // 1 white · 2 pink · 3 brown · 4 tone
    private volatile double hz = 196;
    private volatile float target = 0f;
    private volatile float step = 0f;
    private volatile float volume = 0.4f;
    private volatile long stopAt = 0;        // epoch ms; 0 = none
    private volatile boolean running = false;
    private volatile boolean paused = false;
    private volatile int chime = -1;
    private volatile boolean finishing = false;

    private float gain = 0f;
    private double phase = 0;
    private int seed = 0x6b7a;
    private float b0, b1, b2, b3, b4, b5, b6, brown, dcIn, dcOut;

    private AudioTrack track;
    private Thread worker;
    private Listener listener;

    void setListener(Listener listener) { this.listener = listener; }
    boolean isPlaying() { return running && !paused && kind != 0; }
    boolean isPaused() { return paused; }

    private static int kindOf(String sound) {
        switch (sound == null ? "" : sound) {
            case "white": return 1;
            case "pink": return 2;
            case "brown": return 3;
            case "tone": return 4;
            default: return 0;
        }
    }

    private void fade(float to, float seconds) {
        step = Math.max(0.000001f, Math.abs(to - gain) / Math.max(1f, seconds * RATE));
        target = to;
    }

    synchronized boolean start(String sound, float vol, double pitch, long stopAtMs) {
        int k = kindOf(sound);
        if (k == 0) return false;
        kind = k;
        hz = pitch;
        volume = vol;
        gain = 0f;
        paused = false;
        finishing = false;
        stopAt = stopAtMs;
        fade(vol, FADE_IN);
        ensureThread();
        if (track != null) track.play();
        return true;
    }

    synchronized void pause() {
        if (!isPlaying()) return;
        paused = true;
        fade(0f, PAUSE_FADE);
    }

    synchronized void resume(long stopAtMs) {
        if (!paused || kind == 0) return;
        paused = false;
        finishing = false;
        if (stopAtMs > 0) stopAt = stopAtMs;
        ensureThread();
        if (track != null) track.play();
        fade(volume, 1.2f);
    }

    synchronized void stop(boolean immediate) {
        if (immediate) { shutdown(); return; }
        finishing = true;
        stopAt = 0;
        fade(0f, FADE_OUT);
    }

    void setVolume(float vol) {
        volume = vol;
        if (isPlaying()) fade(vol, 0.3f);
    }

    synchronized void chime() {
        chime = 0;
        ensureThread();
        if (track != null) track.play();
    }

    private void ensureThread() {
        if (running && worker != null && worker.isAlive()) return;
        int min = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setBufferSizeInBytes(Math.max(min, 4096) * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();
        running = true;
        worker = new Thread(this::loop, "kz-ambient");
        worker.setPriority(Thread.MAX_PRIORITY);
        worker.start();
    }

    private void loop() {
        short[] buffer = new short[1024];
        AudioTrack out = track;
        while (running && out != null) {
            long now = System.currentTimeMillis();
            if (stopAt > 0 && !finishing && now >= stopAt - (long) (FADE_OUT * 1000)) { finishing = true; fade(0f, FADE_OUT); }
            for (int i = 0; i < buffer.length; i++) buffer[i] = (short) (next() * 32767);
            out.write(buffer, 0, buffer.length);
            boolean silent = gain == 0f && target == 0f && chime < 0;
            if (finishing && silent) {
                running = false;
                if (listener != null) listener.onFinished();
                break;
            }
            if (paused && silent) {
                out.pause();
                while (running && paused && chime < 0) { try { Thread.sleep(80); } catch (InterruptedException e) { return; } }
                if (running) out.play();
            }
            if (kind == 0 && silent && !paused) { running = false; break; }
        }
        try { out.stop(); } catch (Exception ignored) {}
        try { out.release(); } catch (Exception ignored) {}
        synchronized (this) { if (track == out) track = null; kind = finishing ? 0 : kind; finishing = false; }
    }

    private synchronized void shutdown() {
        running = false;
        kind = 0;
        paused = false;
        gain = 0f;
        target = 0f;
        if (worker != null) worker.interrupt();
    }

    private float random() {
        seed += 0x6d2b79f5;
        int t = seed;
        int r = (t ^ (t >>> 15)) * (1 | t);
        r ^= r + ((r ^ (r >>> 7)) * (61 | r));
        long value = (r ^ (r >>> 14)) & 0xffffffffL;
        return (float) (value / 4294967296.0 * 2 - 1);
    }

    private float next() {
        if (gain != target) gain = gain < target ? Math.min(target, gain + step) : Math.max(target, gain - step);
        float value;
        switch (kind) {
            case 1: value = random() * 0.277f; break;
            case 2: {
                float w = random();
                b0 = 0.99886f * b0 + w * 0.0555179f;
                b1 = 0.99332f * b1 + w * 0.0750759f;
                b2 = 0.969f * b2 + w * 0.153852f;
                b3 = 0.8665f * b3 + w * 0.3104856f;
                b4 = 0.55f * b4 + w * 0.5329522f;
                b5 = -0.7616f * b5 - w * 0.016898f;
                float pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362f;
                b6 = w * 0.115926f;
                value = pink * 0.11f * 0.828f;
                break;
            }
            case 3: {
                brown = (brown + 0.02f * random()) / 1.02f;
                float x = brown * 3.5f;
                dcOut = x - dcIn + 0.9995f * dcOut;
                dcIn = x;
                value = dcOut * 0.807f;
                break;
            }
            case 4:
                value = (float) Math.sin(phase) * 0.18f;
                phase += 2 * Math.PI * hz / RATE;
                if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
                break;
            default: value = 0f;
        }
        float sample = value * gain;
        if (chime >= 0) {
            double t = chime / (double) RATE;
            double envelope = (t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 1.6)) * 0.16;
            sample += (float) ((Math.sin(2 * Math.PI * 523.25 * t) + 0.25 * Math.sin(2 * Math.PI * 1046.5 * t)) * envelope);
            chime = t > 4.2 ? -1 : chime + 1;
        }
        return Math.max(-0.95f, Math.min(0.95f, sample));
    }
}
