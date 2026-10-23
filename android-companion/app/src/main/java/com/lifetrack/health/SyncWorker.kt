package com.lifetrack.health

import android.content.Context
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class SyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            HealthSyncEngine(applicationContext).sync()
            Result.success()
        } catch (error: Exception) {
            val retry = HealthSyncEngine(applicationContext).recordFailure(error)
            if (retry) Result.retry() else Result.failure()
        }
    }
    companion object {
        fun schedule(context: Context) {
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            val request = PeriodicWorkRequestBuilder<SyncWorker>(SyncPolicy.PERIODIC_HOURS, TimeUnit.HOURS)
                .setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("health-periodic", ExistingPeriodicWorkPolicy.KEEP, request)
        }
        fun now(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniqueWork("health-manual", ExistingWorkPolicy.KEEP, request)
        }
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork("health-periodic")
            WorkManager.getInstance(context).cancelUniqueWork("health-manual")
        }
    }
}