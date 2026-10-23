package com.lifetrack.app.spike

import com.google.gson.JsonObject
import com.lifetrack.health.isCurrentHealthConnection
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionRefreshCoordinatorTest {
    @Test
    fun accessTokenWriteRequiresTheSameActiveConnection() {
        val server = "https://api.example.invalid/api/v1"
        val connectionId = "8ed910ef-9154-46f0-a7df-3ad1b17fe64a"
        val generation = 4
        val state = JsonObject().apply {
            addProperty("server", server)
            addProperty("connectionId", connectionId)
            addProperty("generation", generation)
            addProperty("backgroundRequested", true)
        }

        assertTrue(isCurrentHealthConnection(state, server, connectionId, generation, requireBackgroundRequest = true))
        assertFalse(isCurrentHealthConnection(state, server, connectionId, generation + 1))
        assertFalse(isCurrentHealthConnection(state, server, "other-connection", generation))
        state.remove("connectionId")
        assertFalse(isCurrentHealthConnection(state, server, connectionId, generation))
    }

    @Test
    fun secondRefreshReadsTokenWrittenByFirstRefresh() = runBlocking {
        val coordinator = SessionRefreshCoordinator()
        var currentToken = "refresh-0"
        val observedTokens = mutableListOf<String>()
        val firstRefreshEntered = CompletableDeferred<Unit>()
        val releaseFirstRefresh = CompletableDeferred<Unit>()

        val firstRefresh = async {
            coordinator.withLock {
                observedTokens.add(currentToken)
                firstRefreshEntered.complete(Unit)
                releaseFirstRefresh.await()
                currentToken = "refresh-1"
            }
        }
        firstRefreshEntered.await()

        val secondRefreshEntered = CompletableDeferred<Unit>()
        val secondRefresh = async {
            coordinator.withLock {
                observedTokens.add(currentToken)
                secondRefreshEntered.complete(Unit)
                currentToken = "refresh-2"
            }
        }

        yield()
        assertFalse(secondRefreshEntered.isCompleted)
        releaseFirstRefresh.complete(Unit)
        firstRefresh.await()
        secondRefresh.await()

        assertEquals(listOf("refresh-0", "refresh-1"), observedTokens)
        assertEquals("refresh-2", currentToken)
    }
}