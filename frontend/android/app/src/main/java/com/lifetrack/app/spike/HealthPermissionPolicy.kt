package com.lifetrack.app.spike

object HealthPermissionPolicy {
    val supportedMetrics = setOf("STEPS", "SLEEP", "EXERCISE", "WEIGHT", "HEART_RATE")
    fun valid(metrics: List<String>, consent: Boolean): Boolean = consent && metrics.isNotEmpty() &&
        metrics.size <= supportedMetrics.size && metrics.distinct().size == metrics.size && metrics.all { it in supportedMetrics }
}