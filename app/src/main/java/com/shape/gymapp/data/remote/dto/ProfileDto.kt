package com.shape.gymapp.data.remote.dto

import com.shape.gymapp.domain.model.UserProfile
import com.shape.gymapp.domain.model.UserRole
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ProfileDto(
    val id: String,
    val name: String,
    val role: String,
    @SerialName("created_at") val createdAt: String? = null
) {
    fun toDomain(email: String? = null): UserProfile {
        return UserProfile(
            id = id,
            name = name,
            role = UserRole.fromString(role),
            email = email
        )
    }
}
