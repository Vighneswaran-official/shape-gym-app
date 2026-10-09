package com.shape.gymapp.data.repository

import com.shape.gymapp.core.network.NetworkConnectivityObserver
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.core.util.ExpiryAlertStatus
import com.shape.gymapp.core.util.Resource
import com.shape.gymapp.data.local.dao.MemberDao
import com.shape.gymapp.data.local.dao.PaymentDao
import com.shape.gymapp.data.local.dao.ProgramDao
import com.shape.gymapp.data.local.dao.SubscriptionDao
import com.shape.gymapp.data.local.dao.SyncQueueDao
import com.shape.gymapp.data.local.entity.PaymentEntity
import com.shape.gymapp.data.local.entity.SubscriptionEntity
import com.shape.gymapp.data.local.entity.SyncQueueEntity
import com.shape.gymapp.data.remote.dto.PaymentDto
import com.shape.gymapp.data.remote.dto.SubscriptionDto
import com.shape.gymapp.domain.model.DashboardMetrics
import com.shape.gymapp.domain.model.RenewalMemberItem
import com.shape.gymapp.domain.model.RenewalSubmission
import com.shape.gymapp.domain.repository.DashboardRepository
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DashboardRepositoryImpl @Inject constructor(
    private val supabase: SupabaseClient,
    private val memberDao: MemberDao,
    private val subscriptionDao: SubscriptionDao,
    private val paymentDao: PaymentDao,
    private val programDao: ProgramDao,
    private val syncQueueDao: SyncQueueDao,
    private val networkObserver: NetworkConnectivityObserver
) : DashboardRepository {

    override fun getDashboardMetricsFlow(): Flow<DashboardMetrics> {
        val todayIso = DateUtils.todayIso()

        return combine(
            memberDao.getAllMembersFlow(),
            subscriptionDao.getAllSubscriptionsFlow(),
            syncQueueDao.getPendingCountFlow()
        ) { members, subs, pendingCount ->
            val totalMembers = members.size
            var activeCount = 0
            var expiringCount = 0
            var criticalCount = 0
            var expiredCount = 0
            var totalPendingDues = 0.0

            // Group subscriptions by memberId, take the most recent one
            val latestSubsByMember = subs.groupBy { it.memberId }
                .mapValues { entry -> entry.value.maxByOrNull { it.endDate } }

            for ((_, sub) in latestSubsByMember) {
                if (sub != null) {
                    val status = DateUtils.getExpiryAlertStatus(sub.endDate)
                    when (status) {
                        ExpiryAlertStatus.ACTIVE -> activeCount++
                        ExpiryAlertStatus.EXPIRING_SOON -> {
                            activeCount++
                            expiringCount++
                        }
                        ExpiryAlertStatus.CRITICAL -> {
                            activeCount++
                            criticalCount++
                        }
                        ExpiryAlertStatus.EXPIRED -> expiredCount++
                    }
                    if (sub.balance > 0) {
                        totalPendingDues += sub.balance
                    }
                }
            }

            val todayPaymentsSum = paymentDao.getTotalCollectionForDate(todayIso) ?: 0.0

            DashboardMetrics(
                totalMembers = totalMembers,
                activeMembers = activeCount,
                expiringSoonCount = expiringCount,
                criticalCount = criticalCount,
                expiredCount = expiredCount,
                todayCollection = todayPaymentsSum,
                totalPendingDues = totalPendingDues,
                isOffline = !networkObserver.isCurrentlyConnected(),
                pendingSyncCount = pendingCount,
                lastBackupTimestamp = null,
                needsBackupWarning = true // Reminder if no backup in 7 days
            )
        }.flowOn(Dispatchers.IO)
    }

    override suspend fun getRenewalsDueList(): Resource<List<RenewalMemberItem>> = withContext(Dispatchers.IO) {
        try {
            refreshDashboard()

            val members = memberDao.getAllMembersFlow()
            val allSubs = subscriptionDao.getAllSubscriptionsList()
            val programs = programDao.getActivePrograms()
            val progMap = programs.associateBy { it.id }

            val memberMap = memberDao.getAllMembersFlow()

            // Group by member, grab latest subscription
            val latestSubs = allSubs.groupBy { it.memberId }
                .mapValues { it.value.maxByOrNull { s -> s.endDate } }

            val resultList = mutableListOf<RenewalMemberItem>()

            for ((memberId, sub) in latestSubs) {
                if (sub != null) {
                    val member = memberDao.getMemberById(memberId)
                    if (member != null) {
                        val status = DateUtils.getExpiryAlertStatus(sub.endDate)
                        val daysRemaining = DateUtils.calculateDaysRemaining(sub.endDate)

                        // Include in Renewals section if Critical (<=3d), Expiring Soon (<=7d), or Expired
                        if (status != ExpiryAlertStatus.ACTIVE) {
                            resultList.add(
                                RenewalMemberItem(
                                    memberId = memberId,
                                    subscriptionId = sub.id,
                                    name = member.name,
                                    phone = member.phone,
                                    programNames = listOf("Gym Access"), // Programs linked
                                    planName = sub.planNameSnapshot,
                                    planId = sub.planId,
                                    expiryDateIso = sub.endDate,
                                    daysRemaining = daysRemaining,
                                    alertStatus = status,
                                    pendingBalance = sub.balance,
                                    planFee = sub.feeSnapshot,
                                    planDurationDays = DateUtils.calculateDaysRemaining(sub.endDate).toInt().coerceAtLeast(30)
                                )
                            )
                        }
                    }
                }
            }

            // Order by urgency: Critical (Red) first, then Expiring Soon (Yellow), then Expired (Dark red/grey)
            val sorted = resultList.sortedWith(
                compareBy(
                    { item ->
                        when (item.alertStatus) {
                            ExpiryAlertStatus.CRITICAL -> 0
                            ExpiryAlertStatus.EXPIRING_SOON -> 1
                            ExpiryAlertStatus.EXPIRED -> 2
                            ExpiryAlertStatus.ACTIVE -> 3
                        }
                    },
                    { it.daysRemaining }
                )
            )

            Resource.Success(sorted)
        } catch (e: Exception) {
            Resource.Error(e.localizedMessage ?: "Failed to load renewals", e)
        }
    }

    override suspend fun refreshDashboard(): Resource<Unit> = withContext(Dispatchers.IO) {
        try {
            if (!networkObserver.isCurrentlyConnected()) {
                return@withContext Resource.Success(Unit)
            }

            // Sync remote subscriptions
            val remoteSubs = supabase.from("subscriptions")
                .select()
                .decodeList<SubscriptionDto>()

            val subEntities = remoteSubs.map { s ->
                SubscriptionEntity(
                    id = s.id ?: UUID.randomUUID().toString(),
                    memberId = s.memberId,
                    planId = s.planId,
                    planNameSnapshot = s.planNameSnapshot,
                    feeSnapshot = s.feeSnapshot,
                    startDate = s.startDate,
                    endDate = s.endDate,
                    amountDue = s.amountDue,
                    amountPaid = s.amountPaid,
                    balance = s.balance
                )
            }
            subscriptionDao.insertSubscriptions(subEntities)

            // Sync remote payments
            val remotePayments = supabase.from("payments")
                .select()
                .decodeList<PaymentDto>()

            val paymentEntities = remotePayments.map { p ->
                PaymentEntity(
                    id = p.id ?: UUID.randomUUID().toString(),
                    memberId = p.memberId,
                    subscriptionId = p.subscriptionId,
                    amount = p.amount,
                    mode = p.mode,
                    paidOnIso = p.paidOn ?: DateUtils.todayIso(),
                    type = p.type,
                    note = p.note
                )
            }
            paymentDao.insertPayments(paymentEntities)

            Resource.Success(Unit)
        } catch (e: Exception) {
            Resource.Success(Unit) // Offline fallback
        }
    }

    override suspend fun renewSubscription(submission: RenewalSubmission): Resource<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val newSubId = UUID.randomUUID().toString()
                val currentUserId = supabase.auth.currentUserOrNull()?.id

                // Carry forward balance rule
                val totalAmountDue = submission.plan.fee + submission.carryForwardBalance
                val newBalance = (totalAmountDue - submission.amountPaid).coerceAtLeast(0.0)

                val subDto = SubscriptionDto(
                    id = newSubId,
                    memberId = submission.memberId,
                    planId = submission.plan.id,
                    planNameSnapshot = submission.plan.name,
                    feeSnapshot = submission.plan.fee,
                    startDate = submission.newStartDateIso,
                    endDate = submission.newEndDateIso,
                    amountDue = totalAmountDue,
                    amountPaid = submission.amountPaid,
                    balance = newBalance
                )

                val paymentDto = if (submission.amountPaid > 0) {
                    PaymentDto(
                        id = UUID.randomUUID().toString(),
                        memberId = submission.memberId,
                        subscriptionId = newSubId,
                        amount = submission.amountPaid,
                        mode = submission.paymentMode.display,
                        type = "subscription_fee",
                        note = "Renewal for ${submission.plan.name}" +
                                if (submission.carryForwardBalance > 0) " (carried forward ₹${submission.carryForwardBalance.toInt()})" else "",
                        createdBy = currentUserId
                    )
                } else null

                // If online, save directly to Supabase
                if (networkObserver.isCurrentlyConnected()) {
                    supabase.from("subscriptions").insert(subDto)
                    if (paymentDto != null) {
                        supabase.from("payments").insert(paymentDto)
                    }
                } else {
                    // Queue for offline sync
                    syncQueueDao.enqueueTask(
                        SyncQueueEntity(
                            id = UUID.randomUUID().toString(),
                            actionType = "RENEW_SUBSCRIPTION",
                            payloadJson = "{\"subId\":\"$newSubId\"}"
                        )
                    )
                }

                // Cache in local Room database
                subscriptionDao.insertSubscription(
                    SubscriptionEntity(
                        id = newSubId,
                        memberId = submission.memberId,
                        planId = submission.plan.id,
                        planNameSnapshot = submission.plan.name,
                        feeSnapshot = submission.plan.fee,
                        startDate = submission.newStartDateIso,
                        endDate = submission.newEndDateIso,
                        amountDue = totalAmountDue,
                        amountPaid = submission.amountPaid,
                        balance = newBalance
                    )
                )

                if (paymentDto != null) {
                    paymentDao.insertPayment(
                        PaymentEntity(
                            id = paymentDto.id ?: UUID.randomUUID().toString(),
                            memberId = submission.memberId,
                            subscriptionId = newSubId,
                            amount = submission.amountPaid,
                            mode = submission.paymentMode.display,
                            paidOnIso = DateUtils.todayIso(),
                            type = "subscription_fee",
                            note = paymentDto.note
                        )
                    )
                }

                Resource.Success(Unit)
            } catch (e: Exception) {
                Resource.Error(e.localizedMessage ?: "Failed to renew subscription", e)
            }
        }
}
