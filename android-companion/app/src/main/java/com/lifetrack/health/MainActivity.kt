package com.lifetrack.health

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId

class MainActivity : ComponentActivity() {
    private lateinit var store: SecureState
    private lateinit var status: TextView
    private lateinit var server: EditText
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var code: EditText
    private lateinit var consent: CheckBox
    private lateinit var background: CheckBox
    private val toggles = linkedMapOf<HealthMetric, Switch>()
    private var pendingTwoFactor: String? = null
    private val permissions = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) {
        runOperation { connectOrUpdate() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SecureState(this)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 48, 32, 32) }
        setContentView(ScrollView(this).apply { addView(layout) })
        layout.addView(TextView(this).apply { text = "LifeTrack Health"; textSize = 26f })
        layout.addView(TextView(this).apply { text = "Your selected health data is uploaded to your LifeTrack account. Automatic sync uses background permission; Android controls execution timing. No health data is sent to AI by this connection." })
        server = field(layout, "Backend API URL (https://your-server/api/v1)")
        server.setText(store.read().text("server") ?: "")
        email = field(layout, "Email")
        password = field(layout, "Password").apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        code = field(layout, "Authenticator or backup code (if enabled)")
        button(layout, "Sign in") { signIn() }
        status = TextView(this).apply { textSize = 15f; setPadding(0, 24, 0, 24) }
        layout.addView(status)
        val enabled = store.read().getAsJsonArray("enabledMetrics")?.map { it.asString } ?: emptyList()
        HealthMetric.entries.forEach { metric ->
            toggles[metric] = Switch(this).apply { text = metric.label; isChecked = metric.name in enabled; layout.addView(this) }
        }
        background = CheckBox(this).apply { text = "Allow automatic background synchronization"; isChecked = store.read().get("backgroundRequested")?.asBoolean ?: false; layout.addView(this) }
        consent = CheckBox(this).apply { text = "I consent to storing these selected health metrics in my LifeTrack account"; layout.addView(this) }
        button(layout, "Connect / update selected permissions") { requestSelectedPermissions() }
        button(layout, "Sync now") {
            runOperation {
                try { HealthSyncEngine(this@MainActivity).sync(foreground = true) }
                catch (error: Exception) { HealthSyncEngine(this@MainActivity).recordFailure(error) }
                showStatus()
            }
        }
        button(layout, "Manage / revoke Health Connect permissions") {
            try { startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)) }
            catch (_: Exception) { status.text = "Health Connect settings are unavailable on this device." }
        }
        button(layout, "Disconnect") {
            store.edit { it.addProperty("disconnectPending", true); it.addProperty("status", "DISCONNECT_PENDING") }
            SyncWorker.cancel(this)
            SyncWorker.now(this)
            runOperation { showStatus() }
        }
        button(layout, "Delete imported data") {
            android.app.AlertDialog.Builder(this).setMessage("Delete imported health data from LifeTrack and disconnect? Manual entries and Health Connect originals are kept.")
                .setNegativeButton("Cancel", null).setPositiveButton("Delete") { _, _ ->
                    runOperation {
                        store.read().text("connectionId")?.let { BackendApi(store).request("DELETE", "/health/data/$it") }
                        SyncWorker.cancel(this@MainActivity)
                        store.edit { it.remove("connectionId"); it.remove("tokens"); it.remove("pending"); it.remove("attempt"); it.addProperty("status", "DISCONNECTED") }
                        showStatus()
                    }
                }.show()
        }
        runOperation { showStatus() }
    }

    private fun field(layout: LinearLayout, hintText: String) = EditText(this).apply { hint = hintText; setSingleLine(true); layout.addView(this) }
    private fun button(layout: LinearLayout, label: String, action: () -> Unit) { layout.addView(Button(this).apply { text = label; setOnClickListener { action() } }) }
    private fun runOperation(operation: suspend () -> Unit) = lifecycleScope.launch {
        try { withContext(Dispatchers.IO) { operation() } }
        catch (_: Exception) { status.text = "The operation could not complete. Check your connection, permissions, and sign-in details." }
    }

    private fun signIn() {
        val endpoint = server.text.toString().trim().trimEnd('/')
        if (!endpoint.startsWith("https://") && !(BuildConfig.DEBUG && endpoint.startsWith("http://"))) { status.text = "Use an HTTPS backend URL."; return }
        val address = email.text.toString().trim()
        val secret = password.text.toString()
        val verification = code.text.toString().trim()
        runOperation {
            if (store.read().text("server") != null && store.read().text("server") != endpoint) {
                SyncWorker.cancel(this@MainActivity)
                store.edit { listOf("connectionId", "tokens", "pending", "attempt", "recordDays", "dirtyDays", "accessToken", "refreshToken").forEach(it::remove) }
            }
            store.edit { it.addProperty("server", endpoint) }
            val api = BackendApi(store)
            val session = if (pendingTwoFactor == null) api.request("POST", "/auth/login", JsonObject().apply { addProperty("email", address); addProperty("password", secret); addProperty("rememberMe", true) }, false)
                else api.request("POST", "/auth/2fa/verify-login", JsonObject().apply { addProperty("twoFactorToken", pendingTwoFactor); addProperty("code", verification); addProperty("rememberMe", true) }, false)
            if (session.get("requiresTwoFactor")?.asBoolean == true) {
                pendingTwoFactor = session.text("twoFactorToken")
                withContext(Dispatchers.Main) { status.text = "Enter your authenticator or backup code, then press Sign in again." }
            } else {
                if (store.read().text("userId") != session.getAsJsonObject("user").text("id")) {
                    SyncWorker.cancel(this@MainActivity)
                    store.edit { listOf("connectionId", "tokens", "pending", "attempt", "recordDays", "dirtyDays").forEach(it::remove) }
                }
                api.saveSession(session)
                pendingTwoFactor = null
                withContext(Dispatchers.Main) { password.setText(""); code.setText(""); status.text = "Signed in. Select metrics and grant permission to connect." }
            }
        }
    }

    private fun requestSelectedPermissions() {
        if (store.read().text("accessToken") == null) { status.text = "Sign in first."; return }
        if (!consent.isChecked) { status.text = "Consent is required before connecting."; return }
        val enabled = toggles.filterValues { it.isChecked }.keys
        if (enabled.isEmpty()) { status.text = "Select at least one metric."; return }
        if (HealthConnectClient.getSdkStatus(this) != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "Health Connect is unavailable. Install or update it on a supported Android device."
            return
        }
        val requested = enabled.map { it.permission }.toMutableSet()
        if (background.isChecked) {
            if (!HealthSyncEngine(this).backgroundAvailable()) { status.text = "Background reads are unavailable on this device. Automatic sync cannot be enabled."; return }
            requested.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
        }
        store.edit { state -> state.add("enabledMetrics", JsonArray().apply { enabled.forEach { add(it.name) } }); state.addProperty("backgroundRequested", background.isChecked) }
        permissions.launch(requested)
    }

    private suspend fun connectOrUpdate() {
        val client = HealthConnectClient.getOrCreate(this)
        val granted = client.permissionController.getGrantedPermissions()
        val state = store.read()
        val enabled = state.getAsJsonArray("enabledMetrics").map { HealthMetric.valueOf(it.asString) }
        val input = JsonObject().apply {
            addProperty("timezone", ZoneId.systemDefault().id)
            add("enabledMetrics", state.getAsJsonArray("enabledMetrics"))
            add("grantedMetrics", JsonArray().apply { enabled.filter { granted.contains(it.permission) }.forEach { add(it.name) } })
            addProperty("backgroundReadAvailable", HealthSyncEngine(this@MainActivity).backgroundAvailable())
            addProperty("backgroundReadGranted", granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND))
        }
        val id = state.text("connectionId")
        if (id == null) { input.addProperty("consent", true); input.addProperty("deviceName", android.os.Build.MODEL) }
        val connected = BackendApi(store).request(if (id == null) "POST" else "PATCH", if (id == null) "/health/connections" else "/health/connections/$id", input)
        store.edit {
            if (id == null) listOf("tokens", "pending", "attempt", "recordDays", "dirtyDays", "source_WEIGHT", "source_HEART_RATE").forEach(it::remove)
            it.addProperty("connectionId", connected.text("id")); it.addProperty("generation", connected.get("generation").asInt)
            it.addProperty("status", "CONNECTED"); it.remove("disconnectPending")
        }
        if (SyncPolicy.backgroundAllowed(state.get("backgroundRequested")?.asBoolean == true, HealthSyncEngine(this).backgroundAvailable(), granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND))) SyncWorker.schedule(this)
        else SyncWorker.cancel(this)
        showStatus()
        if (state.get("backgroundRequested")?.asBoolean == true && granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)) SyncWorker.now(this)
    }

    private suspend fun showStatus() {
        val state = store.read()
        val permissionText = if (HealthConnectClient.getSdkStatus(this) == HealthConnectClient.SDK_AVAILABLE) {
            val granted = HealthConnectClient.getOrCreate(this).permissionController.getGrantedPermissions()
            HealthMetric.entries.joinToString("\n") { "${it.label}: ${if (it.permission in granted) "Granted" else "Not granted"}" } +
                "\nBackground reads: ${if (HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted) "Granted" else "Not granted"}"
        } else "Health Connect unavailable"
        withContext(Dispatchers.Main) {
            status.text = "Status: ${state.text("status") ?: "Not connected"}\nLast successful sync: ${state.text("lastSuccessfulSyncAt") ?: "Never"}\nLast attempted sync: ${state.text("lastAttemptedSyncAt") ?: "Never"}\nRecords synced: ${state.get("recordsSynced")?.asInt ?: 0}\n${state.text("errorCode") ?: ""}\n$permissionText\n${state.text("recoveryScope") ?: ""}"
        }
    }
}