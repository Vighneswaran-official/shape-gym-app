package com.shape.gymapp.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.shape.gymapp.domain.model.BloodGroup
import com.shape.gymapp.domain.model.GymProgram
import com.shape.gymapp.domain.model.Member
import com.shape.gymapp.domain.model.MembershipPlan

@Entity(tableName = "plans")
data class PlanEntity(
    @PrimaryKey val id: String,
    val name: String,
    val durationDays: Int,
    val fee: Double,
    val description: String?,
    val isActive: Boolean
) {
    fun toDomain(): MembershipPlan = MembershipPlan(
        id = id,
        name = name,
        durationDays = durationDays,
        fee = fee,
        description = description,
        isActive = isActive
    )

    companion object {
        fun fromDomain(p: MembershipPlan): PlanEntity = PlanEntity(
            id = p.id,
            name = p.name,
            durationDays = p.durationDays,
            fee = p.fee,
            description = p.description,
            isActive = p.isActive
        )
    }
}

@Entity(tableName = "programs")
data class ProgramEntity(
    @PrimaryKey val id: String,
    val name: String,
    val isActive: Boolean
) {
    fun toDomain(): GymProgram = GymProgram(
        id = id,
        name = name,
        isActive = isActive
    )

    companion object {
        fun fromDomain(p: GymProgram): ProgramEntity = ProgramEntity(
            id = p.id,
            name = p.name,
            isActive = p.isActive
        )
    }
}

@Entity(tableName = "members")
data class MemberEntity(
    @PrimaryKey val id: String,
    val name: String,
    val address: String?,
    val aadhaarLast4: String?,
    val bloodGroup: String?,
    val age: Int?,
    val phone: String,
    val photoPath: String?,
    val joinDate: String,
    val consentGiven: Boolean,
    val isSynced: Boolean = true
) {
    fun toDomain(): Member = Member(
        id = id,
        name = name,
        address = address,
        aadhaarLast4 = aadhaarLast4,
        bloodGroup = BloodGroup.fromString(bloodGroup),
        age = age,
        phone = phone,
        photoPath = photoPath,
        joinDate = joinDate,
        consentGiven = consentGiven
    )
}
