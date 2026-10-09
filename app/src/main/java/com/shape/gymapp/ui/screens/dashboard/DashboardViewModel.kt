package com.shape.gymapp.ui.screens.dashboard

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.DashboardMetrics
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.model.PaymentMode
import com.shape.gymapp.domain.model.RenewalMemberItem
import com.shape.gymapp.domain.model.RenewalSubmission
import com.shape.gymapp.domain.repository.DashboardRepository
import com.shape.gymapp.domain.repository.PlanRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val metrics: DashboardMetrics = DashboardMetrics(),
    val renewalsDue: List<RenewalMemberItem> = emptyList(),
    val availablePlans: List<MembershipPlan> = emptyList(),
    val isLoading: Boolean = false,
    val isRenewing: Boolean = false,
    val selectedRenewalItem: RenewalMemberItem? = null,
    val renewalError: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val dashboardRepository: DashboardRepository,
    private val planRepository: PlanRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState = _uiState.asStateFlow()

    init {
        observeMetrics()
        refreshDashboard()
        loadPlans()
    }

    private fun observeMetrics() {
        viewModelScope.launch {
            dashboardRepository.getDashboardMetricsFlow().collectLatest { metrics ->
                _uiState.value = _uiState.value.copy(metrics = metrics)
            }
        }
    }

    fun refreshDashboard() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            dashboardRepository.refreshDashboard()

            when (val renewalsRes = dashboardRepository.getRenewalsDueList()) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        renewalsDue = renewalsRes.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
                is Resource.Loading -> Unit
            }
        }
    }

    private fun loadPlans() {
        viewModelScope.launch {
            when (val res = planRepository.getActivePlans()) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(availablePlans = res.data)
                }
                else -> Unit
            }
        }
    }

    fun onCallMember(context: Context, phone: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun onWhatsAppReminder(
        context: Context,
        name: String,
        phone: String,
        planName: String,
        expiryDate: String,
        balance: Double
    ) {
        try {
            val cleanPhone = if (phone.length == 10) "91$phone" else phone
            val balanceMsg = if (balance > 0) " Note: There is also a pending balance of ₹${balance.toInt()}." else ""
            val message = "Hello $name! This is a gentle reminder from Shape Fitness Club. Your $planName membership expires on ${DateUtils.formatDisplay(expiryDate)}.$balanceMsg Please renew soon to continue uninterrupted gym workouts! 💪"
            val encodedMsg = Uri.encode(message)
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleanPhone&text=$encodedMsg")

            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun openRenewDialog(item: RenewalMemberItem) {
        _uiState.value = _uiState.value.copy(
            selectedRenewalItem = item,
            renewalError = null
        )
    }

    fun closeRenewDialog() {
        _uiState.value = _uiState.value.copy(
            selectedRenewalItem = null,
            renewalError = null
        )
    }

    fun submitRenewal(
        plan: MembershipPlan,
        amountPaid: Double,
        paymentMode: PaymentMode,
        note: String?
    ) {
        val item = _uiState.value.selectedRenewalItem ?: return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRenewing = true, renewalError = null)

            val today = DateUtils.todayIso()
            val newStartDate = if (item.daysRemaining > 0) item.expiryDateIso else today
            val newEndDate = DateUtils.addDays(newStartDate, plan.durationDays)

            val submission = RenewalSubmission(
                memberId = item.memberId,
                plan = plan,
                newStartDateIso = newStartDate,
                newEndDateIso = newEndDate,
                carryForwardBalance = item.pendingBalance,
                amountPaid = amountPaid,
                paymentMode = paymentMode,
                note = note
            )

            when (val res = dashboardRepository.renewSubscription(submission)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(isRenewing = false, selectedRenewalItem = null)
                    refreshDashboard()
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(isRenewing = false, renewalError = res.message)
                }
                is Resource.Loading -> Unit
            }
        }
    }
}
