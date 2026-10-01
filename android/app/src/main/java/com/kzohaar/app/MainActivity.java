package com.kzohaar.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.kzohaar.app.alarm.KZAlarmPlugin;
import com.kzohaar.app.compass.KZCompassPlugin;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		// מצפן תפילה: the heading from SensorManager (rotation vector → accelerometer+magnetometer → legacy orientation).
		registerPlugin(KZCompassPlugin.class);
		// The home-screen widgets (KZWidgetsPlugin: the on-device snapshot, redraw).
		registerPlugin(com.kzohaar.app.widget.KZWidgetsPlugin.class);
		// The app's own plugin: השעון היהודי (exact alarm clocks).
		registerPlugin(KZAlarmPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
