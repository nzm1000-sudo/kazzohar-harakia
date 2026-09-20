package com.kzohaar.app;

import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.view.Surface;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	private SensorManager sensorManager;
	private Sensor rotationSensor;
	private HeadingBridge headingBridge;

	@Override
	public void onStart() {
		super.onStart();
		WebView webView = getBridge().getWebView();
		sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
		rotationSensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
		headingBridge = new HeadingBridge(webView);
		webView.addJavascriptInterface(headingBridge, "KZHeading");
	}

	@Override
	public void onResume() {
		super.onResume();
		if (headingBridge != null) headingBridge.resume();
	}

	@Override
	public void onPause() {
		if (headingBridge != null) headingBridge.pause();
		super.onPause();
	}

	@Override
	public void onStop() {
		if (headingBridge != null) headingBridge.stop();
		if (getBridge() != null) getBridge().getWebView().removeJavascriptInterface("KZHeading");
		super.onStop();
	}

	private final class HeadingBridge implements SensorEventListener {
		private final WebView webView;
		private boolean active;
		private boolean registered;
		private String quality = "unreliable";

		HeadingBridge(WebView webView) { this.webView = webView; }

		@JavascriptInterface
		public void start() {
			active = rotationSensor != null;
			if (active) registerSensor();
			else emit(-1, false, System.currentTimeMillis());
		}

		private void registerSensor() {
			if (!active || registered || sensorManager == null || rotationSensor == null) return;
			registered = sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
		}

		void resume() { registerSensor(); }

		void pause() {
			if (registered && sensorManager != null) sensorManager.unregisterListener(this);
			registered = false;
		}

		@JavascriptInterface
		public void haptic() {
			Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
			if (vibrator == null || !vibrator.hasVibrator()) return;
			if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
			else vibrator.vibrate(18);
		}

		@JavascriptInterface
		public void stop() {
			active = false;
			pause();
		}

		@Override
		public void onSensorChanged(SensorEvent event) {
			if (!active || event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR) return;
			float[] rotation = new float[9];
			float[] orientation = new float[3];
			SensorManager.getRotationMatrixFromVector(rotation, event.values);
			int rotationState = getWindowManager().getDefaultDisplay().getRotation();
			if (rotationState == Surface.ROTATION_90) {
				float[] adjusted = new float[9];
				SensorManager.remapCoordinateSystem(rotation, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, adjusted);
				rotation = adjusted;
			} else if (rotationState == Surface.ROTATION_270) {
				float[] adjusted = new float[9];
				SensorManager.remapCoordinateSystem(rotation, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, adjusted);
				rotation = adjusted;
			}
			SensorManager.getOrientation(rotation, orientation);
			emit((float) Math.toDegrees(orientation[0]), true, System.currentTimeMillis());
		}

		@Override
		public void onAccuracyChanged(Sensor sensor, int accuracy) {
			if (sensor != rotationSensor) return;
			if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_HIGH) quality = "high";
			else if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM) quality = "medium";
			else if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW) quality = "low";
			else quality = "unreliable";
		}

		private void emit(float azimuth, boolean available, long timestamp) {
			float heading = (azimuth + 360) % 360;
			String script = "window.dispatchEvent(new CustomEvent('kz-native-heading',{detail:{heading:" + heading + ",magneticHeading:" + heading + ",quality:'" + quality + "',timestamp:" + timestamp + ",source:'magnetic',available:" + available + "}}));";
			webView.post(() -> webView.evaluateJavascript(script, null));
		}
	}
}
