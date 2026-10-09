package com.shape.gymapp.di

import android.content.Context
import androidx.room.Room
import com.shape.gymapp.data.local.ShapeDatabase
import com.shape.gymapp.data.local.dao.MemberDao
import com.shape.gymapp.data.local.dao.PaymentDao
import com.shape.gymapp.data.local.dao.PlanDao
import com.shape.gymapp.data.local.dao.ProgramDao
import com.shape.gymapp.data.local.dao.SubscriptionDao
import com.shape.gymapp.data.local.dao.SyncQueueDao
import com.shape.gymapp.data.local.dao.UserSessionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): ShapeDatabase {
        return Room.databaseBuilder(
            context,
            ShapeDatabase::class.java,
            "shape_gym_local.db"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideUserSessionDao(database: ShapeDatabase): UserSessionDao = database.userSessionDao()

    @Provides
    fun providePlanDao(database: ShapeDatabase): PlanDao = database.planDao()

    @Provides
    fun provideProgramDao(database: ShapeDatabase): ProgramDao = database.programDao()

    @Provides
    fun provideMemberDao(database: ShapeDatabase): MemberDao = database.memberDao()

    @Provides
    fun provideSubscriptionDao(database: ShapeDatabase): SubscriptionDao = database.subscriptionDao()

    @Provides
    fun providePaymentDao(database: ShapeDatabase): PaymentDao = database.paymentDao()

    @Provides
    fun provideSyncQueueDao(database: ShapeDatabase): SyncQueueDao = database.syncQueueDao()
}
