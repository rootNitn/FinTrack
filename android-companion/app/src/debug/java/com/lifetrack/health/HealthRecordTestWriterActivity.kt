package com.lifetrack.health

import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit

class HealthRecordTestWriterActivity : ComponentActivity() {
    private val recordId = "lifetrack-emulator-steps-smoke"
    private lateinit var status: TextView
    private val permissionRequest = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        status.text = if (writePermission in granted) "Steps test writer permission granted" else "Steps test writer permission denied"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        status = TextView(this).apply { textSize = 18f; text = "Synthetic emulator-only Steps records" }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 280, 32, 32)
            addView(status)
            addView(Button(this@HealthRecordTestWriterActivity).apply {
                text = "Grant Steps write permission"
                setOnClickListener {
                    if (HealthConnectClient.getSdkStatus(this@HealthRecordTestWriterActivity) != HealthConnectClient.SDK_AVAILABLE) {
                        status.text = "Health Connect is unavailable for this app"
                    } else {
                        status.text = "Opening Health Connect permission screen"
                        permissionRequest.launch(setOf(writePermission))
                    }
                }
            })
            addView(Button(this@HealthRecordTestWriterActivity).apply {
                text = "Write 1234 test steps"
                setOnClickListener { writeRecord(1234) }
            })
            addView(Button(this@HealthRecordTestWriterActivity).apply {
                text = "Update to 2345 test steps"
                setOnClickListener { writeRecord(2345) }
            })
            addView(Button(this@HealthRecordTestWriterActivity).apply {
                text = "Delete test steps"
                setOnClickListener { deleteRecord() }
            })
        }
        setContentView(layout)
    }

    private fun writeRecord(count: Long) {
        lifecycleScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(this@HealthRecordTestWriterActivity)
                if (writePermission !in client.permissionController.getGrantedPermissions()) {
                    status.text = "Grant Steps write permission first"
                    return@launch
                }
                val version = getPreferences(MODE_PRIVATE).getLong("recordVersion", 0) + 1
                val end = Instant.now().truncatedTo(ChronoUnit.MINUTES)
                val start = end.minus(15, ChronoUnit.MINUTES)
                val zone = ZoneId.systemDefault()
                client.insertRecords(listOf(StepsRecord(
                    count = count,
                    startTime = start,
                    startZoneOffset = zone.rules.getOffset(start),
                    endTime = end,
                    endZoneOffset = zone.rules.getOffset(end),
                    metadata = Metadata.manualEntry(clientRecordId = recordId, clientRecordVersion = version),
                )))
                getPreferences(MODE_PRIVATE).edit().putLong("recordVersion", version).apply()
                status.text = "Wrote $count synthetic test steps, version $version"
            } catch (_: Exception) {
                status.text = "Test record write failed; check Health Connect permission"
            }
        }
    }

    private fun deleteRecord() {
        lifecycleScope.launch {
            try {
                HealthConnectClient.getOrCreate(this@HealthRecordTestWriterActivity).deleteRecords(
                    recordType = StepsRecord::class,
                    recordIdsList = emptyList(),
                    clientRecordIdsList = listOf(recordId),
                )
                status.text = "Deleted synthetic test steps"
            } catch (_: Exception) {
                status.text = "Test record deletion failed; check Health Connect permission"
            }
        }
    }

    private companion object {
        val writePermission = HealthPermission.getWritePermission(StepsRecord::class)
    }
}