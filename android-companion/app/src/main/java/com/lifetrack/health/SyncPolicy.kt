package com.lifetrack.health

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

object SyncPolicy {
    const val PERIODIC_HOURS = 6L
    fun backgroundAllowed(requested: Boolean, available: Boolean, granted: Boolean) = requested && available && granted
    fun eligible(enabled: List<HealthMetric>, granted: Set<String>) = enabled.filter { it.permission in granted }
    fun dates(start: Instant, end: Instant, zone: ZoneId, sleep: Boolean): List<String> {
        val first = start.atZone(zone).toLocalDate()
        val last = end.atZone(zone).toLocalDate().plusDays(if (sleep) 1 else 0)
        return generateSequence(first) { it.plusDays(1) }.takeWhile { it <= last }.take(32).map(LocalDate::toString).toList()
    }
    fun transient(status: Int) = status >= 500 || status == 429
}