package com.shape.gymapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.shape.gymapp.domain.model.UserProfile
import com.shape.gymapp.domain.model.UserRole

@Entity(tableName = "user_sessions")
data class UserSessionEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val role: String,
    val lastActiveTime: Long = System.currentTimeMillis()
) {
    fun toDomain(): UserProfile {
        return UserProfile(
            id = id,
            name = name,
            email = email,
            role = UserRole.fromString(role)
        )
    }

    companion object {
        fun fromDomain(profile: UserProfile): UserSessionEntity {
            return UserSessionEntity(
                id = profile.id,
                name = profile.name,
                email = profile.email ?: "",
                role = profile.role.name
            )
        }
    }
}
