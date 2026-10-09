package com.shape.gymapp.ui.screens.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.network.NetworkConnectivityObserver
import com.shape.gymapp.core.network.NetworkStatus
import com.shape.gymapp.domain.model.UserProfile
import com.shape.gymapp.domain.model.UserRole
import com.shape.gymapp.domain.repository.AuthRepository
import com.shape.gymapp.ui.navigation.NavRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MainUiState(
    val userProfile: UserProfile? = null,
    val isOffline: Boolean = false,
    val supabaseConnected: Boolean = true,
    val supabaseStatusMessage: String = "Connecting...",
    val isLoading: Boolean = false
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val networkObserver: NetworkConnectivityObserver,
    private val supabase: SupabaseClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<String>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    init {
        loadUserProfile()
        observeNetwork()
        testSupabaseConnection()
    }

    private fun loadUserProfile() {
        viewModelScope.launch {
            val profile = authRepository.getCurrentProfile()
            _uiState.value = _uiState.value.copy(userProfile = profile)
        }
    }

    private fun observeNetwork() {
        viewModelScope.launch {
            networkObserver.observe().collectLatest { status ->
                val isOff = status != NetworkStatus.Available
                _uiState.value = _uiState.value.copy(isOffline = isOff)
            }
        }
    }

    fun testSupabaseConnection() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // Test querying public programs table
                val count = supabase.from("programs").select().data
                _uiState.value = _uiState.value.copy(
                    supabaseConnected = true,
                    supabaseStatusMessage = "Connected to Supabase (RLS Active)",
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    supabaseConnected = false,
                    supabaseStatusMessage = "Offline cache active (${e.localizedMessage ?: "Network error"})",
                    isLoading = false
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _navigationEvent.emit(NavRoute.Login.route)
        }
    }
}
