package com.shape.gymapp.ui.navigation

sealed class NavRoute(val route: String) {
    object Splash : NavRoute("splash")
    object Login : NavRoute("login")
    object PinLock : NavRoute("pin_lock")
    object PinSetup : NavRoute("pin_setup")
    object Main : NavRoute("main")

    // Bottom Navigation routes inside Main
    object Dashboard : NavRoute("dashboard")
    object Members : NavRoute("members")
    object Admission : NavRoute("admission")
    object Renewals : NavRoute("renewals")
    object Accounts : NavRoute("accounts")
    object Settings : NavRoute("settings")
}
