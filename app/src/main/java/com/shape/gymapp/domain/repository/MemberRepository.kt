package com.shape.gymapp.domain.repository

import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.domain.model.AdmissionSubmission
import com.shape.gymapp.domain.model.AdmissionSuccessResult
import com.shape.gymapp.domain.model.Member
import kotlinx.coroutines.flow.Flow

interface MemberRepository {
    fun getAllMembersFlow(): Flow<List<Member>>
    suspend fun refreshMembers(): Resource<List<Member>>
    suspend fun checkDuplicatePhone(phone: String): Boolean
    suspend fun submitAdmission(submission: AdmissionSubmission): Resource<AdmissionSuccessResult>
    suspend fun deleteMember(memberId: String): Resource<Unit>
}
