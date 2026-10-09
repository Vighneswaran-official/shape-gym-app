package com.shape.gymapp.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.shape.gymapp.data.local.entity.PaymentEntity
import com.shape.gymapp.data.local.entity.SubscriptionEntity
import com.shape.gymapp.data.local.entity.SyncQueueEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SubscriptionDao {
    @Query("SELECT * FROM subscriptions ORDER BY endDate ASC")
    fun getAllSubscriptionsFlow(): Flow<List<SubscriptionEntity>>

    @Query("SELECT * FROM subscriptions WHERE memberId = :memberId ORDER BY endDate DESC LIMIT 1")
    suspend fun getLatestSubscriptionForMember(memberId: String): SubscriptionEntity?

    @Query("SELECT * FROM subscriptions")
    suspend fun getAllSubscriptionsList(): List<SubscriptionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubscriptions(subs: List<SubscriptionEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubscription(sub: SubscriptionEntity)
}

@Dao
interface PaymentDao {
    @Query("SELECT * FROM payments ORDER BY createdAt DESC")
    fun getAllPaymentsFlow(): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments WHERE paidOnIso LIKE :datePattern || '%'")
    suspend fun getPaymentsForDate(datePattern: String): List<PaymentEntity>

    @Query("SELECT SUM(amount) FROM payments WHERE paidOnIso LIKE :datePattern || '%'")
    suspend fun getTotalCollectionForDate(datePattern: String): Double?

    @Query("SELECT * FROM payments WHERE memberId = :memberId ORDER BY createdAt DESC")
    suspend fun getPaymentsForMember(memberId: String): List<PaymentEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayments(payments: List<PaymentEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayment(payment: PaymentEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM offline_sync_queue ORDER BY createdAt ASC")
    suspend fun getPendingTasks(): List<SyncQueueEntity>

    @Query("SELECT COUNT(*) FROM offline_sync_queue")
    fun getPendingCountFlow(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueueTask(task: SyncQueueEntity)

    @Query("DELETE FROM offline_sync_queue WHERE id = :taskId")
    suspend fun deleteTask(taskId: String)

    @Query("DELETE FROM offline_sync_queue")
    suspend fun clearQueue()
}
