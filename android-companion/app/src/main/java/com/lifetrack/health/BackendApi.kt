package com.lifetrack.health

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiFailure(val status: Int) : IOException("Backend request failed ($status)")

class BackendApi(private val store: SecureState) {
    private val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(false).build()
    fun request(method: String, path: String, body: JsonObject? = null, authenticated: Boolean = true, retryAuth: Boolean = true): JsonObject {
        val state = store.read()
        val base = state.text("server") ?: throw IOException("Server is not configured")
        require(base.startsWith("https://") || (BuildConfig.DEBUG && base.startsWith("http://")))
        val builder = Request.Builder().url(base.trimEnd('/') + path)
        if (authenticated) builder.header("Authorization", "Bearer ${state.text("accessToken") ?: ""}")
        val payload = body?.toString()?.toRequestBody("application/json".toMediaType())
        builder.method(method, if (method in listOf("POST", "PUT", "PATCH")) payload ?: "{}".toRequestBody("application/json".toMediaType()) else null)
        client.newCall(builder.build()).execute().use { response ->
            if (response.code == 401 && authenticated && retryAuth) {
                val refresh = JsonObject().apply { addProperty("refreshToken", store.read().text("refreshToken")) }
                val session = request("POST", "/auth/refresh", refresh, false)
                saveSession(session)
                return request(method, path, body, authenticated, false)
            }
            if (!response.isSuccessful) throw ApiFailure(response.code)
            val envelope = JsonParser.parseString(response.body?.string() ?: "{}").asJsonObject
            return envelope.getAsJsonObject("data") ?: envelope
        }
    }
    fun saveSession(session: JsonObject) {
        store.edit { state ->
            state.addProperty("accessToken", session.get("accessToken").asString)
            state.addProperty("refreshToken", session.get("refreshToken").asString)
            state.addProperty("userId", session.getAsJsonObject("user").get("id").asString)
        }
    }
}