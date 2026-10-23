package com.lifetrack.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.google.gson.JsonArray
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.reflect.KClass

class PermissionProblem : Exception()
class RecoveryProblem : Exception()

class HealthSyncEngine(
    private val context: Context,
    private val cancelScheduledWork: (Context) -> Unit = SyncWorker::cancel,
) {
    private val store = SecureState(context)
    private val api = BackendApi(store)
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun sync(foreground: Boolean = false) = lock.withLock {
        var state = store.read()
        val connectionId = state.text("connectionId") ?: return@withLock
        if (state.get("disconnectPending")?.asBoolean == true) {
            api.request("DELETE", "/health/connections/$connectionId")
            store.edit { it.remove("connectionId"); it.remove("disconnectPending") }
            cancelScheduledWork(context)
            return@withLock
        }
        store.edit { it.addProperty("lastAttemptedSyncAt", Instant.now().toString()); it.addProperty("status", "SYNCING") }
        val remote = api.request("GET", "/health/sync/status").get("connection")
        if (remote == null || remote.isJsonNull || !remote.asJsonObject.get("disconnectedAt").isJsonNull) {
            store.edit { it.remove("connectionId"); it.addProperty("status", "DISCONNECTED") }
            cancelScheduledWork(context)
            return@withLock
        }
        val connection = remote.asJsonObject
        if (connection.get("generation").asInt != state.get("generation")?.asInt) {
            store.edit { it.remove("tokens"); it.remove("pending"); it.remove("attempt"); it.remove("dirtyDays"); it.remove("recordDays"); it.addProperty("generation", connection.get("generation").asInt) }
        }
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) throw PermissionProblem()
        val granted = client.permissionController.getGrantedPermissions()
        if (!foreground && state.get("backgroundRequested")?.asBoolean != true) return@withLock
        if (!foreground && (!backgroundAvailable() || !granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND))) throw PermissionProblem()
        val enabled = connection.getAsJsonArray("enabledMetrics").map { HealthMetric.valueOf(it.asString) }
        val permitted = SyncPolicy.eligible(enabled, granted)
        val permissions = JsonObject().apply {
            addProperty("timezone", ZoneId.systemDefault().id)
            add("enabledMetrics", JsonArray().apply { enabled.forEach { add(it.name) } })
            add("grantedMetrics", JsonArray().apply { permitted.forEach { add(it.name) } })
            addProperty("backgroundReadAvailable", backgroundAvailable())
            addProperty("backgroundReadGranted", granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND))
        }
        api.request("PATCH", "/health/connections/$connectionId", permissions)
        if (permitted.isEmpty()) throw PermissionProblem()
        state = store.read()
        val started = state.text("attempt") ?: Instant.now().toString().also { value -> store.edit { it.addProperty("attempt", value) } }
        state.getAsJsonObject("pending")?.let { api.request("POST", "/health/sync", it); store.edit { current -> current.remove("pending") } }
        api.request("POST", "/health/sync/$connectionId/status", JsonObject().apply { addProperty("status", "SYNCING"); add("errorCode", JsonNull.INSTANCE) })
        for (metric in permitted) {
            var token = store.read().getAsJsonObject("tokens")?.text(metric.name)
            if (token == null) token = snapshot(metric, started)
            var more = true
            do {
                val changes = client.getChanges(token!!)
                if (changes.changesTokenExpired) {
                    token = snapshot(metric, started)
                    continue
                }
                val records = JsonArray()
                val deletions = JsonArray()
                val changedRecords = mutableListOf<Record>()
                val deletedIds = mutableListOf<String>()
                for (change in changes.changes) {
                    when (change) {
                        is UpsertionChange -> normalize(change.record, metric)?.let { records.add(it); changedRecords.add(change.record) }
                        is DeletionChange -> {
                            deletedIds.add(change.recordId)
                            deletions.add(JsonObject().apply { addProperty("sourceRecordId", change.recordId); addProperty("metricType", metric.name) })
                        }
                    }
                }
                remember(changedRecords, metric, deletedIds)
                val recordItems = records.toList()
                val deleteItems = deletions.toList()
                val pages = maxOf(1, (maxOf(recordItems.size, deleteItems.size) + 499) / 500)
                for (index in 0 until pages) {
                    upload(batch(started).apply {
                        add("records", JsonArray().apply { recordItems.drop(index * 500).take(500).forEach { add(it) } })
                        add("deletions", JsonArray().apply { deleteItems.drop(index * 500).take(500).forEach { add(it) } })
                    })
                }
                token = changes.nextChangesToken
                saveToken(metric, token)
                more = changes.hasMore
            } while (more)
        }
        val today = LocalDate.now()
        val dirty = (store.read().getAsJsonArray("dirtyDays")?.map { LocalDate.parse(it.asString) } ?: emptyList())
            .plus(listOf(today, today.minusDays(1))).distinct().sorted()
        for (dates in dirty.chunked(32)) {
            val daily = JsonArray()
            for (date in dates) daily.add(summary(date, permitted))
            upload(batch(started).apply { add("daily", daily) })
        }
        upload(batch(started).apply { addProperty("completed", true) })
        val finalStatus = api.request("GET", "/health/sync/status").getAsJsonObject("connection")
        store.edit {
            it.remove("attempt"); it.remove("dirtyDays")
            it.addProperty("lastSuccessfulSyncAt", finalStatus.text("lastSuccessfulSyncAt"))
            it.addProperty("recordsSynced", finalStatus.get("recordsSynced").asInt)
            it.addProperty("status", if (permitted.size == enabled.size) "SUCCESS" else "PARTIAL_PERMISSIONS")
            it.remove("errorCode")
        }
    }

    private fun batch(started: String) = JsonObject().apply {
        val state = store.read()
        addProperty("connectionId", state.text("connectionId"))
        addProperty("generation", state.get("generation").asInt)
        addProperty("batchId", UUID.randomUUID().toString())
        addProperty("syncStartedAt", started)
        addProperty("completed", false)
        add("records", JsonArray()); add("deletions", JsonArray()); add("daily", JsonArray())
    }

    private fun upload(body: JsonObject) {
        store.edit { it.add("pending", body) }
        api.request("POST", "/health/sync", body)
        store.edit { it.remove("pending") }
    }

    private fun saveToken(metric: HealthMetric, token: String) = store.edit { state ->
        val tokens = state.getAsJsonObject("tokens") ?: JsonObject().also { state.add("tokens", it) }
        tokens.addProperty(metric.name, token)
    }

    private suspend fun snapshot(metric: HealthMetric, started: String): String {
        val token = client.getChangesToken(ChangesTokenRequest(setOf(metric.recordType)))
        val to = Instant.now()
        val from = to.minus(29, ChronoUnit.DAYS)
        val records = read(metric, from, to)
        if (records.size > 50000) throw RecoveryProblem()
        remember(records, metric)
        records.mapNotNull { normalize(it, metric) }.chunked(500).forEach { items ->
            upload(batch(started).apply { add("records", JsonArray().apply { items.forEach { add(it) } }) })
        }
        upload(batch(started).apply {
            add("reconciliation", JsonObject().apply {
                addProperty("metricType", metric.name); addProperty("from", from.toString()); addProperty("to", to.toString())
                add("sourceRecordIds", JsonArray().apply { records.forEach { add(it.metadata.id) } })
            })
        })
        store.edit { state ->
            val days = state.getAsJsonArray("dirtyDays") ?: JsonArray().also { state.add("dirtyDays", it) }
            for (offset in 0L..28L) days.add(LocalDate.now().minusDays(offset).toString())
            state.addProperty("recoveryScope", "Accessible recent history reconciled; older changes may be unavailable after token expiry.")
        }
        saveToken(metric, token)
        return token
    }

    @Suppress("UNCHECKED_CAST")
    private suspend fun read(metric: HealthMetric, from: Instant, to: Instant, source: String? = null): List<Record> {
        val result = mutableListOf<Record>()
        var pageToken: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(
                recordType = metric.recordType as KClass<Record>,
                timeRangeFilter = TimeRangeFilter.between(from, to),
                dataOriginFilter = source?.let { setOf(DataOrigin(it)) } ?: emptySet(),
                pageSize = 500, pageToken = pageToken,
            ))
            result.addAll(page.records)
            pageToken = page.pageToken
            if (result.size > 50000) throw RecoveryProblem()
        } while (!pageToken.isNullOrEmpty())
        return result
    }

    private fun bounds(record: Record): Pair<Instant, Instant> = when (record) {
        is StepsRecord -> record.startTime to record.endTime
        is SleepSessionRecord -> record.startTime to record.endTime
        is ExerciseSessionRecord -> record.startTime to record.endTime
        is WeightRecord -> record.time to record.time
        is HeartRateRecord -> record.startTime to record.endTime
        else -> throw IllegalArgumentException("Unsupported metric")
    }

    private fun normalize(record: Record, metric: HealthMetric): JsonObject? {
        val value = when (record) {
            is StepsRecord -> record.count.toDouble()
            is SleepSessionRecord -> java.time.Duration.between(record.startTime, record.endTime).toMillis() / 60000.0
            is ExerciseSessionRecord -> java.time.Duration.between(record.startTime, record.endTime).toMillis() / 60000.0
            is WeightRecord -> record.weight.inKilograms
            is HeartRateRecord -> if (record.samples.isEmpty()) return null else record.samples.map { it.beatsPerMinute.toDouble() }.average()
            else -> return null
        }
        val (start, end) = bounds(record)
        val rawData = JsonObject().apply {
            when (record) {
                is SleepSessionRecord -> add("stages", JsonArray().apply {
                    record.stages.forEach { stage ->
                        add(JsonObject().apply {
                            addProperty("stage", when (stage.stage) {
                                SleepSessionRecord.STAGE_TYPE_AWAKE -> "AWAKE"
                                SleepSessionRecord.STAGE_TYPE_SLEEPING -> "SLEEPING"
                                SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "OUT_OF_BED"
                                SleepSessionRecord.STAGE_TYPE_LIGHT -> "LIGHT"
                                SleepSessionRecord.STAGE_TYPE_DEEP -> "DEEP"
                                SleepSessionRecord.STAGE_TYPE_REM -> "REM"
                                else -> "UNKNOWN"
                            })
                            addProperty("startTime", stage.startTime.toString())
                            addProperty("endTime", stage.endTime.toString())
                        })
                    }
                })
                is HeartRateRecord -> add("samples", JsonArray().apply {
                    record.samples.forEach { sample ->
                        add(JsonObject().apply {
                            addProperty("time", sample.time.toString())
                            addProperty("beatsPerMinute", sample.beatsPerMinute.toDouble())
                        })
                    }
                })
                is ExerciseSessionRecord -> addProperty("exerciseType", record.exerciseType.toString())
            }
            if (record is SleepSessionRecord) {
                record.startZoneOffset?.let { addProperty("startZoneOffset", it.id) }
                record.endZoneOffset?.let { addProperty("endZoneOffset", it.id) }
            }
        }
        return JsonObject().apply {
            addProperty("sourceRecordId", record.metadata.id); addProperty("metricType", metric.name)
            addProperty("source", record.metadata.dataOrigin.packageName)
            addProperty("startTime", start.toString()); addProperty("endTime", end.toString())
            addProperty("modifiedAt", record.metadata.lastModifiedTime.toString()); addProperty("value", value)
            addProperty("unit", when (metric) { HealthMetric.STEPS -> "count"; HealthMetric.WEIGHT -> "kg"; HealthMetric.HEART_RATE -> "bpm"; else -> "minutes" })
            add("rawData", rawData)
        }
    }

    private fun remember(records: List<Record>, metric: HealthMetric, deletedIds: List<String> = emptyList()) {
        val zone = ZoneId.systemDefault()
        store.edit { state ->
            val dirty = state.getAsJsonArray("dirtyDays") ?: JsonArray().also { state.add("dirtyDays", it) }
            val mapping = state.getAsJsonObject("recordDays") ?: JsonObject().also { state.add("recordDays", it) }
            for (record in records) {
                val (start, end) = bounds(record)
                val days = SyncPolicy.dates(start, end, zone, metric == HealthMetric.SLEEP)
                days.forEach { dirty.add(it) }
                val key = "${metric.name}:${record.metadata.id}"
                mapping.getAsJsonArray(key)?.forEach { dirty.add(it) }
                mapping.add(key, JsonArray().apply { days.forEach { add(it) } })
                if (metric in listOf(HealthMetric.WEIGHT, HealthMetric.HEART_RATE) && state.text("source_${metric.name}") == null) state.addProperty("source_${metric.name}", record.metadata.dataOrigin.packageName)
            }
            for (id in deletedIds) {
                val key = "${metric.name}:$id"
                mapping.getAsJsonArray(key)?.forEach { dirty.add(it) }
                mapping.remove(key)
            }
            state.add("dirtyDays", JsonArray().apply { dirty.map { it.asString }.distinct().forEach { add(it) } })
        }
    }

    private suspend fun summary(date: LocalDate, permitted: List<HealthMetric>): JsonObject {
        val zone = ZoneId.systemDefault()
        val start = date.atStartOfDay(zone).toInstant()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant()
        val result = JsonObject().apply { addProperty("date", date.toString()) }
        fun put(name: String, value: Number?) { if (value == null) result.add(name, JsonNull.INSTANCE) else result.addProperty(name, value) }
        if (HealthMetric.STEPS in permitted) put("steps", client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))[StepsRecord.COUNT_TOTAL])
        if (HealthMetric.SLEEP in permitted) {
            val sleepStart = date.minusDays(1).atTime(18, 0).atZone(zone).toInstant()
            val sleepEnd = date.atTime(18, 0).atZone(zone).toInstant()
            put("sleepMinutes", client.aggregate(AggregateRequest(setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL), TimeRangeFilter.between(sleepStart, sleepEnd)))[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMillis()?.div(60000.0))
        }
        if (HealthMetric.EXERCISE in permitted) put("exerciseMinutes", client.aggregate(AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL), TimeRangeFilter.between(start, end)))[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMillis()?.div(60000.0))
        if (HealthMetric.WEIGHT in permitted) {
            val source = store.read().text("source_WEIGHT")
            put("weightKg", if (source == null) null else read(HealthMetric.WEIGHT, start, end, source).filterIsInstance<WeightRecord>().maxByOrNull { it.time }?.weight?.inKilograms)
        }
        if (HealthMetric.HEART_RATE in permitted) {
            val source = store.read().text("source_HEART_RATE")
            put("averageHeartRate", if (source == null) null else client.aggregate(AggregateRequest(setOf(HeartRateRecord.BPM_AVG), TimeRangeFilter.between(start, end), setOf(DataOrigin(source))))[HeartRateRecord.BPM_AVG])
        }
        return result
    }

    fun recordFailure(error: Exception): Boolean {
        if (error is CancellationException) return true
        val code = failureCode(error)
        val status = failureStatus(code)
        store.edit { it.addProperty("status", status); it.addProperty("errorCode", code) }
        postFailureStatus(store.read().text("connectionId"), status, code)
        return shouldRetry(error, code)
    }

    fun recordFailureForConnection(
        error: Exception,
        server: String,
        connectionId: String,
        generation: Int,
        requireBackgroundRequest: Boolean,
    ): Boolean? {
        if (error is CancellationException) return true
        val code = failureCode(error)
        val status = failureStatus(code)
        if (!store.updateFailureIfCurrent(server, connectionId, generation, status, code, requireBackgroundRequest)) return null
        postFailureStatus(connectionId, status, code)
        return shouldRetry(error, code)
    }

    private fun failureCode(error: Exception): String = when {
        error is PermissionProblem || error is SecurityException || (error is ApiFailure && error.status == 403) -> "PERMISSION"
        error is RecoveryProblem -> "HISTORY_LIMIT"
        error is ApiFailure && error.status == 401 -> "AUTH"
        error is ApiFailure && error.status == 409 -> "TOKEN_EXPIRED"
        error is ApiFailure && error.status < 500 && error.status != 429 -> "SERVER"
        else -> "NETWORK"
    }

    private fun failureStatus(code: String): String = when (code) {
        "PERMISSION" -> "PERMISSION_REQUIRED"
        "AUTH" -> "SIGN_IN_REQUIRED"
        "HISTORY_LIMIT", "TOKEN_EXPIRED" -> "RECOVERY_REQUIRED"
        else -> "RETRYING"
    }

    private fun shouldRetry(error: Exception, code: String): Boolean =
        code == "NETWORK" || (error is ApiFailure && SyncPolicy.transient(error.status))

    private fun postFailureStatus(connectionId: String?, status: String, code: String) {
        try {
            connectionId?.let { api.request("POST", "/health/sync/$it/status", JsonObject().apply { addProperty("status", status); addProperty("errorCode", code) }) }
        } catch (_: Exception) { }
    }

    fun backgroundAvailable(): Boolean = client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    companion object { private val lock = Mutex() }
}