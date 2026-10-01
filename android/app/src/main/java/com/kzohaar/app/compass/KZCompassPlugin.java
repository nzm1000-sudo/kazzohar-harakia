package com.kzohaar.app.compass;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Display;
import android.view.Surface;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * מצפן תפילה — the Android heading source (JS name "KZCompass"). The WebView's deviceorientation events are unreliable on
 * many Android phones (relative alpha, no tilt compensation, missing on phones without a gyroscope), so the heading is read
 * here from SensorManager, with no third-party code:
 *   1. TYPE_ROTATION_VECTOR (fused; needs a magnetometer, usually also a gyroscope);
 *   2. otherwise TYPE_ACCELEROMETER + TYPE_MAGNETIC_FIELD, low-pass filtered (budget phones without a gyroscope);
 *   3. otherwise the deprecated TYPE_ORIENTATION, if the phone still offers it.
 * The azimuth is taken for the screen's current rotation (remapCoordinateSystem), stays steady when the phone is held
 * upright (the back of the phone points the way), is corrected to TRUE north with GeomagneticField at the app's location,
 * and carries the magnetometer's accuracy (SENSOR_STATUS_*) plus a field-strength check so the page can ask for the
 * figure-8 calibration. Events ("heading") are limited to ~20 per second; listeners stop with stop() and while paused.
 */
@CapacitorPlugin(name = "KZCompass")
public class KZCompassPlugin extends Plugin implements SensorEventListener {

    private static final long MIN_INTERVAL_MS = 50;       // ≈20 Hz to the WebView
    private static final long HEARTBEAT_MS = 500;         // re-send an unchanged heading this often
    private static final float MIN_CHANGE_DEG = 0.3f;
    private static final float LOW_PASS = 0.15f;          // accelerometer / magnetometer smoothing (fallback mode)
    private static final float FIELD_MIN_UT = 20f;        // Earth's field is ~25–65 µT; outside this, a magnet or metal is near
    private static final float FIELD_MAX_UT = 75f;

    private SensorManager sensorManager;
    private Sensor rotationVector;
    private Sensor accelerometer;
    private Sensor magnetometer;
    private Sensor orientation;
    private String mode = "none";
    private boolean active;
    private boolean registered;

    private final float[] gravity = new float[3];
    private final float[] geomagnetic = new float[3];
    private boolean hasGravity;
    private boolean hasGeomagnetic;
    private int magneticStatus = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private int sensorStatus = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private float fieldStrength = -1f;
    private float headingAccuracyDeg = -1f;

    private Double latitude;
    private Double longitude;
    private double altitude;
    private float declination;
    private boolean hasDeclination;

    private long lastEmit;
    private float lastHeading = -1000f;
    private String lastQuality = "";

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        rotationVector = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        orientation = legacyOrientationSensor();
    }

    @SuppressWarnings("deprecation")
    private Sensor legacyOrientationSensor() {
        return sensorManager.getDefaultSensor(Sensor.TYPE_ORIENTATION);
    }

    private String chooseMode() {
        if (rotationVector != null && magnetometer != null) return "rotation_vector";
        if (accelerometer != null && magnetometer != null) return "accel_mag";
        if (orientation != null) return "orientation";
        return "none";
    }

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("magnetometer", magnetometer != null);
        result.put("rotationVector", rotationVector != null);
        result.put("accelerometer", accelerometer != null);
        result.put("orientation", orientation != null);
        result.put("mode", chooseMode());
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        readLocation(call);
        mode = chooseMode();
        JSObject result = new JSObject();
        result.put("mode", mode);
        result.put("magnetometer", magnetometer != null);
        if ("none".equals(mode)) {
            active = false;
            result.put("available", false);
            result.put("reason", magnetometer == null ? "no-magnetometer" : "no-sensor");
            call.resolve(result);
            return;
        }
        active = true;
        hasGravity = false;
        hasGeomagnetic = false;
        lastEmit = 0;
        lastHeading = -1000f;
        lastQuality = "";
        headingAccuracyDeg = -1f;
        magneticStatus = SensorManager.SENSOR_STATUS_UNRELIABLE;
        sensorStatus = SensorManager.SENSOR_STATUS_UNRELIABLE;
        fieldStrength = -1f;
        register();
        result.put("available", registered);
        if (!registered) result.put("reason", "register-failed");
        result.put("declination", hasDeclination ? declination : null);
        call.resolve(result);
    }

    @PluginMethod
    public void setLocation(PluginCall call) {
        readLocation(call);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        active = false;
        unregister();
        call.resolve();
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        try {
            Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                else vibrator.vibrate(18);
            }
        } catch (RuntimeException ignored) {
            // A missing vibrator or permission must never break the compass; the tap is a courtesy.
        }
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        unregister();
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (active) register();
    }

    @Override
    protected void handleOnDestroy() {
        active = false;
        unregister();
        super.handleOnDestroy();
    }

    private void readLocation(PluginCall call) {
        Double lat = call.getDouble("latitude");
        Double lon = call.getDouble("longitude");
        Double alt = call.getDouble("altitude");
        if (lat == null || lon == null || lat.isNaN() || lon.isNaN() || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        latitude = lat;
        longitude = lon;
        altitude = alt == null || alt.isNaN() ? 0 : alt;
        GeomagneticField field = new GeomagneticField(latitude.floatValue(), longitude.floatValue(), (float) altitude, System.currentTimeMillis());
        declination = field.getDeclination();
        hasDeclination = true;
    }

    private void register() {
        if (registered || sensorManager == null || !active) return;
        boolean ok = false;
        switch (mode) {
            case "rotation_vector":
                ok = sensorManager.registerListener(this, rotationVector, SensorManager.SENSOR_DELAY_GAME);
                // The magnetometer is also heard (slowly) for its calibration status and field strength.
                if (magnetometer != null) sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI);
                break;
            case "accel_mag":
                ok = sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME)
                        & sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME);
                break;
            case "orientation":
                ok = sensorManager.registerListener(this, orientation, SensorManager.SENSOR_DELAY_GAME);
                break;
            default:
                break;
        }
        registered = ok;
        if (!ok) sensorManager.unregisterListener(this);
    }

    private void unregister() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        registered = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!active) return;
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_MAGNETIC_FIELD) {
            float x = event.values[0], y = event.values[1], z = event.values[2];
            fieldStrength = (float) Math.sqrt(x * x + y * y + z * z);
            if ("accel_mag".equals(mode)) {
                lowPass(event.values, geomagnetic, hasGeomagnetic);
                hasGeomagnetic = true;
                if (hasGravity) emitFromMatrix(matrixFromAccelMag());
            }
            return;
        }
        if (type == Sensor.TYPE_ACCELEROMETER) {
            lowPass(event.values, gravity, hasGravity);
            hasGravity = true;
            if (hasGeomagnetic) emitFromMatrix(matrixFromAccelMag());
            return;
        }
        if (type == Sensor.TYPE_ROTATION_VECTOR) {
            // values[4] (when present) is the estimated heading accuracy in radians; -1 when unknown.
            if (event.values.length > 4 && event.values[4] >= 0) headingAccuracyDeg = (float) Math.toDegrees(event.values[4]);
            float[] rotation = new float[9];
            try {
                SensorManager.getRotationMatrixFromVector(rotation, event.values);
            } catch (IllegalArgumentException tooLong) {
                // Some Samsung devices send 5 values but reject them here; the first four are enough.
                float[] four = new float[4];
                System.arraycopy(event.values, 0, four, 0, 4);
                SensorManager.getRotationMatrixFromVector(rotation, four);
            }
            emitFromMatrix(rotation);
            return;
        }
        if (isLegacyOrientation(type)) {
            // Legacy: values[0] is the magnetic azimuth of the device's natural top, in degrees.
            emit(normalize(event.values[0] + displayRotationDegrees()));
        }
    }

    @SuppressWarnings("deprecation")
    private static boolean isLegacyOrientation(int type) {
        return type == Sensor.TYPE_ORIENTATION;
    }

    private static void lowPass(float[] input, float[] output, boolean primed) {
        for (int i = 0; i < 3; i++) output[i] = primed ? output[i] + LOW_PASS * (input[i] - output[i]) : input[i];
    }

    private float[] matrixFromAccelMag() {
        float[] rotation = new float[9];
        return SensorManager.getRotationMatrix(rotation, null, gravity, geomagnetic) ? rotation : null;
    }

    private void emitFromMatrix(float[] rotation) {
        if (rotation == null) return;
        float[] remapped = remapForDisplay(rotation);
        // World = R · device. Heading of the screen's top edge (device Y) or, when the phone stands upright, of the direction
        // the back of the phone faces (-Z): whichever lies more nearly horizontal, so the reading never spins near vertical.
        float yEast = remapped[1], yNorth = remapped[4];
        float backEast = -remapped[2], backNorth = -remapped[5];
        double yLength = Math.hypot(yEast, yNorth);
        double backLength = Math.hypot(backEast, backNorth);
        double azimuth = yLength >= backLength ? Math.atan2(yEast, yNorth) : Math.atan2(backEast, backNorth);
        emit(normalize((float) Math.toDegrees(azimuth)));
    }

    private float[] remapForDisplay(float[] rotation) {
        int x, y;
        switch (displayRotation()) {
            case Surface.ROTATION_90: x = SensorManager.AXIS_Y; y = SensorManager.AXIS_MINUS_X; break;
            case Surface.ROTATION_180: x = SensorManager.AXIS_MINUS_X; y = SensorManager.AXIS_MINUS_Y; break;
            case Surface.ROTATION_270: x = SensorManager.AXIS_MINUS_Y; y = SensorManager.AXIS_X; break;
            default: return rotation;
        }
        float[] remapped = new float[9];
        return SensorManager.remapCoordinateSystem(rotation, x, y, remapped) ? remapped : rotation;
    }

    @SuppressWarnings("deprecation")
    private int displayRotation() {
        try {
            Display display = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && getActivity() != null) display = getActivity().getDisplay();
            if (display == null) {
                WindowManager windowManager = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
                if (windowManager != null) display = windowManager.getDefaultDisplay();
            }
            return display == null ? Surface.ROTATION_0 : display.getRotation();
        } catch (RuntimeException ignored) {
            return Surface.ROTATION_0;
        }
    }

    private float displayRotationDegrees() {
        switch (displayRotation()) {
            case Surface.ROTATION_90: return 90f;
            case Surface.ROTATION_180: return 180f;
            case Surface.ROTATION_270: return 270f;
            default: return 0f;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor == null) return;
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) magneticStatus = accuracy;
        else sensorStatus = accuracy;
    }

    private String quality() {
        // The magnetometer's own status speaks for north; without one (legacy sensor) the sensor's status does.
        int status = magnetometer != null ? magneticStatus : sensorStatus;
        String level;
        if (status == SensorManager.SENSOR_STATUS_ACCURACY_HIGH) level = "high";
        else if (status == SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM) level = "medium";
        else if (status == SensorManager.SENSOR_STATUS_ACCURACY_LOW) level = "low";
        else level = "unreliable";
        if (fieldStrength >= 0 && (fieldStrength < FIELD_MIN_UT || fieldStrength > FIELD_MAX_UT)) level = "unreliable";
        if (headingAccuracyDeg > 30 && ("high".equals(level) || "medium".equals(level))) level = "low";
        return level;
    }

    private static float normalize(float degrees) {
        float value = degrees % 360f;
        return value < 0 ? value + 360f : value;
    }

    private static float difference(float a, float b) {
        float delta = (a - b + 540f) % 360f - 180f;
        return Math.abs(delta);
    }

    private void emit(float magneticHeading) {
        long now = SystemClock.elapsedRealtime();
        String quality = quality();
        boolean qualityChanged = !quality.equals(lastQuality);
        if (!qualityChanged && now - lastEmit < MIN_INTERVAL_MS) return;
        if (!qualityChanged && lastHeading > -1000f && difference(magneticHeading, lastHeading) < MIN_CHANGE_DEG && now - lastEmit < HEARTBEAT_MS) return;
        lastEmit = now;
        lastHeading = magneticHeading;
        lastQuality = quality;
        JSObject data = new JSObject();
        data.put("magneticHeading", magneticHeading);
        if (hasDeclination) {
            data.put("trueHeading", normalize(magneticHeading + declination));
            data.put("declination", declination);
        }
        data.put("quality", quality);
        data.put("mode", mode);
        data.put("fieldStrength", fieldStrength);
        data.put("headingAccuracy", headingAccuracyDeg);
        data.put("timestamp", System.currentTimeMillis());
        data.put("available", true);
        notifyListeners("heading", data);
    }
}
