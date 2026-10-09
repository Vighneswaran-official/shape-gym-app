package com.shape.gymapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "subscriptions")
data class SubscriptionEntity(
    @PrimaryKey val id: String,
    val memberId: String,
    val planId: String?,
    val planNameSnapshot: String,
    val feeSnapshot: Double,
    val startDate: String,
    val endDate: String,
    val amountDue: Double,
    val amountPaid: Double,
    val balance: Double,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "payments")
data class PaymentEntity(
    @PrimaryKey val id: String,
    val memberId: String,
    val subscriptionId: String?,
    val amount: Double,
    val mode: String,
    val paidOnIso: String,
    val type: String,
    val note: String?,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "offline_sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val id: String,
    val actionType: String, // e.g. "CREATE_MEMBER", "RENEW_SUBSCRIPTION", "RECORD_PAYMENT"
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)
