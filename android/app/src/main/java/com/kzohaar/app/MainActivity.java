package com.kzohaar.app;

import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

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
	public void onStop() {
		if (headingBridge != null) headingBridge.stop();
		if (getBridge() != null) getBridge().getWebView().removeJavascriptInterface("KZHeading");
		super.onStop();
	}

	private final class HeadingBridge implements SensorEventListener {
		private final WebView webView;
		private boolean active;

		HeadingBridge(WebView webView) { this.webView = webView; }

		@JavascriptInterface
		public void start() {
			active = rotationSensor != null;
			if (active) sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
			else emit(-1, false);
		}

		@JavascriptInterface
		public void stop() {
			active = false;
			if (sensorManager != null) sensorManager.unregisterListener(this);
		}

		@Override
		public void onSensorChanged(SensorEvent event) {
			if (!active || event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR) return;
			float[] rotation = new float[9];
			float[] orientation = new float[3];
			SensorManager.getRotationMatrixFromVector(rotation, event.values);
			SensorManager.getOrientation(rotation, orientation);
			emit((float) Math.toDegrees(orientation[0]), true);
		}

		@Override
		public void onAccuracyChanged(Sensor sensor, int accuracy) {}

		private void emit(float azimuth, boolean available) {
			float heading = (azimuth + 360) % 360;
			String script = "window.dispatchEvent(new CustomEvent('kz-native-heading',{detail:{heading:" + heading + ",headingAccuracy:-1,available:" + available + "}}));";
			webView.post(() -> webView.evaluateJavascript(script, null));
		}
	}
}
