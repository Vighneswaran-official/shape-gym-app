package com.shape.gymapp.data.repository

import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.data.local.dao.PlanDao
import com.shape.gymapp.data.local.dao.ProgramDao
import com.shape.gymapp.data.local.entity.PlanEntity
import com.shape.gymapp.data.local.entity.ProgramEntity
import com.shape.gymapp.data.remote.dto.PlanDto
import com.shape.gymapp.data.remote.dto.ProgramDto
import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.MembershipPlan
import com.shape.gymapp.domain.repository.PlanRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlanRepositoryImpl @Inject constructor(
    private val supabase: SupabaseClient,
    private val planDao: PlanDao,
    private val programDao: ProgramDao
) : PlanRepository {

    override fun getPlansFlow(): Flow<List<MembershipPlan>> {
        return planDao.getAllPlansFlow().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun getActivePlans(): Resource<List<MembershipPlan>> = withContext(Dispatchers.IO) {
        try {
            val local = planDao.getActivePlans().map { it.toDomain() }
            if (local.isNotEmpty()) {
                Resource.Success(local)
            } else {
                refreshPlans()
            }
        } catch (e: Exception) {
            val cached = planDao.getActivePlans().map { it.toDomain() }
            Resource.Success(cached)
        }
    }

    override suspend fun refreshPlans(): Resource<List<MembershipPlan>> = withContext(Dispatchers.IO) {
        try {
            val remoteDtos = supabase.from("plans")
                .select()
                .decodeList<PlanDto>()

            val domainPlans = remoteDtos.map { it.toDomain() }
            planDao.insertPlans(domainPlans.map { PlanEntity.fromDomain(it) })
            Resource.Success(domainPlans)
        } catch (e: Exception) {
            val cached = planDao.getActivePlans().map { it.toDomain() }
            if (cached.isNotEmpty()) {
                Resource.Success(cached)
            } else {
                Resource.Error(e.localizedMessage ?: "Failed to fetch plans from server", e)
            }
        }
    }

    override suspend fun addPlan(plan: MembershipPlan): Resource<MembershipPlan> = withContext(Dispatchers.IO) {
        try {
            val generatedId = if (plan.id.isBlank()) UUID.randomUUID().toString() else plan.id
            val dto = PlanDto(
                id = generatedId,
                name = plan.name.trim(),
                durationDays = plan.durationDays,
                fee = plan.fee,
                description = plan.description?.trim(),
                isActive = plan.isActive
            )

            val insertedDto = supabase.from("plans")
                .insert(dto) {
                    select()
                }
                .decodeSingle<PlanDto>()

            val insertedDomain = insertedDto.toDomain()
            planDao.insertPlan(PlanEntity.fromDomain(insertedDomain))
            Resource.Success(insertedDomain)
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to create plan", e)
        }
    }

    override suspend fun updatePlan(plan: MembershipPlan): Resource<MembershipPlan> = withContext(Dispatchers.IO) {
        try {
            val dto = PlanDto(
                id = plan.id,
                name = plan.name.trim(),
                durationDays = plan.durationDays,
                fee = plan.fee,
                description = plan.description?.trim(),
                isActive = plan.isActive
            )

            val updatedDto = supabase.from("plans")
                .update(dto) {
                    filter { eq("id", plan.id) }
                    select()
                }
                .decodeSingle<PlanDto>()

            val updatedDomain = updatedDto.toDomain()
            planDao.insertPlan(PlanEntity.fromDomain(updatedDomain))
            Resource.Success(updatedDomain)
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to update plan", e)
        }
    }

    override suspend fun deletePlan(planId: String): Resource<Unit> = withContext(Dispatchers.IO) {
        try {
            supabase.from("plans")
                .delete {
                    filter { eq("id", planId) }
                }
            planDao.deletePlan(planId)
            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to delete plan", e)
        }
    }

    override fun getProgramsFlow(): Flow<List<GymProgram>> {
        return programDao.getAllProgramsFlow().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun refreshPrograms(): Resource<List<GymProgram>> = withContext(Dispatchers.IO) {
        try {
            val remoteDtos = supabase.from("programs")
                .select {
                    filter { eq("is_active", true) }
                }
                .decodeList<ProgramDto>()

            val domainPrograms = remoteDtos.map { it.toDomain() }
            programDao.insertPrograms(domainPrograms.map { ProgramEntity.fromDomain(it) })
            Resource.Success(domainPrograms)
        } catch (e: Exception) {
            val cached = programDao.getActivePrograms().map { it.toDomain() }
            if (cached.isNotEmpty()) {
                Resource.Success(cached)
            } else {
                Resource.Error(e.localizedMessage ?: "Failed to fetch programs", e)
            }
        }
    }
}
