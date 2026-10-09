package com.shape.gymapp.ui.screens.admission

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.AdmissionSubmission
import com.shape.gymapp.domain.model.AdmissionSuccessResult
import com.shape.gymapp.domain.model.BloodGroup
import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.model.PaymentMode
import com.shape.gymapp.domain.repository.MemberRepository
import com.shape.gymapp.domain.repository.PlanRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class AdmissionUiState(
    // Member Personal
    val fullName: String = "",
    val fullNameError: String? = null,
    val address: String = "",
    val aadhaarRaw: String = "",
    val aadhaarError: String? = null,
    val bloodGroup: BloodGroup? = null,
    val healthHistory: String = "",
    val age: String = "",
    val ageError: String? = null,
    val phone: String = "",
    val phoneError: String? = null,
    val phoneDuplicateWarning: Boolean = false,
    val photoBytes: ByteArray? = null,

    // Programs & Plans
    val availablePrograms: List<GymProgram> = emptyList(),
    val selectedProgramIds: Set<String> = emptySet(),
    val availablePlans: List<MembershipPlan> = emptyList(),
    val selectedPlan: MembershipPlan? = null,
    val joiningDateIso: String = DateUtils.todayIso(),
    val expiryDateIso: String = "",

    // Fees & Payments
    val admissionFeeStr: String = "0",
    val amountPaidStr: String = "",
    val paymentMode: PaymentMode = PaymentMode.UPI,
    val totalFeeDue: Double = 0.0,
    val balancePending: Double = 0.0,

    // Legal & Signatures
    val consentGiven: Boolean = false,
    val consentError: String? = null,
    val clientSignatureBytes: ByteArray? = null,
    val managerSignatureBytes: ByteArray? = null,
    val signatureError: String? = null,

    // Process State
    val isSubmitting: Boolean = false,
    val submitError: String? = null,
    val successResult: AdmissionSuccessResult? = null
)

@HiltViewModel
class AdmissionViewModel @Inject constructor(
    private val memberRepository: MemberRepository,
    private val planRepository: PlanRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdmissionUiState())
    val uiState = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<String>()
    val navigationEvent = _navigationEvent.asSharedFlow()

    init {
        loadProgramsAndPlans()
    }

    private fun loadProgramsAndPlans() {
        viewModelScope.launch {
            // Load programs
            when (val progRes = planRepository.refreshPrograms()) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        availablePrograms = progRes.data,
                        selectedProgramIds = progRes.data.map { it.id }.toSet() // Default enroll all
                    )
                }
                else -> Unit
            }

            // Load plans
            when (val planRes = planRepository.refreshPlans()) {
                is Resource.Success -> {
                    val activePlans = planRes.data.filter { it.isActive }
                    val defaultPlan = activePlans.firstOrNull()
                    val today = _uiState.value.joiningDateIso
                    val expiry = if (defaultPlan != null) DateUtils.addDays(today, defaultPlan.durationDays) else ""

                    _uiState.value = _uiState.value.copy(
                        availablePlans = activePlans,
                        selectedPlan = defaultPlan,
                        expiryDateIso = expiry
                    )
                    recalculateFees()
                }
                else -> Unit
            }
        }
    }

    fun onFullNameChange(name: String) {
        _uiState.value = _uiState.value.copy(fullName = name, fullNameError = null)
    }

    fun onAddressChange(addr: String) {
        _uiState.value = _uiState.value.copy(address = addr)
    }

    fun onAadhaarChange(aadhaar: String) {
        val digitsOnly = aadhaar.filter { it.isDigit() }.take(12)
        _uiState.value = _uiState.value.copy(aadhaarRaw = digitsOnly, aadhaarError = null)
    }

    fun onBloodGroupChange(bg: BloodGroup?) {
        _uiState.value = _uiState.value.copy(bloodGroup = bg)
    }

    fun onHealthHistoryChange(history: String) {
        _uiState.value = _uiState.value.copy(healthHistory = history)
    }

    fun onAgeChange(ageStr: String) {
        val digits = ageStr.filter { it.isDigit() }.take(3)
        _uiState.value = _uiState.value.copy(age = digits, ageError = null)
    }

    fun onPhoneChange(phoneStr: String) {
        val digits = phoneStr.filter { it.isDigit() }.take(10)
        _uiState.value = _uiState.value.copy(
            phone = digits,
            phoneError = null,
            phoneDuplicateWarning = false
        )

        if (digits.length == 10) {
            viewModelScope.launch {
                val isDuplicate = memberRepository.checkDuplicatePhone(digits)
                _uiState.value = _uiState.value.copy(phoneDuplicateWarning = isDuplicate)
            }
        }
    }

    fun onPhotoSelected(bytes: ByteArray?) {
        _uiState.value = _uiState.value.copy(photoBytes = bytes)
    }

    fun toggleProgram(programId: String) {
        val current = _uiState.value.selectedProgramIds.toMutableSet()
        if (current.contains(programId)) {
            if (current.size > 1) { // Keep at least one program
                current.remove(programId)
            }
        } else {
            current.add(programId)
        }
        _uiState.value = _uiState.value.copy(selectedProgramIds = current)
    }

    fun onPlanSelected(plan: MembershipPlan) {
        val expiry = DateUtils.addDays(_uiState.value.joiningDateIso, plan.durationDays)
        _uiState.value = _uiState.value.copy(
            selectedPlan = plan,
            expiryDateIso = expiry
        )
        recalculateFees()
    }

    fun onAdmissionFeeChange(feeStr: String) {
        val digits = feeStr.filter { it.isDigit() }
        _uiState.value = _uiState.value.copy(admissionFeeStr = digits)
        recalculateFees()
    }

    fun onAmountPaidChange(paidStr: String) {
        val digits = paidStr.filter { it.isDigit() }
        _uiState.value = _uiState.value.copy(amountPaidStr = digits)
        recalculateFees()
    }

    fun onPaymentModeChange(mode: PaymentMode) {
        _uiState.value = _uiState.value.copy(paymentMode = mode)
    }

    fun onConsentChange(consent: Boolean) {
        _uiState.value = _uiState.value.copy(consentGiven = consent, consentError = null)
    }

    fun onClientSignatureChanged(bytes: ByteArray?) {
        _uiState.value = _uiState.value.copy(clientSignatureBytes = bytes, signatureError = null)
    }

    fun onManagerSignatureChanged(bytes: ByteArray?) {
        _uiState.value = _uiState.value.copy(managerSignatureBytes = bytes, signatureError = null)
    }

    private fun recalculateFees() {
        val planFee = _uiState.value.selectedPlan?.fee ?: 0.0
        val admFee = _uiState.value.admissionFeeStr.toDoubleOrNull() ?: 0.0
        val totalDue = planFee + admFee

        // If amount paid is empty, default to full payment
        val paid = _uiState.value.amountPaidStr.toDoubleOrNull() ?: totalDue
        val balance = (totalDue - paid).coerceAtLeast(0.0)

        _uiState.value = _uiState.value.copy(
            totalFeeDue = totalDue,
            balancePending = balance
        )
    }

    fun submitAdmission() {
        val state = _uiState.value
        var hasError = false
        var nameErr: String? = null
        var aadhaarErr: String? = null
        var ageErr: String? = null
        var phoneErr: String? = null
        var consentErr: String? = null
        var sigErr: String? = null

        if (state.fullName.isBlank()) {
            nameErr = "Full name is required"
            hasError = true
        }

        if (state.phone.length != 10) {
            phoneErr = "Enter valid 10-digit mobile number"
            hasError = true
        }

        if (state.aadhaarRaw.isNotEmpty() && state.aadhaarRaw.length != 12) {
            aadhaarErr = "Aadhaar must be exactly 12 digits"
            hasError = true
        }

        val ageInt = state.age.toIntOrNull()
        if (ageInt == null || ageInt < 10 || ageInt > 120) {
            ageErr = "Valid age (10-120) required"
            hasError = true
        }

        if (state.selectedPlan == null) {
            hasError = true
        }

        if (!state.consentGiven) {
            consentErr = "Consent is required to store member details"
            hasError = true
        }

        if (state.clientSignatureBytes == null || state.managerSignatureBytes == null) {
            sigErr = "Both Client and Manager finger-drawn signatures are mandatory"
            hasError = true
        }

        if (hasError) {
            _uiState.value = state.copy(
                fullNameError = nameErr,
                phoneError = phoneErr,
                aadhaarError = aadhaarErr,
                ageError = ageErr,
                consentError = consentErr,
                signatureError = sigErr
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isSubmitting = true, submitError = null)

            val plan = state.selectedPlan!!
            val admFee = state.admissionFeeStr.toDoubleOrNull() ?: 0.0
            val amountPaid = state.amountPaidStr.toDoubleOrNull() ?: (plan.fee + admFee)

            val submission = AdmissionSubmission(
                fullName = state.fullName.trim(),
                address = state.address.trim(),
                rawAadhaar = state.aadhaarRaw,
                bloodGroup = state.bloodGroup,
                healthHistory = state.healthHistory.trim(),
                age = ageInt!!,
                phone = state.phone.trim(),
                photoBytes = state.photoBytes,
                selectedProgramIds = state.selectedProgramIds.toList(),
                selectedPlan = plan,
                joiningDateIso = state.joiningDateIso,
                expiryDateIso = state.expiryDateIso,
                admissionFee = admFee,
                amountPaid = amountPaid,
                paymentMode = state.paymentMode,
                consentGiven = state.consentGiven,
                clientSignatureBytes = state.clientSignatureBytes!!,
                managerSignatureBytes = state.managerSignatureBytes!!
            )

            when (val result = memberRepository.submitAdmission(submission)) {
                is Resource.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        successResult = result.data
                    )
                }
                is Resource.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        submitError = result.message
                    )
                }
                is Resource.Loading -> Unit
            }
        }
    }

    fun dismissSuccessDialog() {
        _uiState.value = _uiState.value.copy(successResult = null)
        resetForm()
    }

    private fun resetForm() {
        val defaultPlan = _uiState.value.availablePlans.firstOrNull()
        val today = DateUtils.todayIso()
        val expiry = if (defaultPlan != null) DateUtils.addDays(today, defaultPlan.durationDays) else ""

        _uiState.value = _uiState.value.copy(
            fullName = "",
            address = "",
            aadhaarRaw = "",
            healthHistory = "",
            age = "",
            phone = "",
            photoBytes = null,
            admissionFeeStr = "0",
            amountPaidStr = "",
            consentGiven = false,
            clientSignatureBytes = null,
            managerSignatureBytes = null,
            selectedPlan = defaultPlan,
            expiryDateIso = expiry
        )
        recalculateFees()
    }
}
