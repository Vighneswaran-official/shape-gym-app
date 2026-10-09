package com.shape.gymapp.domain.repository

import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.DashboardMetrics
import com.shape.gymapp.domain.model.RenewalMemberItem
import com.shape.gymapp.domain.model.RenewalSubmission
import kotlinx.coroutines.flow.Flow

interface DashboardRepository {
    fun getDashboardMetricsFlow(): Flow<DashboardMetrics>
    suspend fun getRenewalsDueList(): Resource<List<RenewalMemberItem>>
    suspend fun refreshDashboard(): Resource<Unit>
    suspend fun renewSubscription(submission: RenewalSubmission): Resource<Unit>
}
