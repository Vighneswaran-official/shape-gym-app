package com.shape.gymapp.domain.model

import com.shape.gymapp.core.util.ExpiryAlertStatus

data class DashboardMetrics(
    val totalMembers: Int = 0,
    val activeMembers: Int = 0,
    val expiringSoonCount: Int = 0, // <= 7 days (Yellow)
    val criticalCount: Int = 0,     // <= 3 days (Red)
    val expiredCount: Int = 0,      // Past expiry
    val todayCollection: Double = 0.0,
    val totalPendingDues: Double = 0.0,
    val isOffline: Boolean = false,
    val pendingSyncCount: Int = 0,
    val lastBackupTimestamp: Long? = null,
    val needsBackupWarning: Boolean = false
)

data class RenewalMemberItem(
    val memberId: String,
    val subscriptionId: String,
    val name: String,
    val phone: String,
    val programNames: List<String>,
    val planName: String,
    val planId: String?,
    val expiryDateIso: String,
    val daysRemaining: Long,
    val alertStatus: ExpiryAlertStatus,
    val pendingBalance: Double,
    val planFee: Double,
    val planDurationDays: Int
)

data class RenewalSubmission(
    val memberId: String,
    val plan: MembershipPlan,
    val newStartDateIso: String,
    val newEndDateIso: String,
    val carryForwardBalance: Double,
    val amountPaid: Double,
    val paymentMode: PaymentMode,
    val note: String? = null
)
