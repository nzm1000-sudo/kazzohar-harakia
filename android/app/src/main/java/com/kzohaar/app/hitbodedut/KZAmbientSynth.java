package com.kzohaar.app.hitbodedut;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ShortBuffer;

/**
 * התבודדות — the background sound rendered on the device (the recipes of src/services/ambientAudio/noise.mjs: white;
 * pink — Paul Kellet's filter; brown — leaky integration with a DC blocker; a plain sine; צליל עמוק — 500 Hz in the
 * left ear, 501.5 Hz in the right), and the bundled nature recordings (assets public/audio/ambient/*.m4a): each is
 * decoded once to 16-bit PCM with MediaExtractor + MediaCodec, its middle loop window is kept (recordings.mjs explains
 * the window: the AAC priming and padding fall outside it) and played round and round sample by sample — gap-free.
 * Streamed through one stereo AudioTrack from a small worker thread, with gentle fades and a fade-out at the chosen
 * end time. Background sound for focus only.
 *
 * Limits (no foreground service, by design — no persistent notification, no extra permission): the sound keeps playing
 * while the activity is in the background as long as Android keeps the process alive; a phone under memory pressure or
 * an aggressive battery saver may stop it. See docs/leatzmi/hitbodedut.md.
 */
final class KZAmbientSynth {
    interface Listener { void onFinished(); }

    private static final int RATE = 44100;
    private static final float FADE_IN = 2.5f, FADE_OUT = 1.2f, PAUSE_FADE = 0.6f;

    private static final float DEEP_LEVEL = 0.11f;   // DEEP_TONE in noise.mjs
    private volatile int kind = 0;           // 1 white · 2 pink · 3 brown · 4 tone · 5 deep (two ears) · 6 recording
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
    private double phase = 0, phaseLeft = 0, phaseRight = 0;
    private volatile short[] loop = null;    // the current recording's loop (16-bit mono, 44.1 kHz)
    private volatile String loopId = null;
    private int loopIndex = 0;
    private float rightOut = 0f;             // the right channel of the last next() (differs only for צליל עמוק)
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
            case "deep": return 5;
            case "aquarium": case "brook": case "flow": case "rain": return 6;
            default: return 0;
        }
    }

    private void fade(float to, float seconds) {
        step = Math.max(0.000001f, Math.abs(to - gain) / Math.max(1f, seconds * RATE));
        target = to;
    }

    // Decodes a bundled recording (an asset path such as "public/audio/ambient/brook.m4a") to 16-bit mono PCM and keeps
    // its middle loop window of loopFrames (at 44.1 kHz). Called off the main thread; the last one stays loaded.
    boolean load(Context context, String id, String asset, int loopFrames) {
        if (id.equals(loopId) && loop != null) return true;
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;
        try {
            try (AssetFileDescriptor fd = context.getAssets().openFd(asset)) {
                extractor.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            } catch (Exception compressed) {
                // An asset stored compressed cannot be opened as a descriptor: copy it to the cache once.
                File copy = new File(context.getCacheDir(), "kz-" + id + ".m4a");
                if (!copy.exists()) {
                    try (InputStream in = context.getAssets().open(asset); OutputStream out = new FileOutputStream(copy)) {
                        byte[] chunk = new byte[65536];
                        for (int n; (n = in.read(chunk)) > 0; ) out.write(chunk, 0, n);
                    }
                }
                extractor.setDataSource(copy.getAbsolutePath());
            }
            int track = -1;
            MediaFormat format = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat candidate = extractor.getTrackFormat(i);
                String mime = candidate.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) { track = i; format = candidate; break; }
            }
            if (track < 0) return false;
            extractor.selectTrack(track);
            codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME));
            codec.configure(format, null, null, 0);
            codec.start();
            int channels = format.containsKey(MediaFormat.KEY_CHANNEL_COUNT) ? format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) : 1;
            int rate = format.containsKey(MediaFormat.KEY_SAMPLE_RATE) ? format.getInteger(MediaFormat.KEY_SAMPLE_RATE) : RATE;
            long durationUs = format.containsKey(MediaFormat.KEY_DURATION) ? format.getLong(MediaFormat.KEY_DURATION) : 200_000_000L;
            short[] mono = new short[(int) Math.min(Integer.MAX_VALUE - 8, durationUs * rate / 1_000_000L + rate)];
            int written = 0;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            boolean inputDone = false, outputDone = false;
            while (!outputDone) {
                if (!inputDone) {
                    int in = codec.dequeueInputBuffer(10_000);
                    if (in >= 0) {
                        ByteBuffer buffer = codec.getInputBuffer(in);
                        int size = buffer == null ? -1 : extractor.readSampleData(buffer, 0);
                        if (size < 0) { codec.queueInputBuffer(in, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true; }
                        else { codec.queueInputBuffer(in, 0, size, extractor.getSampleTime(), 0); extractor.advance(); }
                    }
                }
                int out = codec.dequeueOutputBuffer(info, 10_000);
                if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    MediaFormat changed = codec.getOutputFormat();
                    channels = changed.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    rate = changed.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                } else if (out >= 0) {
                    ByteBuffer buffer = codec.getOutputBuffer(out);
                    if (buffer != null && info.size > 0) {
                        buffer.position(info.offset);
                        buffer.limit(info.offset + info.size);
                        ShortBuffer pcm = buffer.order(ByteOrder.nativeOrder()).asShortBuffer();
                        int frames = pcm.remaining() / Math.max(1, channels);
                        if (written + frames > mono.length) {
                            short[] grown = new short[Math.max(mono.length * 2, written + frames)];
                            System.arraycopy(mono, 0, grown, 0, written);
                            mono = grown;
                        }
                        for (int f = 0; f < frames; f++) {
                            int sum = 0;
                            for (int c = 0; c < channels; c++) sum += pcm.get(f * channels + c);
                            mono[written + f] = (short) (sum / Math.max(1, channels));
                        }
                        written += frames;
                    }
                    codec.releaseOutputBuffer(out, false);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true;
                }
            }
            // The loop window (recordings.mjs loopWindow): exactly one loop from the middle — whether or not this
            // decoder removed the AAC priming, the window is clear of it.
            int length = loopFrames > 0 ? (int) Math.round(loopFrames * (double) rate / RATE) : written;
            int start = written > length ? (written - length) / 2 : 0;
            int count = Math.min(length, written - start);
            if (count <= 0) return false;
            short[] window = new short[count];
            System.arraycopy(mono, start, window, 0, count);
            synchronized (this) { loop = window; loopId = id; }
            return true;
        } catch (Exception error) {
            return false;
        } finally {
            if (codec != null) { try { codec.stop(); } catch (Exception ignored) {} try { codec.release(); } catch (Exception ignored) {} }
            extractor.release();
        }
    }

    synchronized boolean start(String sound, float vol, double pitch, long stopAtMs) {
        int k = kindOf(sound);
        if (k == 0) return false;
        if (k == 6 && (loop == null || !sound.equals(loopId))) return false;
        kind = 0;
        loopIndex = 0;
        phaseLeft = 0;
        phaseRight = 0;
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
        int min = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT);
        track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
            .setBufferSizeInBytes(Math.max(min, 4096) * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();
        running = true;
        worker = new Thread(this::loop, "kz-ambient");
        worker.setPriority(Thread.MAX_PRIORITY);
        worker.start();
    }

    private void loop() {
        short[] buffer = new short[2048];        // 1024 stereo frames, interleaved left, right
        AudioTrack out = track;
        while (running && out != null) {
            long now = System.currentTimeMillis();
            if (stopAt > 0 && !finishing && now >= stopAt - (long) (FADE_OUT * 1000)) { finishing = true; fade(0f, FADE_OUT); }
            for (int i = 0; i < buffer.length; i += 2) {
                buffer[i] = (short) (next() * 32767);
                buffer[i + 1] = (short) (rightOut * 32767);
            }
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
        float right = Float.NaN;
        switch (kind) {
            case 1: value = random() * 0.277f * 0.55f; break;   // LEVEL_TRIM in noise.mjs: every sound near −18 LUFS
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
                value = pink * 0.11f * 0.828f * 0.84f;
                break;
            }
            case 3: {
                brown = (brown + 0.02f * random()) / 1.02f;
                float x = brown * 3.5f;
                dcOut = x - dcIn + 0.9995f * dcOut;
                dcIn = x;
                value = dcOut * 0.807f * 0.94f;
                break;
            }
            case 4:
                value = (float) Math.sin(phase) * 0.18f;
                phase += 2 * Math.PI * hz / RATE;
                if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
                break;
            case 5:
                value = (float) Math.sin(phaseLeft) * DEEP_LEVEL;
                right = (float) Math.sin(phaseRight) * DEEP_LEVEL;
                phaseLeft += 2 * Math.PI * 500.0 / RATE;
                phaseRight += 2 * Math.PI * 501.5 / RATE;
                if (phaseLeft > 2 * Math.PI) phaseLeft -= 2 * Math.PI;
                if (phaseRight > 2 * Math.PI) phaseRight -= 2 * Math.PI;
                break;
            case 6: {
                short[] samples = loop;
                if (samples == null || samples.length == 0) { value = 0f; break; }
                if (loopIndex >= samples.length) loopIndex = 0;
                value = samples[loopIndex] / 32767f;
                loopIndex++;
                if (loopIndex >= samples.length) loopIndex = 0;   // the last sample runs straight into the first
                break;
            }
            default: value = 0f;
        }
        float sample = value * gain;
        float sampleRight = (Float.isNaN(right) ? value : right) * gain;
        if (chime >= 0) {
            double t = chime / (double) RATE;
            double envelope = (t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) * 1.6)) * 0.16;
            float bell = (float) ((Math.sin(2 * Math.PI * 523.25 * t) + 0.25 * Math.sin(2 * Math.PI * 1046.5 * t)) * envelope);
            sample += bell;
            sampleRight += bell;
            chime = t > 4.2 ? -1 : chime + 1;
        }
        rightOut = Math.max(-0.95f, Math.min(0.95f, sampleRight));
        return Math.max(-0.95f, Math.min(0.95f, sample));
    }
}
