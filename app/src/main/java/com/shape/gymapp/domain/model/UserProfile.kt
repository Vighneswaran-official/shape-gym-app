package com.shape.gymapp.domain.model

enum class UserRole {
    ADMIN,
    STAFF;

    companion object {
        fun fromString(value: String?): UserRole {
            return when (value?.lowercase()?.trim()) {
                "admin", "manager" -> ADMIN
                "staff" -> STAFF
                else -> STAFF
            }
        }
    }
}

data class UserProfile(
    val id: String,
    val name: String,
    val role: UserRole,
    val email: String? = null
)
