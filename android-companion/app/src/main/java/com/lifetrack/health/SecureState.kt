package com.lifetrack.health

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureState(context: Context) {
    private val preferences = context.getSharedPreferences("health_sync", Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey("lifetrack_health", null) as? SecretKey
        if (existing != null) return existing
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("lifetrack_health", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun read(): JsonObject = synchronized(lock) {
        val encrypted = preferences.getString("state", null) ?: return@synchronized JsonObject()
        val parts = encrypted.split(":")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        JsonParser.parseString(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)).asJsonObject
    }
    fun edit(operation: (JsonObject) -> Unit) = synchronized(lock) {
        val state = read()
        operation(state)
        write(state)
    }
    fun updateAccessTokenIfCurrent(
        server: String,
        connectionId: String,
        generation: Int,
        accessToken: String,
        requireBackgroundRequest: Boolean = false,
    ): Boolean = synchronized(lock) {
        val state = read()
        if (!isCurrentHealthConnection(state, server, connectionId, generation, requireBackgroundRequest)) return@synchronized false
        state.addProperty("accessToken", accessToken)
        write(state)
        true
    }
    fun updateFailureIfCurrent(
        server: String,
        connectionId: String,
        generation: Int,
        status: String,
        errorCode: String,
        requireBackgroundRequest: Boolean = false,
    ): Boolean = synchronized(lock) {
        val state = read()
        if (!isCurrentHealthConnection(state, server, connectionId, generation, requireBackgroundRequest)) return@synchronized false
        state.addProperty("status", status)
        state.addProperty("errorCode", errorCode)
        write(state)
        true
    }
    private fun write(state: JsonObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(state.toString().toByteArray(Charsets.UTF_8))
        check(preferences.edit().putString("state", Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit())
    }
    companion object { private val lock = Any() }
}

internal fun isCurrentHealthConnection(
    state: JsonObject,
    server: String,
    connectionId: String,
    generation: Int,
    requireBackgroundRequest: Boolean = false,
): Boolean = state.text("server") == server && state.text("connectionId") == connectionId &&
    state.get("generation")?.asInt == generation &&
    (!requireBackgroundRequest || state.get("backgroundRequested")?.asBoolean == true)

fun JsonObject.text(name: String): String? = get(name)?.takeUnless { it.isJsonNull }?.asString