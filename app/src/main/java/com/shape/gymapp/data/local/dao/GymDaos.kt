package com.shape.gymapp.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.shape.gymapp.data.local.entity.MemberEntity
import com.shape.gymapp.data.local.entity.PlanEntity
import com.shape.gymapp.data.local.entity.ProgramEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PlanDao {
    @Query("SELECT * FROM plans ORDER BY fee ASC")
    fun getAllPlansFlow(): Flow<List<PlanEntity>>

    @Query("SELECT * FROM plans WHERE isActive = 1 ORDER BY fee ASC")
    suspend fun getActivePlans(): List<PlanEntity>

    @Query("SELECT * FROM plans WHERE id = :id LIMIT 1")
    suspend fun getPlanById(id: String): PlanEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlans(plans: List<PlanEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlan(plan: PlanEntity)

    @Update
    suspend fun updatePlan(plan: PlanEntity)

    @Query("DELETE FROM plans WHERE id = :id")
    suspend fun deletePlan(id: String)
}

@Dao
interface ProgramDao {
    @Query("SELECT * FROM programs WHERE isActive = 1 ORDER BY name ASC")
    fun getAllProgramsFlow(): Flow<List<ProgramEntity>>

    @Query("SELECT * FROM programs WHERE isActive = 1 ORDER BY name ASC")
    suspend fun getActivePrograms(): List<ProgramEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPrograms(programs: List<ProgramEntity>)
}

@Dao
interface MemberDao {
    @Query("SELECT * FROM members ORDER BY joinDate DESC")
    fun getAllMembersFlow(): Flow<List<MemberEntity>>

    @Query("SELECT * FROM members WHERE id = :id LIMIT 1")
    suspend fun getMemberById(id: String): MemberEntity?

    @Query("SELECT * FROM members WHERE phone = :phone LIMIT 1")
    suspend fun getMemberByPhone(phone: String): MemberEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMember(member: MemberEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMembers(members: List<MemberEntity>)

    @Query("DELETE FROM members WHERE id = :id")
    suspend fun deleteMember(id: String)
}
