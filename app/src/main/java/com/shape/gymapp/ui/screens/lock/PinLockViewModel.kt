package com.shape.gymapp.ui.screens.lock

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.security.PinLockManager
import com.shape.gymapp.domain.repository.AuthRepository
import com.shape.gymapp.ui.navigation.NavRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class PinMode {
    UNLOCK,
    SETUP_FIRST,
    SETUP_CONFIRM
}

data class PinLockUiState(
    val enteredPin: String = "",
    val firstEnteredPin: String = "",
    val mode: PinMode = PinMode.UNLOCK,
    val errorMessage: String? = null,
    val isBiometricAvailable: Boolean = false
)

@HiltViewModel
class PinLockViewModel @Inject constructor(
    private val pinLockManager: PinLockManager,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        PinLockUiState(
            mode = if (pinLockManager.isPinSet()) PinMode.UNLOCK else PinMode.SETUP_FIRST,
            isBiometricAvailable = pinLockManager.isBiometricEnabled()
        )
    )
    val uiState = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<String>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    fun onNumberClick(digit: String) {
        val current = _uiState.value.enteredPin
        if (current.length < 4) {
            val updated = current + digit
            _uiState.value = _uiState.value.copy(enteredPin = updated, errorMessage = null)
            if (updated.length == 4) {
                handlePinComplete(updated)
            }
        }
    }

    fun onDeleteClick() {
        val current = _uiState.value.enteredPin
        if (current.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(
                enteredPin = current.dropLast(1),
                errorMessage = null
            )
        }
    }

    private fun handlePinComplete(pin: String) {
        when (_uiState.value.mode) {
            PinMode.UNLOCK -> {
                if (pinLockManager.verifyPin(pin)) {
                    pinLockManager.setSessionUnlocked(true)
                    viewModelScope.launch {
                        _navigationEvent.emit(NavRoute.Main.route)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        enteredPin = "",
                        errorMessage = "Incorrect PIN. Please try again."
                    )
                }
            }
            PinMode.SETUP_FIRST -> {
                _uiState.value = _uiState.value.copy(
                    enteredPin = "",
                    firstEnteredPin = pin,
                    mode = PinMode.SETUP_CONFIRM,
                    errorMessage = null
                )
            }
            PinMode.SETUP_CONFIRM -> {
                if (pin == _uiState.value.firstEnteredPin) {
                    pinLockManager.savePin(pin)
                    pinLockManager.setSessionUnlocked(true)
                    viewModelScope.launch {
                        _navigationEvent.emit(NavRoute.Main.route)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        enteredPin = "",
                        firstEnteredPin = "",
                        mode = PinMode.SETUP_FIRST,
                        errorMessage = "PINs did not match. Enter a 4-digit PIN again."
                    )
                }
            }
        }
    }

    fun onBiometricSuccess() {
        pinLockManager.setSessionUnlocked(true)
        viewModelScope.launch {
            _navigationEvent.emit(NavRoute.Main.route)
        }
    }

    fun onLogoutClick() {
        viewModelScope.launch {
            authRepository.logout()
            _navigationEvent.emit(NavRoute.Login.route)
        }
    }
}
