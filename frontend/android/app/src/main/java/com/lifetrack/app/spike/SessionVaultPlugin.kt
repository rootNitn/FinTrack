package com.lifetrack.app.spike

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.gson.JsonObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import com.lifetrack.health.ApiFailure

@CapacitorPlugin(name = "SessionVault")
class SessionVaultPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @PluginMethod
    fun readRefreshToken(call: PluginCall) = scope.launch {
        call.resolve(JSObject().put("token", SessionVaultStore.read(context) ?: JSObject.NULL))
    }

    @PluginMethod
    fun writeRefreshToken(call: PluginCall) = scope.launch {
        val token = call.getString("token")
        if (token.isNullOrBlank() || token.length > 16384) { call.reject("Invalid session credential", "SESSION_INVALID"); return@launch }
        try {
            SessionVaultStore.write(context, token)
            call.resolve()
        } catch (_: Exception) { call.reject("Secure session could not be saved", "SESSION_SAVE_FAILED") }
    }

    @PluginMethod
    fun clear(call: PluginCall) = scope.launch {
        try { SessionVaultStore.clear(context); call.resolve() }
        catch (_: Exception) { call.reject("Secure session could not be cleared", "SESSION_CLEAR_FAILED") }
    }

    @PluginMethod
    fun refreshSession(call: PluginCall) = scope.launch {
        val apiBaseUrl = call.getString("apiBaseUrl")
        if (apiBaseUrl.isNullOrBlank()) { call.reject("Backend URL is required", "API_URL_INVALID"); return@launch }
        try {
            val session = SessionVaultStore.refreshSession(context, apiBaseUrl)
            call.resolve(JSObject().apply {
                put("accessToken", session.get("accessToken").asString)
                put("refreshToken", session.get("refreshToken").asString)
                val user = session.getAsJsonObject("user")
                put("user", JSObject().apply {
                    for ((name, value) in user.entrySet()) {
                        val converted: Any? = when {
                            value.isJsonNull -> null
                            value.asJsonPrimitive.isBoolean -> value.asBoolean
                            value.asJsonPrimitive.isNumber -> value.asNumber
                            else -> value.asString
                        }
                        put(name, converted)
                    }
                })
            })
        } catch (error: ApiFailure) {
            call.reject("Session refresh failed", if (error.status == 401) "AUTH_REQUIRED" else "SESSION_REFRESH_FAILED")
        } catch (_: Exception) { call.reject("Session refresh is unavailable", "SESSION_REFRESH_FAILED") }
    }

}