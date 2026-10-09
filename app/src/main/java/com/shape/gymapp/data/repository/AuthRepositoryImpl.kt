package com.shape.gymapp.data.repository

import com.shape.gymapp.core.network.NetworkConnectivityObserver
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.data.local.dao.UserSessionDao
import com.shape.gymapp.data.local.entity.UserSessionEntity
import com.shape.gymapp.data.remote.dto.ProfileDto
import com.shape.gymapp.domain.model.AuthState
import com.shape.gymapp.domain.model.UserProfile
import com.shape.gymapp.domain.model.UserRole
import com.shape.gymapp.domain.repository.AuthRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val supabase: SupabaseClient,
    private val userSessionDao: UserSessionDao,
    private val networkObserver: NetworkConnectivityObserver
) : AuthRepository {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Initial)
    override val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val repositoryScope = CoroutineScope(Dispatchers.IO)

    init {
        repositoryScope.launch {
            checkSessionAndRestore()
        }
    }

    override suspend fun loginWithEmail(email: String, password: String): Resource<UserProfile> =
        withContext(Dispatchers.IO) {
            try {
                _authState.value = AuthState.Loading

                // 1. Supabase Auth Email/Password Sign-In
                supabase.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }

                val currentAuthUser = supabase.auth.currentUserOrNull()
                    ?: return@withContext Resource.Error("User login succeeded but session user is null")

                val userId = currentAuthUser.id
                val userEmail = currentAuthUser.email ?: email.trim()

                // 2. Fetch User Profile & Role from Supabase profiles table
                val profileDto = try {
                    supabase.from("profiles")
                        .select {
                            filter {
                                eq("id", userId)
                            }
                        }
                        .decodeSingle<ProfileDto>()
                } catch (e: Exception) {
                    // Fallback profile if profile row creation trigger was delayed
                    ProfileDto(
                        id = userId,
                        name = userEmail.substringBefore("@"),
                        role = "admin"
                    )
                }

                val userProfile = profileDto.toDomain(email = userEmail)

                // 3. Cache session into local Room Database for offline support
                userSessionDao.insertSession(UserSessionEntity.fromDomain(userProfile))

                _authState.value = AuthState.Authenticated(userProfile)
                Resource.Success(userProfile)
            } catch (e: Exception) {
                val errorMsg = e.localizedMessage ?: "Failed to sign in. Please verify your credentials."
                _authState.value = AuthState.Error(errorMsg)
                Resource.Error(errorMsg, e)
            }
        }

    override suspend fun logout(): Resource<Unit> = withContext(Dispatchers.IO) {
        try {
            if (networkObserver.isCurrentlyConnected()) {
                try {
                    supabase.auth.signOut()
                } catch (_: Exception) { }
            }
            userSessionDao.clearSession()
            _authState.value = AuthState.Unauthenticated
            Resource.Success(Unit)
        } catch (e: Exception) {
            userSessionDao.clearSession()
            _authState.value = AuthState.Unauthenticated
            Resource.Success(Unit)
        }
    }

    override suspend fun getCurrentProfile(): UserProfile? = withContext(Dispatchers.IO) {
        when (val state = _authState.value) {
            is AuthState.Authenticated -> state.profile
            else -> {
                val cached = userSessionDao.getActiveSession()
                cached?.toDomain()
            }
        }
    }

    override suspend fun checkSessionAndRestore(): AuthState = withContext(Dispatchers.IO) {
        try {
            val session = supabase.auth.currentSessionOrNull()
            if (session != null) {
                val user = supabase.auth.currentUserOrNull()
                val userId = user?.id ?: session.user?.id
                val userEmail = user?.email ?: session.user?.email

                if (userId != null) {
                    // Attempt to fetch fresh profile from remote
                    val profileDto = try {
                        supabase.from("profiles")
                            .select { filter { eq("id", userId) } }
                            .decodeSingle<ProfileDto>()
                    } catch (e: Exception) {
                        null
                    }

                    val profile = profileDto?.toDomain(userEmail) ?: userSessionDao.getActiveSession()?.toDomain()
                    if (profile != null) {
                        userSessionDao.insertSession(UserSessionEntity.fromDomain(profile))
                        val state = AuthState.Authenticated(profile)
                        _authState.value = state
                        return@withContext state
                    }
                }
            }

            // Fallback: Check local cache for offline session
            val localSession = userSessionDao.getActiveSession()
            if (localSession != null) {
                val profile = localSession.toDomain()
                val state = AuthState.Authenticated(profile)
                _authState.value = state
                return@withContext state
            }

            val unauthState = AuthState.Unauthenticated
            _authState.value = unauthState
            unauthState
        } catch (e: Exception) {
            // In case of network errors during boot, check local session cache
            val localSession = userSessionDao.getActiveSession()
            if (localSession != null) {
                val profile = localSession.toDomain()
                val state = AuthState.Authenticated(profile)
                _authState.value = state
                state
            } else {
                val unauthState = AuthState.Unauthenticated
                _authState.value = unauthState
                unauthState
            }
        }
    }

    override fun isUserLoggedIn(): Boolean {
        return _authState.value is AuthState.Authenticated
    }
}
