package com.shape.gymapp.di

import com.shape.gymapp.data.repository.AuthRepositoryImpl
import com.shape.gymapp.data.repository.DashboardRepositoryImpl
import com.shape.gymapp.data.repository.MemberRepositoryImpl
import com.shape.gymapp.data.repository.PlanRepositoryImpl
import com.shape.gymapp.domain.repository.AuthRepository
import com.shape.gymapp.domain.repository.DashboardRepository
import com.shape.gymapp.domain.repository.MemberRepository
import com.shape.gymapp.domain.repository.PlanRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(
        authRepositoryImpl: AuthRepositoryImpl
    ): AuthRepository

    @Binds
    @Singleton
    abstract fun bindPlanRepository(
        planRepositoryImpl: PlanRepositoryImpl
    ): PlanRepository

    @Binds
    @Singleton
    abstract fun bindMemberRepository(
        memberRepositoryImpl: MemberRepositoryImpl
    ): MemberRepository

    @Binds
    @Singleton
    abstract fun bindDashboardRepository(
        dashboardRepositoryImpl: DashboardRepositoryImpl
    ): DashboardRepository
}
