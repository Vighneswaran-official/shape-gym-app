package com.shape.gymapp.data.remote.dto

import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.MembershipPlan
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ProgramDto(
    val id: String? = null,
    val name: String,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("created_at") val createdAt: String? = null
) {
    fun toDomain(): GymProgram = GymProgram(
        id = id ?: "",
        name = name,
        isActive = isActive
    )
}

@Serializable
data class PlanDto(
    val id: String? = null,
    val name: String,
    @SerialName("duration_days") val durationDays: Int,
    val fee: Double,
    val description: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
) {
    fun toDomain(): MembershipPlan = MembershipPlan(
        id = id ?: "",
        name = name,
        durationDays = durationDays,
        fee = fee,
        description = description,
        isActive = isActive
    )

    companion object {
        fun fromDomain(domain: MembershipPlan): PlanDto = PlanDto(
            id = domain.id.takeIf { it.isNotBlank() },
            name = domain.name,
            durationDays = domain.durationDays,
            fee = domain.fee,
            description = domain.description,
            isActive = domain.isActive
        )
    }
}
