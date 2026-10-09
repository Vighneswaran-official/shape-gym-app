package com.shape.gymapp.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.security.PinLockManager
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.UserProfile
import com.shape.gymapp.domain.repository.AuthRepository
import com.shape.gymapp.ui.navigation.NavRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val emailError: String? = null,
    val password: String = "",
    val passwordError: String? = null,
    val isLoading: Boolean = false,
    val generalError: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val pinLockManager: PinLockManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<String>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    fun onEmailChange(newEmail: String) {
        _uiState.value = _uiState.value.copy(
            email = newEmail,
            emailError = null,
            generalError = null
        )
    }

    fun onPasswordChange(newPassword: String) {
        _uiState.value = _uiState.value.copy(
            password = newPassword,
            passwordError = null,
            generalError = null
        )
    }

    fun onLoginClick() {
        val email = _uiState.value.email.trim()
        val password = _uiState.value.password

        var hasError = false
        var emailErr: String? = null
        var passErr: String? = null

        if (email.isEmpty()) {
            emailErr = "Email address is required"
            hasError = true
        } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            emailErr = "Please enter a valid email address"
            hasError = true
        }

        if (password.isEmpty()) {
            passErr = "Password is required"
            hasError = true
        } else if (password.length < 6) {
            passErr = "Password must be at least 6 characters"
            hasError = true
        }

        if (hasError) {
            _uiState.value = _uiState.value.copy(
                emailError = emailErr,
                passwordError = passErr
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, generalError = null)

            when (val result = authRepository.loginWithEmail(email, password)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    // If PIN not configured on device, prompt to set PIN, otherwise proceed to Main
                    if (pinLockManager.isPinSet()) {
                        pinLockManager.setSessionUnlocked(true)
                        _navigationEvent.emit(NavRoute.Main.route)
                    } else {
                        _navigationEvent.emit(NavRoute.PinSetup.route)
                    }
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        generalError = result.message
                    )
                }
                is Resource.Loading -> {
                    _uiState.value = _uiState.value.copy(isLoading = true)
                }
            }
        }
    }
}
