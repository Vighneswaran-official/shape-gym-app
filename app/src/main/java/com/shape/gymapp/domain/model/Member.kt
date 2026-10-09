package com.shape.gymapp.domain.model

import java.io.File

data class Member(
    val id: String,
    val name: String,
    val address: String? = null,
    val aadhaarLast4: String? = null,
    val bloodGroup: BloodGroup? = null,
    val age: Int? = null,
    val phone: String,
    val photoPath: String? = null,
    val joinDate: String,
    val consentGiven: Boolean = true,
    val selectedPrograms: List<GymProgram> = emptyList(),
    val currentSubscription: SubscriptionInfo? = null
)

data class SubscriptionInfo(
    val id: String,
    val memberId: String,
    val planId: String?,
    val planNameSnapshot: String,
    val feeSnapshot: Double,
    val startDate: String,
    val endDate: String,
    val amountDue: Double,
    val amountPaid: Double,
    val balance: Double
)

data class AdmissionSubmission(
    val fullName: String,
    val address: String,
    val rawAadhaar: String, // 12 digits to be validated and encrypted
    val bloodGroup: BloodGroup?,
    val healthHistory: String,
    val age: Int,
    val phone: String,
    val photoBytes: ByteArray?,
    val selectedProgramIds: List<String>,
    val selectedPlan: MembershipPlan,
    val joiningDateIso: String,
    val expiryDateIso: String,
    val admissionFee: Double,
    val amountPaid: Double,
    val paymentMode: PaymentMode,
    val consentGiven: Boolean,
    val clientSignatureBytes: ByteArray,
    val managerSignatureBytes: ByteArray
)

data class AdmissionSuccessResult(
    val memberId: String,
    val memberName: String,
    val receiptPdfFile: File?
)
