package com.lifetrack.app.spike

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class HealthPrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            setPadding(32, 48, 32, 32)
            textSize = 18f
            text = "LifeTrack health permissions\n\nOnly selected health metrics may be read with your permission. This spike does not import health records or enable background synchronization. You can revoke access in Health Connect settings. No health data is sent to AI by this permission flow."
        })
    }
}