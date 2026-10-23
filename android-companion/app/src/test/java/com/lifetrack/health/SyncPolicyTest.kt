package com.lifetrack.health

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class SyncPolicyTest {
    @Test fun noPermissionMeansNoRecords() {
        assertTrue(SyncPolicy.eligible(HealthMetric.entries, emptySet()).isEmpty())
    }
    @Test fun partialPermissionOnlyIncludesGrantedSelectedMetrics() {
        assertEquals(listOf(HealthMetric.STEPS), SyncPolicy.eligible(listOf(HealthMetric.STEPS, HealthMetric.WEIGHT), setOf(HealthMetric.STEPS.permission, HealthMetric.SLEEP.permission)))
    }
    @Test fun backgroundRequiresConsentFeatureAndPermission() {
        assertFalse(SyncPolicy.backgroundAllowed(false, true, true))
        assertFalse(SyncPolicy.backgroundAllowed(true, false, true))
        assertFalse(SyncPolicy.backgroundAllowed(true, true, false))
        assertTrue(SyncPolicy.backgroundAllowed(true, true, true))
    }
    @Test fun transientFailuresRetryButAuthDoesNotLoop() {
        assertTrue(SyncPolicy.transient(503)); assertTrue(SyncPolicy.transient(429))
        assertFalse(SyncPolicy.transient(401)); assertFalse(SyncPolicy.transient(403))
    }
    @Test fun sleepCrossingMidnightDirtiesWakeDay() {
        val dates = SyncPolicy.dates(Instant.parse("2026-10-04T22:00:00Z"), Instant.parse("2026-10-05T06:00:00Z"), ZoneId.of("UTC"), true)
        assertTrue("2026-10-05" in dates)
    }
    @Test fun timezoneAndDstUseLocalDates() {
        assertEquals("2026-10-05", SyncPolicy.dates(Instant.parse("2026-10-04T20:00:00Z"), Instant.parse("2026-10-04T20:00:00Z"), ZoneId.of("Asia/Kolkata"), false).single())
        assertEquals("2026-03-08", SyncPolicy.dates(Instant.parse("2026-03-08T07:00:00Z"), Instant.parse("2026-03-08T08:00:00Z"), ZoneId.of("America/New_York"), false).single())
    }
}