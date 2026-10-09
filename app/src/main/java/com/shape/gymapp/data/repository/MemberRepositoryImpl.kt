package com.shape.gymapp.data.repository

import com.shape.gymapp.core.pdf.AdmissionReceiptGenerator
import com.shape.gymapp.core.security.CryptoManager
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.data.local.dao.MemberDao
import com.shape.gymapp.data.local.entity.MemberEntity
import com.shape.gymapp.data.remote.dto.MemberDto
import com.shape.gymapp.data.remote.dto.MemberProgramDto
import com.shape.gymapp.data.remote.dto.PaymentDto
import com.shape.gymapp.data.remote.dto.SignatureDto
import com.shape.gymapp.data.remote.dto.SubscriptionDto
import com.shape.gymapp.domain.model.AdmissionSubmission
import com.shape.gymapp.domain.model.AdmissionSuccessResult
import com.shape.gymapp.domain.model.Member
import com.shape.gymapp.domain.repository.MemberRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MemberRepositoryImpl @Inject constructor(
    private val supabase: SupabaseClient,
    private val memberDao: MemberDao,
    private val cryptoManager: CryptoManager,
    private val receiptGenerator: AdmissionReceiptGenerator
) : MemberRepository {

    override fun getAllMembersFlow(): Flow<List<Member>> {
        return memberDao.getAllMembersFlow().map { list ->
            list.map { it.toDomain() }
        }
    }

    override suspend fun refreshMembers(): Resource<List<Member>> = withContext(Dispatchers.IO) {
        try {
            val remoteDtos = supabase.from("members")
                .select {
                    filter {
                        isExact("deleted_at", null)
                    }
                }
                .decodeList<MemberDto>()

            val entities = remoteDtos.map { dto ->
                MemberEntity(
                    id = dto.id ?: UUID.randomUUID().toString(),
                    name = dto.name,
                    address = dto.address,
                    aadhaarLast4 = dto.aadhaarLast4,
                    bloodGroup = dto.bloodGroup,
                    age = dto.age,
                    phone = dto.phone,
                    photoPath = dto.photoPath,
                    joinDate = dto.joinDate,
                    consentGiven = dto.consentGiven,
                    isSynced = true
                )
            }

            memberDao.insertMembers(entities)
            Resource.Success(entities.map { it.toDomain() })
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to refresh members", e)
        }
    }

    override suspend fun checkDuplicatePhone(phone: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val cleanPhone = phone.trim().takeLast(10)
            val local = memberDao.getMemberByPhone(cleanPhone)
            if (local != null) return@withContext true

            val existing = supabase.from("members")
                .select {
                    filter {
                        eq("phone", cleanPhone)
                        isExact("deleted_at", null)
                    }
                }
                .decodeList<MemberDto>()

            existing.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    override suspend fun submitAdmission(submission: AdmissionSubmission): Resource<AdmissionSuccessResult> =
        withContext(Dispatchers.IO) {
            try {
                // Validation checks
                if (submission.clientSignatureBytes.isEmpty() || submission.managerSignatureBytes.isEmpty()) {
                    return@withContext Resource.Error("Both client and manager signatures are strictly required.")
                }
                if (!submission.consentGiven) {
                    return@withContext Resource.Error("Member consent is required under the DPDP Act 2023.")
                }

                val memberId = UUID.randomUUID().toString()
                val currentUserId = supabase.auth.currentUserOrNull()?.id

                // 1. Client-Side AES-256 Encryption
                val encryptedAadhaar = cryptoManager.encrypt(submission.rawAadhaar)
                val aadhaarLast4 = submission.rawAadhaar.takeLast(4)
                val encryptedHealthHistory = cryptoManager.encrypt(submission.healthHistory)

                // 2. Upload Member Photo to Private Bucket (if selected)
                var photoStoragePath: String? = null
                if (submission.photoBytes != null && submission.photoBytes.isNotEmpty()) {
                    val photoFilename = "$memberId.jpg"
                    try {
                        supabase.storage.from("member-photos").upload(
                            path = photoFilename,
                            data = submission.photoBytes,
                            upsert = true
                        )
                        photoStoragePath = photoFilename
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // 3. Upload Client & Manager Signatures to Private Bucket
                val clientSigPath = "${memberId}_client.png"
                val managerSigPath = "${memberId}_manager.png"

                supabase.storage.from("signatures").upload(
                    path = clientSigPath,
                    data = submission.clientSignatureBytes,
                    upsert = true
                )
                supabase.storage.from("signatures").upload(
                    path = managerSigPath,
                    data = submission.managerSignatureBytes,
                    upsert = true
                )

                // 4. Insert Member Record
                val memberDto = MemberDto(
                    id = memberId,
                    name = submission.fullName.trim(),
                    address = submission.address.trim(),
                    aadhaarLast4 = aadhaarLast4,
                    aadhaarEncrypted = encryptedAadhaar,
                    bloodGroup = submission.bloodGroup?.display,
                    healthHistoryEncrypted = encryptedHealthHistory,
                    age = submission.age,
                    phone = submission.phone.trim(),
                    photoPath = photoStoragePath,
                    joinDate = submission.joiningDateIso,
                    consentGiven = submission.consentGiven,
                    createdBy = currentUserId
                )
                supabase.from("members").insert(memberDto)

                // 5. Insert Member Programs
                if (submission.selectedProgramIds.isNotEmpty()) {
                    val programLinks = submission.selectedProgramIds.map { programId ->
                        MemberProgramDto(memberId = memberId, programId = programId)
                    }
                    supabase.from("member_programs").insert(programLinks)
                }

                // 6. Insert Subscription (With immutable snapshot of Plan Name and Fee)
                val totalPlanFee = submission.selectedPlan.fee
                val totalDue = totalPlanFee + submission.admissionFee
                val balance = totalDue - submission.amountPaid
                val subscriptionId = UUID.randomUUID().toString()

                val subscriptionDto = SubscriptionDto(
                    id = subscriptionId,
                    memberId = memberId,
                    planId = submission.selectedPlan.id.takeIf { it.isNotBlank() },
                    planNameSnapshot = submission.selectedPlan.name,
                    feeSnapshot = submission.selectedPlan.fee,
                    startDate = submission.joiningDateIso,
                    endDate = submission.expiryDateIso,
                    amountDue = totalDue,
                    amountPaid = submission.amountPaid,
                    balance = balance
                )
                supabase.from("subscriptions").insert(subscriptionDto)

                // 7. Insert Payment Audit Record
                if (submission.amountPaid > 0) {
                    val paymentDto = PaymentDto(
                        id = UUID.randomUUID().toString(),
                        memberId = memberId,
                        subscriptionId = subscriptionId,
                        amount = submission.amountPaid,
                        mode = submission.paymentMode.display,
                        type = "subscription_fee",
                        note = "Admission payment (${submission.selectedPlan.name})" +
                                if (submission.admissionFee > 0) " + Admission Fee" else "",
                        createdBy = currentUserId
                    )
                    supabase.from("payments").insert(paymentDto)
                }

                // 8. Insert Signatures Record
                val signatureDto = SignatureDto(
                    id = UUID.randomUUID().toString(),
                    memberId = memberId,
                    clientSignaturePath = clientSigPath,
                    managerSignaturePath = managerSigPath
                )
                supabase.from("signatures").insert(signatureDto)

                // 9. Generate Admission Receipt PDF
                val receiptFile = receiptGenerator.generateReceiptPdf(submission, memberId)

                // 10. Cache Member to Local Room Database
                val localEntity = MemberEntity(
                    id = memberId,
                    name = submission.fullName.trim(),
                    address = submission.address.trim(),
                    aadhaarLast4 = aadhaarLast4,
                    bloodGroup = submission.bloodGroup?.display,
                    age = submission.age,
                    phone = submission.phone.trim(),
                    photoPath = photoStoragePath,
                    joinDate = submission.joiningDateIso,
                    consentGiven = submission.consentGiven,
                    isSynced = true
                )
                memberDao.insertMember(localEntity)

                Resource.Success(
                    AdmissionSuccessResult(
                        memberId = memberId,
                        memberName = submission.fullName,
                        receiptPdfFile = receiptFile
                    )
                )
            } catch (e: Exception) {
                Resource.Error(e.localizedMessage ?: "Failed to complete admission", e)
            }
        }

    override suspend fun deleteMember(memberId: String): Resource<Unit> = withContext(Dispatchers.IO) {
        try {
            supabase.from("members").delete {
                filter { eq("id", memberId) }
            }
            memberDao.deleteMember(memberId)
            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to delete member", e)
        }
    }
}
