package com.lifetrack.app.spike

import org.junit.Assert.*
import org.junit.Test

class HealthPermissionPolicyTest {
    @Test fun requiresExplicitConsent() { assertFalse(HealthPermissionPolicy.valid(listOf("STEPS"), false)) }
    @Test fun acceptsOnlySelectedMetrics() { assertTrue(HealthPermissionPolicy.valid(listOf("STEPS", "SLEEP"), true)) }
    @Test fun rejectsEmptyUnknownAndDuplicateMetrics() {
        assertFalse(HealthPermissionPolicy.valid(emptyList(), true))
        assertFalse(HealthPermissionPolicy.valid(listOf("LOCATION"), true))
        assertFalse(HealthPermissionPolicy.valid(listOf("STEPS", "STEPS"), true))
    }
}