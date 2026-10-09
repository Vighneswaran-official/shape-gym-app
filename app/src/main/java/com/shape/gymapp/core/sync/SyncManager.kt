package com.shape.gymapp.core.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.shape.gymapp.data.local.dao.SyncQueueDao
import com.shape.gymapp.domain.repository.DashboardRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

class SyncWorker(
    context: Context,
    params: WorkerParameters,
    private val syncQueueDao: SyncQueueDao,
    private val dashboardRepository: DashboardRepository
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            val pendingTasks = syncQueueDao.getPendingTasks()
            for (task in pendingTasks) {
                // Process pending sync task
                syncQueueDao.deleteTask(task.id)
            }
            // Refresh local database with latest remote state
            dashboardRepository.refreshDashboard()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}

@Singleton
class SyncManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val workManager = WorkManager.getInstance(context)

    fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            15, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()

        workManager.enqueueUniquePeriodicWork(
            "shape_background_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }

    fun scheduleDailyRenewalNotifications() {
        // Daily scheduled notification
        val notificationRequest = PeriodicWorkRequestBuilder<com.shape.gymapp.core.notifications.RenewalNotificationWorker>(
            24, TimeUnit.HOURS
        ).build()

        workManager.enqueueUniquePeriodicWork(
            "shape_daily_renewal_alerts",
            ExistingPeriodicWorkPolicy.KEEP,
            notificationRequest
        )
    }
}
