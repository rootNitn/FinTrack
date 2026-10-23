package com.lifetrack.app.spike

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class HealthSyncBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val appContext = context.applicationContext
        val connection = appContext.getSharedPreferences("health_connection", Context.MODE_PRIVATE)
        if (!connection.getBoolean("backgroundRequested", false)) return
        if (connection.getString("connectionId", null).isNullOrBlank()) return

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                CapacitorHealthSyncWorker.resumeAfterBoot(appContext)
            } catch (error: Exception) {
                if (BuildConfig.DEBUG) {
                    android.util.Log.w("CapHealthBoot", "Work scheduling failed (${error.javaClass.simpleName})")
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
