package com.shape.gymapp

import android.app.Application
import com.shape.gymapp.core.sync.SyncManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class ShapeApp : Application() {

    @Inject
    lateinit var syncManager: SyncManager

    override fun onCreate() {
        super.onCreate()
        // Register WorkManager background jobs
        syncManager.schedulePeriodicSync()
        syncManager.scheduleDailyRenewalNotifications()
    }
}
