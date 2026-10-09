package com.shape.gymapp.core.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

enum class ExpiryAlertStatus {
    ACTIVE,
    EXPIRING_SOON, // 7 days or fewer left (Yellow)
    CRITICAL,      // 3 days or fewer left (Red)
    EXPIRED        // Past expiry (Dark Red/Grey)
}

object DateUtils {

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("dd MMM yyyy", Locale.US)
    private val timestampFormat = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.US)

    fun todayIso(): String = isoFormat.format(Date())

    fun formatDisplay(dateIso: String): String {
        return try {
            val date = isoFormat.parse(dateIso) ?: return dateIso
            displayFormat.format(date)
        } catch (e: Exception) {
            dateIso
        }
    }

    fun formatTimestamp(date: Date): String = timestampFormat.format(date)

    /**
     * Calculates days remaining between today and the expiry date.
     * Negative values indicate past expiry.
     */
    fun calculateDaysRemaining(endDateIso: String): Long {
        return try {
            val target = isoFormat.parse(endDateIso) ?: return 0
            val calendarToday = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val calendarTarget = Calendar.getInstance().apply {
                time = target
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            val diffMillis = calendarTarget.timeInMillis - calendarToday.timeInMillis
            TimeUnit.MILLISECONDS.toDays(diffMillis)
        } catch (e: Exception) {
            0
        }
    }

    /**
     * Determines status category according to gym business rules:
     * - < 0 days: EXPIRED (Dark Red/Grey)
     * - <= 3 days: CRITICAL (Red)
     * - <= 7 days: EXPIRING_SOON (Yellow)
     * - > 7 days: ACTIVE
     */
    fun getExpiryAlertStatus(endDateIso: String): ExpiryAlertStatus {
        val days = calculateDaysRemaining(endDateIso)
        return when {
            days < 0 -> ExpiryAlertStatus.EXPIRED
            days <= 3 -> ExpiryAlertStatus.CRITICAL
            days <= 7 -> ExpiryAlertStatus.EXPIRING_SOON
            else -> ExpiryAlertStatus.ACTIVE
        }
    }

    /**
     * Computes expiry date by adding durationDays to startDate
     */
    fun addDays(startDateIso: String, durationDays: Int): String {
        return try {
            val date = isoFormat.parse(startDateIso) ?: Date()
            val cal = Calendar.getInstance().apply {
                time = date
                add(Calendar.DAY_OF_YEAR, durationDays)
            }
            isoFormat.format(cal.time)
        } catch (e: Exception) {
            startDateIso
        }
    }
}
