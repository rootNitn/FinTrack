package com.lifetrack.app.spike

import android.content.Context
import androidx.work.*
import com.lifetrack.health.HealthSyncEngine
import com.lifetrack.health.SecureState
import com.lifetrack.health.SyncPolicy
import com.lifetrack.health.ApiFailure
import com.lifetrack.health.text
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class CapacitorHealthSyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val state = SecureState(applicationContext)
        var phase = "refresh"
        var requestServer: String? = null
        var requestConnectionId: String? = null
        var requestGeneration: Int? = null
        try {
            val initialState = state.read()
            val server = initialState.text("server") ?: return@withContext Result.success()
            val connectionId = initialState.text("connectionId") ?: return@withContext Result.success()
            val generation = initialState.get("generation")?.asInt ?: return@withContext Result.success()
            if (initialState.get("backgroundRequested")?.asBoolean != true) return@withContext Result.success()
            requestServer = server
            requestConnectionId = connectionId
            requestGeneration = generation
            val session = SessionVaultStore.refreshSession(applicationContext, server)
            val tokenStored = state.updateAccessTokenIfCurrent(
                server, connectionId, generation, session.get("accessToken").asString, requireBackgroundRequest = true,
            )
            if (!tokenStored) return@withContext Result.success()
            phase = "sync"
            HealthSyncEngine(applicationContext, CapacitorHealthSyncWorker::cancel).sync()
            Result.success()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            if (BuildConfig.DEBUG) {
                val status = (error as? ApiFailure)?.status?.let { ", http=$it" } ?: ""
                android.util.Log.w("CapHealthSyncWorker", "Work failed during $phase (${error.javaClass.simpleName}$status)")
            }
            val engine = HealthSyncEngine(applicationContext, CapacitorHealthSyncWorker::cancel)
            val server = requestServer
            val connectionId = requestConnectionId
            val generation = requestGeneration
            val retry = if (server != null && connectionId != null && generation != null) {
                engine.recordFailureForConnection(error, server, connectionId, generation, requireBackgroundRequest = true)
            } else engine.recordFailure(error)
            if (retry == null) Result.success() else if (retry) Result.retry() else Result.failure()
        }
    }

    companion object {
        private fun periodicRequest() = PeriodicWorkRequestBuilder<CapacitorHealthSyncWorker>(SyncPolicy.PERIODIC_HOURS, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()

        private fun oneTimeRequest() = OneTimeWorkRequestBuilder<CapacitorHealthSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()

        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "lifetrack-health-periodic",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicRequest(),
            )
        }

        fun now(context: Context): String {
            val request = oneTimeRequest()
            WorkManager.getInstance(context).enqueueUniqueWork("lifetrack-health-manual", ExistingWorkPolicy.KEEP, request)
            return request.id.toString()
        }

        fun resumeAfterBoot(context: Context) {
            val workManager = WorkManager.getInstance(context)
            workManager.enqueueUniquePeriodicWork(
                "lifetrack-health-periodic",
                ExistingPeriodicWorkPolicy.UPDATE,
                periodicRequest(),
            )
            workManager.enqueueUniqueWork("lifetrack-health-manual", ExistingWorkPolicy.REPLACE, oneTimeRequest())
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork("lifetrack-health-periodic")
            WorkManager.getInstance(context).cancelUniqueWork("lifetrack-health-manual")
        }
    }
}