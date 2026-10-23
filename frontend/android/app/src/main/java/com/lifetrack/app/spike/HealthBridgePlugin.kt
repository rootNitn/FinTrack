package com.lifetrack.app.spike

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.ActivityCallback
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.UUID
import java.net.URI
import com.lifetrack.health.HealthSyncEngine
import com.lifetrack.health.SecureState
import com.lifetrack.health.text

@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val requestingPermissions = AtomicBoolean(false)
    private val metrics = linkedMapOf(
        "STEPS" to HealthPermission.getReadPermission(StepsRecord::class),
        "SLEEP" to HealthPermission.getReadPermission(SleepSessionRecord::class),
        "EXERCISE" to HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        "WEIGHT" to HealthPermission.getReadPermission(WeightRecord::class),
        "HEART_RATE" to HealthPermission.getReadPermission(HeartRateRecord::class),
    )
    private val connectionStore by lazy { context.getSharedPreferences("health_connection", android.content.Context.MODE_PRIVATE) }

    @PluginMethod
    fun getHealthConnectionStatus(call: PluginCall) {
        scope.launch {
            try {
                val sdkStatus = HealthConnectClient.getSdkStatus(context)
                val available = sdkStatus == HealthConnectClient.SDK_AVAILABLE
                val client = if (available) HealthConnectClient.getOrCreate(context) else null
                val granted = client?.permissionController?.getGrantedPermissions() ?: emptySet()
                call.resolve(JSObject().apply {
                    put("schemaVersion", 1)
                    put("provider", "HEALTH_CONNECT")
                    put("available", available)
                    put("sdkStatus", sdkStatus)
                    put("backgroundReadAvailable", client?.features?.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE)
                    put("backgroundReadGranted", HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted)
                    put("grantedMetrics", JSArray(metrics.filterValues { it in granted }.keys.toList()))
                    put("deviceName", android.os.Build.MODEL)
                    put("timezone", java.util.TimeZone.getDefault().id)
                    put("backgroundRequested", connectionStore.getBoolean("backgroundRequested", false))
                })
            } catch (_: Exception) {
                call.reject("Health Connect status could not be read", "HEALTH_STATUS_UNAVAILABLE")
            }
        }
    }

    @PluginMethod
    fun connectHealth(call: PluginCall) {
        val id = call.getString("connectionId")
        val generation = call.getInt("generation")
        val selected = call.getArray("enabledMetrics")
        val apiBaseUrl = call.getString("apiBaseUrl")
        val backgroundRequested = call.getBoolean("backgroundRequested", false) == true
        try {
            require(UUID.fromString(id).toString() == id)
            require(generation != null && generation >= 0)
            require(!apiBaseUrl.isNullOrBlank())
            val apiUri = URI(apiBaseUrl)
            require(apiUri.path.trimEnd('/').endsWith("/api/v1"))
            require(apiUri.scheme == "https" || (BuildConfig.DEBUG && apiUri.scheme == "http" && apiUri.host == "10.0.2.2"))
            require(selected != null && selected.length() > 0 && selected.length() <= metrics.size)
            val enabled = (0 until selected!!.length()).map { index ->
                val name = selected.get(index) as String
                require(name in metrics.keys)
                name
            }
            require(enabled.distinct().size == enabled.size)
            scope.launch {
                try {
                    val client = HealthConnectClient.getOrCreate(context)
                    val granted = client.permissionController.getGrantedPermissions()
                    require(enabled.any { metrics.getValue(it) in granted })
                    val backgroundGranted = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted
                    if (backgroundRequested) require(backgroundAvailable(client) && backgroundGranted)
                    SecureState(context).edit { state ->
                        val generationChanged = state.text("connectionId") != id || state.get("generation")?.asInt != generation
                        if (generationChanged) {
                            listOf("tokens", "pending", "attempt", "dirtyDays", "recordDays", "lastSuccessfulSyncAt", "lastAttemptedSyncAt", "recordsSynced", "errorCode", "recoveryScope", "source_WEIGHT", "source_HEART_RATE", "disconnectPending").forEach(state::remove)
                        }
                        state.addProperty("server", apiBaseUrl!!.trimEnd('/'))
                        state.addProperty("connectionId", id)
                        state.addProperty("generation", generation!!)
                        state.addProperty("backgroundRequested", backgroundRequested)
                        state.add("enabledMetrics", com.google.gson.JsonArray().apply { enabled.forEach { add(it) } })
                        state.addProperty("status", "CONNECTED")
                    }
                    val applied = connectionStore.edit()
                        .putString("connectionId", id)
                        .putInt("generation", generation!!)
                        .putStringSet("enabledMetrics", enabled.toSet())
                        .putBoolean("backgroundRequested", backgroundRequested)
                        .putString("state", "CONNECTED")
                        .commit()
                    check(applied)
                    if (backgroundRequested) {
                        CapacitorHealthSyncWorker.schedule(context)
                        CapacitorHealthSyncWorker.now(context)
                    } else CapacitorHealthSyncWorker.cancel(context)
                    call.resolve(getSyncStatusPayload())
                } catch (_: Exception) { call.reject("Connection requires a valid backend connection and at least one granted selected metric", "HEALTH_CONNECTION_INVALID") }
            }
        } catch (_: Exception) { call.reject("Connection requires a valid backend connection and selected metrics", "HEALTH_CONNECTION_INVALID") }
    }

    @PluginMethod
    fun disconnectHealth(call: PluginCall) {
        try {
            CapacitorHealthSyncWorker.cancel(context)
            SecureState(context).edit { state ->
                listOf("server", "connectionId", "generation", "backgroundRequested", "enabledMetrics", "accessToken", "tokens", "pending", "attempt", "dirtyDays", "recordDays").forEach(state::remove)
                state.addProperty("status", "DISCONNECTED")
            }
            if (connectionStore.edit().clear().commit()) call.resolve(getSyncStatusPayload())
            else call.reject("Local health connection could not be cleared", "HEALTH_DISCONNECT_FAILED")
        } catch (_: Exception) { call.reject("Local sync state could not be cleared", "HEALTH_DISCONNECT_FAILED") }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val requested: List<String> = try {
            val values = call.getArray("metrics")
            if (values == null) emptyList() else (0 until values.length()).map { index ->
                val value = values.get(index)
                require(value is String)
                value
            }
        } catch (_: Exception) { emptyList() }
        if (!HealthPermissionPolicy.valid(requested, call.getBoolean("consent", false) == true)) {
            call.reject("Select valid metrics and explicitly consent", "PERMISSION_OPTIONS_INVALID")
            return
        }
        if (!requestingPermissions.compareAndSet(false, true)) {
            call.reject("A permission request is already open", "PERMISSION_REQUEST_ACTIVE")
            return
        }
        scope.launch {
            try {
                if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
                    requestingPermissions.set(false)
                    call.reject("Health Connect is unavailable", "HEALTH_CONNECT_UNAVAILABLE")
                    return@launch
                }
                val client = HealthConnectClient.getOrCreate(context)
                val permissions = requested.map { metrics.getValue(it) }.toMutableSet()
                if (call.getBoolean("background", false) == true) {
                    if (client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) != HealthConnectFeatures.FEATURE_STATUS_AVAILABLE) {
                        requestingPermissions.set(false)
                        call.reject("Background reads are unsupported", "BACKGROUND_UNAVAILABLE")
                        return@launch
                    }
                    permissions.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
                }
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, permissions)
                activity.runOnUiThread {
                    try { startActivityForResult(call, intent, "onHealthPermissions") }
                    catch (_: Exception) { requestingPermissions.set(false); call.reject("Permission settings could not be opened", "PERMISSION_UI_UNAVAILABLE") }
                }
            } catch (_: Exception) {
                requestingPermissions.set(false)
                call.reject("Permissions could not be requested", "PERMISSION_REQUEST_FAILED")
            }
        }
    }

    @ActivityCallback
    private fun onHealthPermissions(call: PluginCall?, result: ActivityResult) {
        requestingPermissions.set(false)
        if (call != null) getHealthConnectionStatus(call)
    }

    @PluginMethod
    fun openPermissionSettings(call: PluginCall) {
        try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            activity.startActivity(intent)
            call.resolve()
        } catch (_: Exception) { call.reject("Health Connect settings are unavailable", "PERMISSION_UI_UNAVAILABLE") }
    }

    override fun handleOnResume() {
        super.handleOnResume()
        notifyListeners("permissionsChanged", JSObject())
    }

    @PluginMethod
    fun getSyncStatus(call: PluginCall) {
        call.resolve(getSyncStatusPayload())
    }

    @PluginMethod
    fun syncNow(call: PluginCall) {
        if (connectionStore.getString("connectionId", null) == null) {
            call.reject("Connect health data before syncing", "NOT_CONNECTED")
            return
        }
        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                val state = SecureState(context)
                val data = state.read()
                val server = data.text("server") ?: throw IllegalStateException("Backend is not configured")
                val connectionId = data.text("connectionId") ?: throw IllegalStateException("Health connection is no longer active")
                val generation = data.get("generation")?.asInt ?: throw IllegalStateException("Health connection is no longer active")
                val backgroundReady = data.get("backgroundRequested")?.asBoolean == true && backgroundAvailable(client) && HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted
                if (backgroundReady) {
                    val attemptId = CapacitorHealthSyncWorker.now(context)
                    call.resolve(getSyncStatusPayload().put("attemptId", attemptId).put("state", "SYNCING"))
                } else {
                    val session = SessionVaultStore.refreshSession(context, server)
                    val tokenStored = state.updateAccessTokenIfCurrent(server, connectionId, generation, session.get("accessToken").asString)
                    if (!tokenStored) {
                        call.resolve(getSyncStatusPayload())
                        return@launch
                    }
                    HealthSyncEngine(context, CapacitorHealthSyncWorker::cancel).sync(foreground = true)
                    call.resolve(getSyncStatusPayload())
                }
            } catch (error: Exception) {
                HealthSyncEngine(context, CapacitorHealthSyncWorker::cancel).recordFailure(error)
                call.reject("Health sync could not complete", "SYNC_FAILED")
            }
        }
    }

    private fun getSyncStatusPayload() = JSObject().apply {
            val id = connectionStore.getString("connectionId", null)
            val state = SecureState(context).read()
            put("schemaVersion", 1)
            put("state", state.text("status") ?: if (id == null) "DISCONNECTED" else "CONNECTED")
            put("reasonCode", state.text("errorCode") ?: if (id == null) "NOT_CONNECTED" else "READY")
            put("connectionId", id)
            put("generation", connectionStore.getInt("generation", 0))
            put("enabledMetrics", JSArray((connectionStore.getStringSet("enabledMetrics", emptySet()) ?: emptySet()).toList()))
            put("syncSupported", id != null)
            put("lastSuccessfulSyncAt", state.text("lastSuccessfulSyncAt"))
            put("lastAttemptedSyncAt", state.text("lastAttemptedSyncAt"))
            put("recordsSynced", state.get("recordsSynced")?.asInt ?: 0)
        }

    private fun backgroundAvailable(client: HealthConnectClient): Boolean =
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}