package com.lifetrack.app.spike

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.lifetrack.health.ApiFailure
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class SessionRefreshCoordinator {
    private val mutex = Mutex()

    suspend fun <T> withLock(block: suspend () -> T): T {
        mutex.lock()
        return try { block() } finally { mutex.unlock() }
    }
}

object SessionVaultStore {
    private val coordinator = SessionRefreshCoordinator()
    private const val PREFS = "session_vault"
    private const val KEY_ALIAS = "lifetrack_session_v1"

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    private fun readUnlocked(context: Context): String? {
        val stored = prefs(context).getString("refresh", null) ?: return null
        val parts = stored.split(":")
        require(parts.size == 2)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        return String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
    }

    private fun writeUnlocked(context: Context, token: String) {
        require(token.isNotBlank() && token.length <= 16384)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        val value = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)
        check(prefs(context).edit().putString("refresh", value).commit())
    }

    suspend fun read(context: Context): String? = coordinator.withLock { withContext(Dispatchers.IO) {
        try { readUnlocked(context) } catch (_: Exception) { prefs(context).edit().remove("refresh").commit(); null }
    } }

    suspend fun write(context: Context, token: String) = coordinator.withLock { withContext(Dispatchers.IO) { writeUnlocked(context, token) } }

    suspend fun clear(context: Context) = coordinator.withLock { withContext(Dispatchers.IO) {
        check(prefs(context).edit().clear().commit())
    } }

    suspend fun refreshSession(context: Context, apiBase: String): JsonObject = coordinator.withLock {
        withContext(Dispatchers.IO) {
            val uri = Uri.parse(apiBase)
            require(uri.path?.trimEnd('/')?.endsWith("/api/v1") == true)
            require(uri.scheme == "https" || (BuildConfig.DEBUG && uri.scheme == "http" && uri.host == "10.0.2.2"))
            val refreshToken = readUnlocked(context) ?: throw ApiFailure(401)
            val connection = URL(apiBase.trimEnd('/') + "/auth/refresh").openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(JsonObject().apply { addProperty("refreshToken", refreshToken) }.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                if (status !in 200..299) throw ApiFailure(status)
                val root = JsonParser.parseString(connection.inputStream.bufferedReader().use { it.readText() }).asJsonObject
                val data = root.getAsJsonObject("data") ?: throw IllegalStateException("Invalid auth response")
                val nextRefresh = data.get("refreshToken")?.asString ?: throw IllegalStateException("Invalid auth response")
                writeUnlocked(context, nextRefresh)
                data
            } finally { connection.disconnect() }
        }
    }
}