package com.lifetrack.app.spike;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(HealthBridgePlugin.class);
		registerPlugin(SessionVaultPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
