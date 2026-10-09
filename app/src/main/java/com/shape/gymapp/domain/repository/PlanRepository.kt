package com.shape.gymapp.domain.repository

import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.MembershipPlan
import kotlinx.coroutines.flow.Flow

interface PlanRepository {
    fun getPlansFlow(): Flow<List<MembershipPlan>>
    suspend fun getActivePlans(): Resource<List<MembershipPlan>>
    suspend fun refreshPlans(): Resource<List<MembershipPlan>>
    suspend fun addPlan(plan: MembershipPlan): Resource<MembershipPlan>
    suspend fun updatePlan(plan: MembershipPlan): Resource<MembershipPlan>
    suspend fun deletePlan(planId: String): Resource<Unit>

    fun getProgramsFlow(): Flow<List<GymProgram>>
    suspend fun refreshPrograms(): Resource<List<GymProgram>>
}
