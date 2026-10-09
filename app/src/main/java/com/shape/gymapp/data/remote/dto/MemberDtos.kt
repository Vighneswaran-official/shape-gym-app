package com.shape.gymapp.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MemberDto(
    val id: String? = null,
    val name: String,
    val address: String? = null,
    @SerialName("aadhaar_last4") val aadhaarLast4: String? = null,
    @SerialName("aadhaar_encrypted") val aadhaarEncrypted: String? = null,
    @SerialName("blood_group") val bloodGroup: String? = null,
    @SerialName("health_history_encrypted") val healthHistoryEncrypted: String? = null,
    val age: Int? = null,
    val phone: String,
    @SerialName("photo_path") val photoPath: String? = null,
    @SerialName("join_date") val joinDate: String,
    @SerialName("consent_given") val consentGiven: Boolean = true,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("deleted_at") val deletedAt: String? = null
)

@Serializable
data class MemberProgramDto(
    @SerialName("member_id") val memberId: String,
    @SerialName("program_id") val programId: String,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class SubscriptionDto(
    val id: String? = null,
    @SerialName("member_id") val memberId: String,
    @SerialName("plan_id") val planId: String? = null,
    @SerialName("plan_name_snapshot") val planNameSnapshot: String,
    @SerialName("fee_snapshot") val feeSnapshot: Double,
    @SerialName("start_date") val startDate: String,
    @SerialName("end_date") val endDate: String,
    @SerialName("amount_due") val amountDue: Double,
    @SerialName("amount_paid") val amountPaid: Double,
    val balance: Double,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class PaymentDto(
    val id: String? = null,
    @SerialName("member_id") val memberId: String,
    @SerialName("subscription_id") val subscriptionId: String? = null,
    val amount: Double,
    val mode: String, // 'Cash', 'UPI', 'Card'
    @SerialName("paid_on") val paidOn: String? = null,
    val type: String, // 'admission_fee', 'subscription_fee', 'pending_dues', 'other'
    val note: String? = null,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class SignatureDto(
    val id: String? = null,
    @SerialName("member_id") val memberId: String,
    @SerialName("client_signature_path") val clientSignaturePath: String,
    @SerialName("manager_signature_path") val managerSignaturePath: String,
    @SerialName("signed_on") val signedOn: String? = null
)
