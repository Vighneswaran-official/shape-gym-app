package com.shape.gymapp.core.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.shape.gymapp.MainActivity
import com.shape.gymapp.R
import com.shape.gymapp.core.util.DateUtils
import com.shape.gymapp.core.util.ExpiryAlertStatus
import com.shape.gymapp.data.local.dao.SubscriptionDao
import dagger.hilt.android.qualifiers.ApplicationContext

class RenewalNotificationWorker(
    private val context: Context,
    params: WorkerParameters,
    private val subscriptionDao: SubscriptionDao
) : CoroutineWorker(context, params) {

    companion object {
        const val CHANNEL_ID = "shape_renewal_channel"
        const val NOTIFICATION_ID = 1001
    }

    override suspend fun doWork(): Result {
        return try {
            val subscriptions = subscriptionDao.getAllSubscriptionsList()
            var criticalCount = 0
            var expiringCount = 0

            for (sub in subscriptions) {
                when (DateUtils.getExpiryAlertStatus(sub.endDate)) {
                    ExpiryAlertStatus.CRITICAL -> criticalCount++
                    ExpiryAlertStatus.EXPIRING_SOON -> expiringCount++
                    else -> Unit
                }
            }

            if (criticalCount > 0 || expiringCount > 0) {
                showRenewalNotification(criticalCount, expiringCount)
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun showRenewalNotification(criticalCount: Int, expiringCount: Int) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Membership Renewal Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Daily alerts for memberships expiring in 7 and 3 days"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = "⚡ Shape Gym: Renewals Due Today"
        val message = "$criticalCount critical (<=3 days left), $expiringCount expiring in 7 days."

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}
