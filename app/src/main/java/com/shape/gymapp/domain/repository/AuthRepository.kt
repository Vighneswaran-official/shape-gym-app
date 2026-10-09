package com.shape.gymapp.domain.repository

import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.AuthState
import com.shape.gymapp.domain.model.UserProfile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

interface AuthRepository {
    val authState: StateFlow<AuthState>

    suspend fun loginWithEmail(email: String, password: String): Resource<UserProfile>
    suspend fun logout(): Resource<Unit>
    suspend fun getCurrentProfile(): UserProfile?
    suspend fun checkSessionAndRestore(): AuthState
    fun isUserLoggedIn(): Boolean
}
