package com.shape.gymapp.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.shape.gymapp.data.local.dao.MemberDao
import com.shape.gymapp.data.local.dao.PaymentDao
import com.shape.gymapp.data.local.dao.PlanDao
import com.shape.gymapp.data.local.dao.ProgramDao
import com.shape.gymapp.data.local.dao.SubscriptionDao
import com.shape.gymapp.data.local.dao.SyncQueueDao
import com.shape.gymapp.data.local.dao.UserSessionDao
import com.shape.gymapp.data.local.entity.MemberEntity
import com.shape.gymapp.data.local.entity.PaymentEntity
import com.shape.gymapp.data.local.entity.PlanEntity
import com.shape.gymapp.data.local.entity.ProgramEntity
import com.shape.gymapp.data.local.entity.SubscriptionEntity
import com.shape.gymapp.data.local.entity.SyncQueueEntity
import com.shape.gymapp.data.local.entity.UserSessionEntity

@Database(
    entities = [
        UserSessionEntity::class,
        PlanEntity::class,
        ProgramEntity::class,
        MemberEntity::class,
        SubscriptionEntity::class,
        PaymentEntity::class,
        SyncQueueEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class ShapeDatabase : RoomDatabase() {
    abstract fun userSessionDao(): UserSessionDao
    abstract fun planDao(): PlanDao
    abstract fun programDao(): ProgramDao
    abstract fun memberDao(): MemberDao
    abstract fun subscriptionDao(): SubscriptionDao
    abstract fun paymentDao(): PaymentDao
    abstract fun syncQueueDao(): SyncQueueDao
}
