package com.lifetrack.health

import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import kotlin.reflect.KClass

enum class HealthMetric(val recordType: KClass<out Record>, val label: String) {
    STEPS(StepsRecord::class, "Steps"),
    SLEEP(SleepSessionRecord::class, "Sleep"),
    EXERCISE(ExerciseSessionRecord::class, "Exercise"),
    WEIGHT(WeightRecord::class, "Weight"),
    HEART_RATE(HeartRateRecord::class, "Heart rate");

    val permission: String get() = HealthPermission.getReadPermission(recordType)
}