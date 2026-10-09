package com.shape.gymapp.domain.model

sealed class AuthState {
    object Initial : AuthState()
    object Loading : AuthState()
    data class Authenticated(val profile: UserProfile) : AuthState()
    object Unauthenticated : AuthState()
    data class Error(val message: String) : AuthState()
}
