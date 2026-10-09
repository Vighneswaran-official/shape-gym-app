package com.shape.gymapp.ui.screens.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.security.PinLockManager
import com.shape.gymapp.domain.model.AuthState
import com.shape.gymapp.domain.repository.AuthRepository
import com.shape.gymapp.ui.navigation.NavRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val pinLockManager: PinLockManager
) : ViewModel() {

    private val _navigationEvent = MutableSharedFlow<String>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    init {
        checkAppInitialization()
    }

    private fun checkAppInitialization() {
        viewModelScope.launch {
            // Visual splash display delay
            delay(1200)

            val sessionState = authRepository.checkSessionAndRestore()

            if (sessionState is AuthState.Authenticated) {
                if (pinLockManager.isPinSet()) {
                    if (pinLockManager.isUnlockedForSession()) {
                        _navigationEvent.emit(NavRoute.Main.route)
                    } else {
                        _navigationEvent.emit(NavRoute.PinLock.route)
                    }
                } else {
                    // Encourage setting up front-desk lock PIN
                    _navigationEvent.emit(NavRoute.PinSetup.route)
                }
            } else {
                _navigationEvent.emit(NavRoute.Login.route)
            }
        }
    }
}
