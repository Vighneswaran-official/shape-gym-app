package com.shape.gymapp.domain.model

data class GymProgram(
    val id: String,
    val name: String,
    val isActive: Boolean = true
)

data class MembershipPlan(
    val id: String,
    val name: String,
    val durationDays: Int,
    val fee: Double,
    val description: String? = null,
    val isActive: Boolean = true
)

enum class BloodGroup(val display: String) {
    A_POSITIVE("A+"),
    A_NEGATIVE("A-"),
    B_POSITIVE("B+"),
    B_NEGATIVE("B-"),
    AB_POSITIVE("AB+"),
    AB_NEGATIVE("AB-"),
    O_POSITIVE("O+"),
    O_NEGATIVE("O-");

    companion object {
        fun fromString(value: String?): BloodGroup? {
            return values().firstOrNull { it.display.equals(value?.trim(), ignoreCase = true) }
        }
    }
}

enum class PaymentMode(val display: String) {
    CASH("Cash"),
    UPI("UPI"),
    CARD("Card")
}
